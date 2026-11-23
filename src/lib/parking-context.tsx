import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import {
  cancelSharedReservation,
  createSharedReservation,
  getReservationOwnerToken,
  getSharedReservations,
  SharedReservation,
} from "@/lib/reservations-api";

export type SlotStatus = "available" | "occupied" | "reserved";
export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cash";

export interface ParkingSlot {
  id: string;
  slotNumber: string;
  status: SlotStatus;
  vehicleNumber?: string;
  entryTime?: Date;
  expectedExitTime?: Date;
  estimatedDuration?: number;
  reservedUntil?: Date;
  arrivalTime?: Date;
  advancePaid?: number;
  reservedBy?: string;
}

export interface Booking {
  id: string;
  slotId: string;
  slotNumber: string;
  vehicleNumber: string;
  bookingTime: Date;
  arrivalTime: Date;
  entryTime?: Date;
  expectedExitTime?: Date;
  actualExitTime?: Date;
  estimatedDuration: number;
  actualDuration?: number;
  estimatedAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  status: "reserved" | "active" | "completed" | "cancelled";
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  type: "ADVANCE" | "FINAL";
  method: PaymentMethod;
  transactionId: string;
  time: Date;
  status: "PAID" | "PENDING" | "FAILED";
}

interface ParkingContextType {
  slots: ParkingSlot[];
  reservationServiceOnline: boolean;
  bookings: Booking[];
  payments: Payment[];
  hourlyRate: number;
  reservationGraceMinutes: number;
  billingMethod: "exact" | "rounded";
  reserveSlot: (slotId: string, arrivalTime: Date, vehicleNumber: string, durationHours: number, paymentMethod: PaymentMethod) => Promise<{ success: boolean; message: string; booking?: Booking }>;
  startParking: (bookingId: string) => { success: boolean; message: string };
  completeParking: (bookingId: string, paymentMethod: PaymentMethod) => Promise<Payment>;
  cancelReservation: (bookingId: string) => Promise<void>;
  setHourlyRate: (rate: number) => void;
  setBillingMethod: (method: "exact" | "rounded") => void;
  addSlot: (slotNumber: string) => void;
  removeSlot: (slotId: string) => void;
  getSlotById: (id: string) => ParkingSlot | undefined;
  getBookingById: (id: string) => Booking | undefined;
}

const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

const THINGSBOARD_HOST = (
  import.meta.env.VITE_THINGSBOARD_HOST || "https://thingsboard.cloud"
).replace(/\/+$/, "");
const THINGSBOARD_DEVICE_ID =
  import.meta.env.VITE_THINGSBOARD_DEVICE_ID ||
  "9ab9fab0-a512-11f1-9b46-e7fbeb690c95";
const THINGSBOARD_API_KEY = import.meta.env.VITE_THINGSBOARD_API_KEY;
const TELEMETRY_POLL_INTERVAL_MS = 2000;
const TELEMETRY_REQUEST_TIMEOUT_MS = 5000;

const SENSOR_TO_SLOT = [
  { key: "occupied", slotNumber: "A01" },
  { key: "occupied2", slotNumber: "A02" },
  { key: "occupied3", slotNumber: "A03" },
];

const parseOccupancy = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
};


// Physical model has exactly 4 bays. Only A01 has a real sensor right now —
// all four start "available" with no mock vehicles/bookings, so every number
// on the dashboard reflects real activity (real sensor readings for A01, and
// real reservations made through the app) instead of fabricated demo data.
const SLOT_NUMBERS = ["A01", "A02", "A03", "A04"];

const generateSlots = (): ParkingSlot[] =>
  SLOT_NUMBERS.map((slotNumber) => ({
    id: `slot-${slotNumber}`,
    slotNumber,
    status: "available" as SlotStatus,
  }));

export function ParkingProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<ParkingSlot[]>(() => generateSlots());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [reservationGraceMinutes, setReservationGraceMinutes] = useState(10);
  const [billingMethod, setBillingMethod] = useState<"exact" | "rounded">("exact");
  const [reservationServiceOnline, setReservationServiceOnline] = useState(false);
  const sharedReservationsRef = useRef<SharedReservation[]>([]);

  // Reservation state is shared through the Neon API; sensor readings remain
  // authoritative for whether a car is physically occupying a mapped slot.
  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    const refreshReservations = async () => {
      try {
        const response = await getSharedReservations();
        if (disposed) return;
        setReservationServiceOnline(true);
        setReservationGraceMinutes(response.gracePeriodMinutes);
        const reservations = response.reservations;
        sharedReservationsRef.current = reservations;
        setSlots((previousSlots) =>
          previousSlots.map((slot) => {
            if (slot.status === "occupied") return slot;
            const reservation = reservations.find((item) => item.slotNumber === slot.slotNumber);
            if (reservation) {
              return {
                ...slot,
                status: "reserved",
                arrivalTime: new Date(reservation.arrivalTime),
                expectedExitTime: new Date(reservation.expectedExitTime),
              };
            }
            if (slot.status === "reserved") {
              return {
                ...slot,
                status: "available",
                vehicleNumber: undefined,
                arrivalTime: undefined,
                expectedExitTime: undefined,
                advancePaid: undefined,
                reservedBy: undefined,
              };
            }
            return slot;
          })
        );
      } catch (error) {
        if (!disposed) {
          setReservationServiceOnline(false);
          console.error("[SmartPark] Shared reservation refresh failed:", error);
        }
      } finally {
        if (!disposed) {
          pollTimer = setTimeout(refreshReservations, 2000);
        }
      }
    };

    void refreshReservations();
    return () => {
      disposed = true;
      clearTimeout(pollTimer);
    };
  }, []);

  useEffect(() => {
    if (!THINGSBOARD_DEVICE_ID || !THINGSBOARD_API_KEY) {
      console.warn(
        "[SmartPark] Hardware telemetry is disabled; configure VITE_THINGSBOARD_DEVICE_ID and VITE_THINGSBOARD_API_KEY."
      );
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;

    const fetchHardwareStatus = async () => {
      controller = new AbortController();
      const requestTimer = setTimeout(
        () => controller?.abort(),
        TELEMETRY_REQUEST_TIMEOUT_MS
      );
      try {
        const keys = SENSOR_TO_SLOT.map((s) => s.key).join(",");
        const url = `${THINGSBOARD_HOST}/api/plugins/telemetry/DEVICE/${THINGSBOARD_DEVICE_ID}/values/timeseries?keys=${keys}`;
        const response = await fetch(url, {
          headers: { "X-Authorization": `ApiKey ${THINGSBOARD_API_KEY}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`ThingsBoard telemetry request failed with HTTP ${response.status}.`);
        }

        const data: unknown = await response.json();
        if (typeof data !== "object" || data === null || Array.isArray(data)) {
          throw new Error("ThingsBoard returned an invalid telemetry response.");
        }
        const telemetry = data as Record<string, unknown>;

        setSlots((prevSlots) => {
          return prevSlots.map((slot) => {
            const mapping = SENSOR_TO_SLOT.find((s) => s.slotNumber === slot.slotNumber);
            if (!mapping) return slot;

            const samples = telemetry[mapping.key];
            const sample = Array.isArray(samples) ? samples[0] : undefined;
            if (typeof sample !== "object" || sample === null || !("value" in sample)) {
              return slot;
            }
            const isOccupied = parseOccupancy(sample.value);
            if (isOccupied === undefined) return slot;

            const reservation = sharedReservationsRef.current.find(
              (item) => item.slotNumber === slot.slotNumber
            );
            if (isOccupied) {
              return {
                ...slot,
                status: "occupied",
                entryTime: slot.entryTime || new Date(),
                vehicleNumber: slot.vehicleNumber || "HARDWARE_VEHICLE",
              };
            }

            if (reservation) {
              return {
                ...slot,
                status: "reserved",
                entryTime: undefined,
                vehicleNumber: undefined,
                arrivalTime: new Date(reservation.arrivalTime),
                expectedExitTime: new Date(reservation.expectedExitTime),
              };
            }

            return {
              ...slot,
              status: "available",
              entryTime: undefined,
              vehicleNumber: undefined,
            };
          });
        });
      } catch (error) {
        if (!disposed) {
          console.error("[SmartPark] Hardware telemetry request failed:", error);
        }
      } finally {
        clearTimeout(requestTimer);
        if (!disposed) {
          pollTimer = setTimeout(fetchHardwareStatus, TELEMETRY_POLL_INTERVAL_MS);
        }
      }
    };

    void fetchHardwareStatus();
    return () => {
      disposed = true;
      clearTimeout(pollTimer);
      controller?.abort();
    };
  }, []);

  const reserveSlot = async (slotId: string, arrivalTime: Date, vehicleNumber: string, durationHours: number, paymentMethod: PaymentMethod): Promise<{ success: boolean; message: string; booking?: Booking }> => {
    const now = new Date();
    if (arrivalTime.getTime() < now.getTime() - 60000) {
      return { success: false, message: "Please choose a future arrival time." };
    }

    const slot = slots.find((s) => s.id === slotId);
    if (!slot) {
      return { success: false, message: "Slot not found." };
    }

    if (slot.status !== "available") {
      return { success: false, message: `Slot ${slot.slotNumber} is already ${slot.status}. Please choose another parking slot.` };
    }

    const estimatedAmount = durationHours * hourlyRate;
    const advanceAmount = estimatedAmount * 0.5;
    const remainingAmount = estimatedAmount - advanceAmount;
    let sharedReservation: SharedReservation;
    try {
      sharedReservation = await createSharedReservation({
        slotNumber: slot.slotNumber,
        vehicleNumber: vehicleNumber.trim(),
        arrivalTime,
        durationHours,
        ownerToken: getReservationOwnerToken(),
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Could not save the shared reservation.",
      };
    }

    const expectedExitTime = new Date(sharedReservation.expectedExitTime);
    sharedReservationsRef.current = [
      ...sharedReservationsRef.current.filter((item) => item.slotNumber !== slot.slotNumber),
      sharedReservation,
    ];

    const booking: Booking = {
      id: sharedReservation.id || `booking-${Date.now()}`,
      slotId,
      slotNumber: slot.slotNumber,
      vehicleNumber,
      bookingTime: now,
      arrivalTime,
      expectedExitTime,
      estimatedDuration: durationHours,
      estimatedAmount,
      advanceAmount,
      remainingAmount,
      status: "reserved",
    };

    setBookings((prev) => [...prev, booking]);
    setSlots((prev) =>
      prev.map((currentSlot) =>
        currentSlot.id === slotId
          ? {
              ...currentSlot,
              status: "reserved",
              vehicleNumber,
              arrivalTime,
              expectedExitTime,
              advancePaid: advanceAmount,
              reservedBy: "current-user",
            }
          : currentSlot
      )
    );

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      bookingId: booking.id,
      amount: advanceAmount,
      type: "ADVANCE",
      method: paymentMethod,
      transactionId: `TXN${Math.floor(Math.random() * 1000000000)}`,
      time: now,
      status: "PAID",
    };
    setPayments((prev) => [...prev, payment]);

    return { success: true, message: "Reservation successful.", booking };
  };

  const startParking = (bookingId: string): { success: boolean; message: string } => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return { success: false, message: "Booking not found." };
    }

    const slot = slots.find((s) => s.id === booking.slotId);
    if (!slot || slot.status !== "reserved") {
      return { success: false, message: `Cannot park in this slot. Slot ${slot?.slotNumber || ""} is currently ${slot?.status || "unavailable"}.` };
    }

    const now = new Date();
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: "active" as const, entryTime: now, expectedExitTime: new Date(now.getTime() + b.estimatedDuration * 3600000) }
          : b
      )
    );
    setSlots((prev) =>
      prev.map((s) =>
        s.id === booking.slotId
          ? { ...s, status: "occupied" as SlotStatus, entryTime: now, expectedExitTime: new Date(now.getTime() + booking.estimatedDuration * 3600000) }
          : s
      )
    );

    return { success: true, message: "Parking started." };
  };

  const completeParking = async (bookingId: string, paymentMethod: PaymentMethod): Promise<Payment> => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await cancelSharedReservation(bookingId, getReservationOwnerToken());
    sharedReservationsRef.current = sharedReservationsRef.current.filter(
      (item) => item.slotNumber !== booking.slotNumber
    );

    const now = new Date();
    const entryTime = booking.entryTime || booking.arrivalTime;
    let durationHours = (now.getTime() - entryTime.getTime()) / 3600000;

    if (billingMethod === "rounded") {
      durationHours = Math.ceil(durationHours);
    }

    const actualAmount = Math.round(durationHours * hourlyRate * 100) / 100;
    const remainingAmount = Math.max(0, actualAmount - booking.advanceAmount);

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      bookingId,
      amount: remainingAmount,
      type: "FINAL",
      method: paymentMethod,
      transactionId: `TXN${Math.floor(Math.random() * 1000000000)}`,
      time: now,
      status: "PAID",
    };

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: "completed" as const, actualExitTime: now, actualDuration: durationHours, remainingAmount }
          : b
      )
    );
    setSlots((prev) =>
      prev.map((s) =>
        s.id === booking.slotId
          ? { ...s, status: "available" as SlotStatus, vehicleNumber: undefined, entryTime: undefined, expectedExitTime: undefined, estimatedDuration: undefined, arrivalTime: undefined, advancePaid: undefined, reservedBy: undefined }
          : s
      )
    );
    setPayments((prev) => [...prev, payment]);

    return payment;
  };

  const cancelReservation = async (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    await cancelSharedReservation(bookingId, getReservationOwnerToken());
    sharedReservationsRef.current = sharedReservationsRef.current.filter(
      (item) => item.slotNumber !== booking.slotNumber
    );
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" as const } : b)));
    setSlots((prev) =>
      prev.map((s) =>
        s.id === booking.slotId
          ? { ...s, status: "available" as SlotStatus, vehicleNumber: undefined, arrivalTime: undefined, advancePaid: undefined, expectedExitTime: undefined, reservedBy: undefined }
          : s
      )
    );
  };

  const addSlot = (slotNumber: string) => {
    setSlots((prev) => [...prev, { id: `slot-${slotNumber}`, slotNumber, status: "available" as SlotStatus }]);
  };

  const removeSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const getSlotById = (id: string) => slots.find((s) => s.id === id);
  const getBookingById = (id: string) => bookings.find((b) => b.id === id);

  return (
    <ParkingContext.Provider
      value={{
        slots,
        reservationServiceOnline,
        bookings,
        payments,
        hourlyRate,
        reservationGraceMinutes,
        billingMethod,
        reserveSlot,
        startParking,
        completeParking,
        cancelReservation,
        setHourlyRate,
        setBillingMethod,
        addSlot,
        removeSlot,
        getSlotById,
        getBookingById,
      }}
    >
      {children}
    </ParkingContext.Provider>
  );
}

export function useParking() {
  const context = useContext(ParkingContext);
  if (!context) {
    throw new Error("useParking must be used within ParkingProvider");
  }
  return context;
}