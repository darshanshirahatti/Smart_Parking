export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
}

interface AuthResponse {
  user: AuthUser;
}

interface CurrentUserResponse {
  user: AuthUser | null;
}

export const normalizeIndianPhoneNumber = (input: string): string => {
  const compact = input.trim().replace(/[\s()-]/g, "");
  let nationalNumber: string;

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
  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }
  return `+91${nationalNumber}`;
};

const request = async <T>(path: string, body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach the SmartPark server. Check that the backend is running.");
  }

  if (response.status === 204) return undefined as T;
  const result: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : `Authentication request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return result as T;
};

export const getCurrentUser = async () =>
  (await request<CurrentUserResponse>("/api/auth/me")).user;

export const registerWithEmail = async (email: string, password: string) =>
  (await request<AuthResponse>("/api/auth/register", { email, password })).user;

export const loginWithEmail = async (email: string, password: string) =>
  (await request<AuthResponse>("/api/auth/login", { email, password })).user;

export const requestPhoneCode = (phone: string) => {
  const normalizedPhone = normalizeIndianPhoneNumber(phone);
  return request<{ message: string }>("/api/auth/phone/start", { phone: normalizedPhone });
};

export const verifyPhoneCode = async (phone: string, code: string) => {
  const normalizedPhone = normalizeIndianPhoneNumber(phone);
  return (await request<AuthResponse>("/api/auth/phone/verify", { phone: normalizedPhone, code })).user;
};

export const logout = () => request<void>("/api/auth/logout", {});

export const verifyAdminAccess = (email: string, password: string) =>
  request<{ authorized: true; expiresAt: string }>("/api/auth/admin/verify", {
    email,
    password,
  });

export const hasAdminAccess = () =>
  request<{ authorized: true }>("/api/admin/access");
