export interface SharedReservation {
  id?: string;
  slotNumber: string;
  vehicleNumber?: string;
  arrivalTime: string;
  expectedExitTime: string;
}

export interface SharedReservationsResponse {
  reservations: SharedReservation[];
  gracePeriodMinutes: number;
}

interface CreateReservationInput {
  slotNumber: string;
  vehicleNumber: string;
  arrivalTime: Date;
  durationHours: number;
  ownerToken: string;
}

const API_BASE_URL = (import.meta.env.VITE_RESERVATION_API_URL || "").replace(/\/+$/, "");

const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (API_BASE_URL) {
    let apiUrl: URL;
    try {
      apiUrl = new URL(API_BASE_URL);
    } catch {
      throw new Error(
        "VITE_RESERVATION_API_URL must be blank for local development or an absolute HTTP(S) URL for deployment."
      );
    }
    if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
      throw new Error(
        "VITE_RESERVATION_API_URL must be blank for local development or an absolute HTTP(S) URL for deployment."
      );
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("Reservation service could not be reached. Check the API URL and network connection.");
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => undefined);
    const message =
      typeof errorBody === "object" &&
      errorBody !== null &&
      "error" in errorBody &&
      typeof errorBody.error === "string"
        ? errorBody.error
        : `Reservation service returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const apiLocation = new URL(response.url).origin;
    throw new Error(
      `Reservation API returned ${contentType || "an unknown content type"} from ${apiLocation}, not JSON. For local development, leave VITE_RESERVATION_API_URL blank and run the API on port 3001. For deployment, set it to the public API base URL and rebuild the website.`
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Reservation API returned invalid JSON.");
  }
};

export const getSharedReservations = () =>
  apiRequest<SharedReservationsResponse>("/api/reservations", { cache: "no-store" });

export const createSharedReservation = (input: CreateReservationInput) =>
  apiRequest<SharedReservation>("/api/reservations", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      arrivalTime: input.arrivalTime.toISOString(),
    }),
  });

export const cancelSharedReservation = (reservationId: string, ownerToken: string) =>
  apiRequest<void>(`/api/reservations/${encodeURIComponent(reservationId)}`, {
    method: "DELETE",
    body: JSON.stringify({ ownerToken }),
  });

export const getReservationOwnerToken = (): string => {
  const storageKey = "smartpark-reservation-owner";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const token = window.crypto.randomUUID();
  window.localStorage.setItem(storageKey, token);
  return token;
};
