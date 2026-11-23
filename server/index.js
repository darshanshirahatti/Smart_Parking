import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { neon } from "@neondatabase/serverless";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(serverDirectory, "..");
dotenv.config({ path: resolve(serverDirectory, ".env") });

const app = express();
const port = Number(process.env.PORT || 3001);
const reservationGraceMinutes = Number(process.env.RESERVATION_GRACE_MINUTES || 10);
const databaseUrl = process.env.DATABASE_URL;
const sensorEventToken = process.env.SENSOR_EVENT_TOKEN || "";
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "";
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const webDirectory = resolve(projectDirectory, "dist");
const webEntry = resolve(webDirectory, "index.html");
const SESSION_COOKIE = "smartpark_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const scrypt = promisify(callbackScrypt);
const authRateLimits = new Map();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Add your Neon connection string to the server's .env file or hosting-provider environment; .env.example is only a template."
  );
}
if (sensorEventToken.length < 32) {
  throw new Error(
    "SENSOR_EVENT_TOKEN must be configured with a random secret of at least 32 characters in server/.env."
  );
}
let databaseHostIsNeon = false;
try {
  databaseHostIsNeon = new URL(databaseUrl).hostname.endsWith(".neon.tech");
} catch {
  throw new Error("DATABASE_URL must be a valid Neon PostgreSQL connection URL.");
}
if (!databaseHostIsNeon) {
  throw new Error(
    "DATABASE_URL is not a Neon connection URL. Replace the sample user/password/host/database values with the connection string from your Neon project."
  );
}
if (
  !Number.isInteger(port) ||
  port <= 0 ||
  port > 65535 ||
  !Number.isInteger(reservationGraceMinutes) ||
  reservationGraceMinutes < 0
) {
  throw new Error("PORT and RESERVATION_GRACE_MINUTES must be valid non-negative integers.");
}

const sql = neon(databaseUrl);
const hasTwilioConfig =
  Boolean(twilioAccountSid) &&
  Boolean(twilioAuthToken) &&
  Boolean(twilioVerifyServiceSid);
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("Set CORS_ORIGINS to the deployed website origin(s) in production.");
}

app.disable("x-powered-by");
app.use((request, response, next) => {
  const requestOrigin = `${request.protocol}://${request.get("host")}`;
  cors({
    credentials: true,
    origin(origin, callback) {
      if (
        !origin ||
        origin === requestOrigin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS."));
    },
  })(request, response, next);
});
app.use(express.json({ limit: "16kb" }));

const rateLimit = ({ limit, windowMs }) => (request, response, next) => {
  const now = Date.now();
  if (authRateLimits.size > 1000) {
    for (const [key, bucket] of authRateLimits) {
      if (bucket.resetAt <= now) authRateLimits.delete(key);
    }
  }
  const key = `${request.path}:${request.ip}`;
  let bucket = authRateLimits.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    authRateLimits.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    response.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    response.status(429).json({ error: "Too many attempts. Please wait and try again." });
    return;
  }
  next();
};

const readCookie = (request, name) => {
  const cookieHeader = request.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
};

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS * 1000,
};

const issueSession = async (user, response) => {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`DELETE FROM app_sessions WHERE expires_at <= now()`;
  await sql`
    INSERT INTO app_sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${user.id}, now() + (${SESSION_MAX_AGE_SECONDS} * interval '1 second'))
  `;
  response.cookie(SESSION_COOKIE, token, sessionCookieOptions);
  response.set("Cache-Control", "no-store");
  response.json({ user });
};

const requireAuth = async (request, response, next) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [user] = await sql`
      SELECT app_users.id, app_users.email, app_users.phone_e164 AS phone
      FROM app_sessions
      JOIN app_users ON app_users.id = app_sessions.user_id
      WHERE app_sessions.token_hash = ${tokenHash}
        AND app_sessions.expires_at > now()
    `;
    if (!user) {
      response.clearCookie(SESSION_COOKIE, sessionCookieOptions);
      response.status(401).json({ error: "Your session has expired. Sign in again." });
      return;
    }
    request.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = async (request, response, next) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [session] = await sql`
      SELECT admin_verified_until AS "adminVerifiedUntil"
      FROM app_sessions
      WHERE token_hash = ${tokenHash}
        AND user_id = ${request.authUser.id}
        AND expires_at > now()
    `;
    if (!session?.adminVerifiedUntil || new Date(session.adminVerifiedUntil) <= new Date()) {
      response.status(403).json({ error: "Admin sign-in is required." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
};

const verifyPassword = async (password, passwordHash) => {
  const [saltHex, hashHex] = passwordHash.split(":");
  if (!/^[\da-f]{32}$/i.test(saltHex) || !/^[\da-f]{128}$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
};

const normalizeIndianPhoneNumber = (input) => {
  const compact = input.trim().replace(/[\s()-]/g, "");
  let nationalNumber;
  if (compact.startsWith("+91")) {
    nationalNumber = compact.slice(3);
  } else if (compact.startsWith("0091")) {
    nationalNumber = compact.slice(4);
  } else if (compact.startsWith("91") && compact.length === 12) {
    nationalNumber = compact.slice(2);
  } else {
    nationalNumber = compact;
  }
  if (nationalNumber.length === 11 && nationalNumber.startsWith("0")) {
    nationalNumber = nationalNumber.slice(1);
  }
  return /^[6-9]\d{9}$/.test(nationalNumber) ? `+91${nationalNumber}` : null;
};

const twilioVerifyRequest = async (path, form) => {
  if (!hasTwilioConfig) {
    const error = new Error("Mobile sign-in is not configured. Set the Twilio Verify credentials in server/.env.");
    error.status = 503;
    throw error;
  }
  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(twilioVerifyServiceSid)}${path}`;
  const authorization = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
  const result = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10000),
  });
  const body = await result.json().catch(() => undefined);
  if (!result.ok) {
    const error = new Error(
      typeof body?.message === "string" ? body.message : "The SMS verification service could not process the request."
    );
    error.status = result.status === 429 ? 429 : 502;
    throw error;
  }
  return body;
};

app.get("/health", async (_request, response, next) => {
  try {
    await sql`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/auth/register",
  rateLimit({ limit: 8, windowMs: 15 * 60 * 1000 }),
  async (request, response, next) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 10 ||
      password.length > 128
    ) {
      response.status(400).json({ error: "Enter a valid email and a password of 10 to 128 characters." });
      return;
    }
    try {
      const passwordHash = await hashPassword(password);
      const [user] = await sql`
        INSERT INTO app_users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING id, email, phone_e164 AS phone
      `;
      response.status(201);
      await issueSession(user, response);
    } catch (error) {
      if (error?.code === "23505") {
        response.status(409).json({ error: "An account with that email already exists." });
        return;
      }
      next(error);
    }
  }
);

app.post(
  "/api/auth/login",
  rateLimit({ limit: 10, windowMs: 15 * 60 * 1000 }),
  async (request, response, next) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!email || password.length === 0 || password.length > 128) {
      response.status(400).json({ error: "Enter your email and password." });
      return;
    }
    try {
      const [user] = await sql`
        SELECT id, email, phone_e164 AS phone, password_hash AS "passwordHash"
        FROM app_users
        WHERE email = ${email}
      `;
      if (!user || !(await verifyPassword(password, user.passwordHash || ""))) {
        response.status(401).json({ error: "Email or password is incorrect." });
        return;
      }
      delete user.passwordHash;
      await issueSession(user, response);
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/auth/phone/start",
  (_request, response, next) => {
    if (!hasTwilioConfig) {
      response.status(503).json({
        error: "Mobile sign-in is not configured. Set the Twilio Verify credentials in server/.env.",
      });
      return;
    }
    next();
  },
  rateLimit({ limit: 3, windowMs: 15 * 60 * 1000 }),
  async (request, response, next) => {
    const inputPhone = typeof request.body?.phone === "string" ? request.body.phone : "";
    const phone = normalizeIndianPhoneNumber(inputPhone);
    if (!phone) {
      response.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
      return;
    }
    try {
      await twilioVerifyRequest("/Verifications", { To: phone, Channel: "sms" });
      response.set("Cache-Control", "no-store");
      response.status(202).json({ message: "A verification code has been sent." });
    } catch (error) {
      if (error?.status) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
);

app.post(
  "/api/auth/phone/verify",
  rateLimit({ limit: 8, windowMs: 15 * 60 * 1000 }),
  async (request, response, next) => {
    const inputPhone = typeof request.body?.phone === "string" ? request.body.phone : "";
    const phone = normalizeIndianPhoneNumber(inputPhone);
    const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
    if (!phone || !/^\d{4,10}$/.test(code)) {
      response.status(400).json({ error: "Enter a valid phone number and verification code." });
      return;
    }
    try {
      const verification = await twilioVerifyRequest("/VerificationCheck", { To: phone, Code: code });
      if (verification?.status !== "approved") {
        response.status(401).json({ error: "The verification code is invalid or expired." });
        return;
      }
      let [user] = await sql`
        SELECT id, email, phone_e164 AS phone
        FROM app_users
        WHERE phone_e164 = ${phone}
      `;
      if (!user) {
        try {
          [user] = await sql`
            INSERT INTO app_users (phone_e164)
            VALUES (${phone})
            RETURNING id, email, phone_e164 AS phone
          `;
        } catch (error) {
          if (error?.code !== "23505") throw error;
          [user] = await sql`
            SELECT id, email, phone_e164 AS phone
            FROM app_users
            WHERE phone_e164 = ${phone}
          `;
        }
      }
      await issueSession(user, response);
    } catch (error) {
      if (error?.status) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
);

app.get("/api/auth/me", async (request, response, next) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    response.set("Cache-Control", "no-store");
    response.json({ user: null });
    return;
  }
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [user] = await sql`
      SELECT app_users.id, app_users.email, app_users.phone_e164 AS phone
      FROM app_sessions
      JOIN app_users ON app_users.id = app_sessions.user_id
      WHERE app_sessions.token_hash = ${tokenHash}
        AND app_sessions.expires_at > now()
    `;
    if (!user) response.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    response.set("Cache-Control", "no-store");
    response.json({ user: user ?? null });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/auth/admin/verify",
  requireAuth,
  rateLimit({ limit: 5, windowMs: 15 * 60 * 1000 }),
  async (request, response, next) => {
    if (adminEmails.size === 0) {
      response.status(503).json({
        error: "Admin access is not configured. Add the administrator email to ADMIN_EMAILS in server/.env.",
      });
      return;
    }

    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!email || password.length === 0 || password.length > 128) {
      response.status(400).json({ error: "Enter the administrator email and password." });
      return;
    }

    try {
      const [user] = await sql`
        SELECT id, password_hash AS "passwordHash"
        FROM app_users
        WHERE email = ${email}
      `;
      if (!user || !(await verifyPassword(password, user.passwordHash || ""))) {
        response.status(401).json({ error: "Administrator email or password is incorrect." });
        return;
      }
      if (!adminEmails.has(email)) {
        response.status(403).json({ error: "This account is not authorized for admin access." });
        return;
      }

      const token = readCookie(request, SESSION_COOKIE);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const [session] = await sql`
        UPDATE app_sessions
        SET admin_verified_until = now() + interval '15 minutes'
        WHERE token_hash = ${tokenHash}
          AND user_id = ${request.authUser.id}
          AND expires_at > now()
        RETURNING admin_verified_until AS "adminVerifiedUntil"
      `;
      if (!session) {
        response.status(401).json({ error: "Your session expired. Sign in again." });
        return;
      }

      response.set("Cache-Control", "no-store");
      response.json({ authorized: true, expiresAt: session.adminVerifiedUntil });
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/admin/access", requireAuth, requireAdmin, (request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({ authorized: true });
});

app.post("/api/auth/logout", async (request, response, next) => {
  const token = readCookie(request, SESSION_COOKIE);
  try {
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await sql`DELETE FROM app_sessions WHERE token_hash = ${tokenHash}`;
    }
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/reservations", requireAuth, async (_request, response, next) => {
  try {
    const reservations = await sql`
      WITH expired AS (
        UPDATE parking_reservations
        SET status = 'expired'
        WHERE status = 'reserved' AND hold_until <= now()
        RETURNING id
      )
      SELECT
        slot_number AS "slotNumber",
        arrival_at AS "arrivalTime",
        expected_exit_at AS "expectedExitTime"
      FROM parking_reservations
      WHERE status = 'reserved' AND hold_until > now()
      ORDER BY created_at DESC
    `;
    response.set("Cache-Control", "no-store");
    response.json({
      reservations,
      gracePeriodMinutes: reservationGraceMinutes,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sensor-events", async (request, response, next) => {
  const authorization = request.get("authorization") || "";
  const providedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expected = Buffer.from(sensorEventToken);
  const provided = Buffer.from(providedToken);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    response.status(401).json({ error: "Sensor event authentication failed." });
    return;
  }

  const { slotNumber, occupied } = request.body ?? {};
  if (
    typeof slotNumber !== "string" ||
    !["A01", "A02", "A03"].includes(slotNumber) ||
    typeof occupied !== "boolean"
  ) {
    response.status(400).json({ error: "Sensor event details are invalid." });
    return;
  }

  try {
    const [state] = await sql`
      SELECT previous_occupied AS "previousOccupied",
        reservation_completed AS "reservationCompleted"
      FROM record_parking_sensor_reading(${slotNumber}, ${occupied})
    `;
    response.set("Cache-Control", "no-store");
    response.json({
      slotNumber,
      occupied,
      reservationCompleted: state?.reservationCompleted ?? false,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/reservations", requireAuth, async (request, response, next) => {
  const { slotNumber, vehicleNumber, arrivalTime, durationHours, ownerToken } = request.body ?? {};
  const arrival = typeof arrivalTime === "string" ? new Date(arrivalTime) : new Date(Number.NaN);
  const now = Date.now();

  if (
    typeof slotNumber !== "string" ||
    !/^A\d{2}$/.test(slotNumber) ||
    typeof vehicleNumber !== "string" ||
    vehicleNumber.trim().length < 1 ||
    vehicleNumber.trim().length > 20 ||
    typeof arrivalTime !== "string" ||
    !Number.isFinite(arrival.getTime()) ||
    arrival.getTime() < now - 60_000 ||
    arrival.getTime() > now + 30 * 24 * 60 * 60 * 1000 ||
    typeof durationHours !== "number" ||
    durationHours < 0.5 ||
    durationHours > 4 ||
    typeof ownerToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerToken)
  ) {
    response.status(400).json({ error: "Reservation details are invalid." });
    return;
  }

  const expectedExitTime = new Date(arrival.getTime() + durationHours * 60 * 60 * 1000);
  const holdUntil = new Date(expectedExitTime.getTime() + reservationGraceMinutes * 60 * 1000);
  const reservationId = randomUUID();

  try {
    await sql`
      UPDATE parking_reservations
      SET status = 'expired'
      WHERE status = 'reserved' AND hold_until <= now()
    `;
    const rows = await sql`
      INSERT INTO parking_reservations (
        id, slot_number, vehicle_number, arrival_at, expected_exit_at, hold_until, owner_token
      )
      VALUES (
        ${reservationId},
        ${slotNumber},
        ${vehicleNumber.trim()},
        ${arrival.toISOString()},
        ${expectedExitTime.toISOString()},
        ${holdUntil.toISOString()},
        ${ownerToken}
      )
      RETURNING id, slot_number AS "slotNumber", vehicle_number AS "vehicleNumber",
        arrival_at AS "arrivalTime", expected_exit_at AS "expectedExitTime"
    `;
    response.status(201).json(rows[0]);
  } catch (error) {
    if (error?.code === "23P01") {
      response.status(409).json({ error: `Slot ${slotNumber} is already reserved for this time.` });
      return;
    }
    next(error);
  }
});

app.delete("/api/reservations/:id", requireAuth, async (request, response, next) => {
  const { ownerToken } = request.body ?? {};
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id) ||
    typeof ownerToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerToken)
  ) {
    response.status(400).json({ error: "Reservation cancellation details are invalid." });
    return;
  }

  try {
    const matches = await sql`
      SELECT owner_token AS "ownerToken", status
      FROM parking_reservations
      WHERE id = ${request.params.id}
    `;
    if (matches.length === 0 || matches[0].status !== "reserved") {
      response.status(204).end();
      return;
    }
    if (matches[0].ownerToken !== ownerToken) {
      response.status(403).json({ error: "This browser cannot cancel the reservation." });
      return;
    }

    const rows = await sql`
      UPDATE parking_reservations
      SET status = 'cancelled'
      WHERE id = ${request.params.id}
        AND owner_token = ${ownerToken}
        AND status = 'reserved'
      RETURNING id
    `;
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

if (existsSync(webEntry)) {
  app.use(express.static(webDirectory, { index: false }));
  app.use((request, response, next) => {
    if (
      request.method !== "GET" ||
      request.path === "/api" ||
      request.path.startsWith("/api/") ||
      request.path === "/health"
    ) {
      next();
      return;
    }
    response.sendFile(webEntry, (error) => {
      if (error) next(error);
    });
  });
}

app.use((request, response) => {
  response.status(404).json({ error: `Route not found: ${request.method} ${request.path}` });
});

app.use((error, _request, response, _next) => {
  if (error?.message === "Origin is not allowed by CORS.") {
    response.status(403).json({ error: "This website is not allowed to use the reservation API." });
    return;
  }
  if (error?.type === "entity.too.large") {
    response.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    response.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }
  console.error("Reservation API request failed:", error?.message || "Unknown error");
  response.status(500).json({ error: "Reservation service is temporarily unavailable." });
});

const start = async () => {
  try {
    await sql`SELECT 1`;
    await sql`SELECT id FROM parking_reservations LIMIT 0`;
    await sql`SELECT id FROM app_users LIMIT 0`;
    await sql`SELECT token_hash FROM app_sessions LIMIT 0`;
    await sql`SELECT admin_verified_until FROM app_sessions LIMIT 0`;
    const [sensorFunction] = await sql`
      SELECT to_regprocedure('record_parking_sensor_reading(text,boolean)') AS "functionName"
    `;
    if (!sensorFunction?.functionName) {
      throw new Error("Sensor event database function is missing. Run server/schema.sql against the configured Neon database.");
    }
  } catch (error) {
    if (error?.code === "42P01") {
      throw new Error(
        "Database table parking_reservations is missing. Run server/schema.sql against the configured Neon database.",
        { cause: error }
      );
    }
    throw new Error(
      `Could not connect to the configured database: ${error?.message || "unknown database error"}`,
      { cause: error }
    );
  }

  const server = app.listen(port, () => {
    const servesWeb = existsSync(webEntry);
    console.info(`SmartPark backend listening on port ${port}.`);
    console.info(`Web application ${servesWeb ? "available" : "not built"}${servesWeb ? ` at http://localhost:${port}` : "; run npm run build:web from server/ first"}.`);
    console.info(`Reservation API health check: http://localhost:${port}/health`);
  });

  const shutdown = () => {
    server.close((error) => {
      if (error) {
        console.error("Error while shutting down SmartPark backend:", error);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

start().catch((error) => {
  console.error("SmartPark backend failed to start:", error?.message || error);
  process.exitCode = 1;
});
