import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

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
  bookings: Booking[];
  payments: Payment[];
  hourlyRate: number;
  gracePeriod: number;
  billingMethod: "exact" | "rounded";
  reserveSlot: (slotId: string, arrivalTime: Date, vehicleNumber: string, durationHours: number, paymentMethod: PaymentMethod) => { success: boolean; message: string; booking?: Booking };
  startParking: (bookingId: string) => { success: boolean; message: string };
  completeParking: (bookingId: string, paymentMethod: PaymentMethod) => Payment;
  cancelReservation: (bookingId: string) => void;
  setHourlyRate: (rate: number) => void;
  setGracePeriod: (minutes: number) => void;
  setBillingMethod: (method: "exact" | "rounded") => void;
  addSlot: (slotNumber: string) => void;
  removeSlot: (slotId: string) => void;
  getSlotById: (id: string) => ParkingSlot | undefined;
  getBookingById: (id: string) => Booking | undefined;
}

const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

// ThingsBoard Cloud Integration Parameters
const THINGSBOARD_HOST = "https://thingsboard.cloud";
const THINGSBOARD_DEVICE_ID = "9ab9fab0-a512-11f1-9b46-e7fbeb690c95";
// Public customer ID from making the device public in ThingsBoard
// (Devices > your device > Make Public > copy the Public Id shown).
// Telemetry reads are refused with 401 until this is filled in.
const THINGSBOARD_PUBLIC_ID = "77b6ab60-a6a9-11f1-adbb-a3f81824d891";

const generateSlots = (): ParkingSlot[] => {
  const slots: ParkingSlot[] = [];
  const rows = ["A", "B", "C", "D", "E", "F"];
  const cols = 5;
  const now = new Date();

  rows.forEach((row, rowIndex) => {
    for (let col = 1; col <= cols; col++) {
      const slotNumber = `${row}${String(col).padStart(2, "0")}`;
      const index = rowIndex * cols + col;
      let status: SlotStatus = "available";
      let vehicleNumber: string | undefined;
      let entryTime: Date | undefined;
      let expectedExitTime: Date | undefined;
      let estimatedDuration: number | undefined;
      let arrivalTime: Date | undefined;
      let advancePaid: number | undefined;

      if (index % 3 === 0) {
        status = "occupied";
        vehicleNumber = `KA${String(10 + index).padStart(2, "0")}${["AB", "CD", "EF", "GH", "IJ"][index % 5]}${String(1000 + index * 7)}`;
        entryTime = new Date(now.getTime() - (index % 4) * 30 * 60000);
        estimatedDuration = 2 + (index % 3) * 0.5;
        expectedExitTime = new Date(entryTime.getTime() + estimatedDuration * 3600000);
      } else if (index % 5 === 0) {
        status = "reserved";
        vehicleNumber = `KA${String(20 + index).padStart(2, "0")}${["KL", "MN", "OP", "QR", "ST"][index % 5]}${String(2000 + index * 3)}`;
        arrivalTime = new Date(now.getTime() + 15 * 60000);
        entryTime = arrivalTime;
        estimatedDuration = 2;
        expectedExitTime = new Date(arrivalTime.getTime() + estimatedDuration * 3600000);
        advancePaid = estimatedDuration * 25 * 0.5;
      }

      slots.push({
        id: `slot-${slotNumber}`,
        slotNumber,
        status,
        vehicleNumber,
        entryTime,
        expectedExitTime,
        estimatedDuration,
        arrivalTime,
        advancePaid,
      });
    }
  });

  return slots;
};

const generateInitialBookings = (slots: ParkingSlot[]): Booking[] => {
  const now = new Date();
  const bookings: Booking[] = [];

  slots.forEach((slot, index) => {
    if (slot.status === "occupied" && slot.entryTime) {
      const estimatedAmount = (slot.estimatedDuration || 2) * 25;
      const advanceAmount = estimatedAmount * 0.5;
      bookings.push({
        id: `booking-${index}`,
        slotId: slot.id,
        slotNumber: slot.slotNumber,
        vehicleNumber: slot.vehicleNumber || "",
        bookingTime: new Date(slot.entryTime.getTime() - 30 * 60000),
        arrivalTime: slot.entryTime,
        entryTime: slot.entryTime,
        expectedExitTime: slot.expectedExitTime,
        estimatedDuration: slot.estimatedDuration || 2,
        estimatedAmount,
        advanceAmount,
        remainingAmount: estimatedAmount - advanceAmount,
        status: "active",
      });
    } else if (slot.status === "reserved") {
      const estimatedAmount = (slot.estimatedDuration || 2) * 25;
      const advanceAmount = estimatedAmount * 0.5;
      bookings.push({
        id: `booking-${index}`,
        slotId: slot.id,
        slotNumber: slot.slotNumber,
        vehicleNumber: slot.vehicleNumber || "",
        bookingTime: new Date(now.getTime() - 5 * 60000),
        arrivalTime: slot.arrivalTime || new Date(now.getTime() + 15 * 60000),
        expectedExitTime: slot.expectedExitTime,
        estimatedDuration: slot.estimatedDuration || 2,
        estimatedAmount,
        advanceAmount,
        remainingAmount: estimatedAmount - advanceAmount,
        status: "reserved",
      });
    }
  });

  return bookings;
};

export function ParkingProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<ParkingSlot[]>(() => generateSlots());
  const [bookings, setBookings] = useState<Booking[]>(() => generateInitialBookings(generateSlots()));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [gracePeriod, setGracePeriod] = useState(10);
  const [billingMethod, setBillingMethod] = useState<"exact" | "rounded">("exact");
  const publicTokenRef = useRef<{ token: string; expiresAt: number } | null>(null);

  // Logs in as the public customer and returns a cached JWT for telemetry reads.
  // ThingsBoard's read API (unlike the device-token write API bridge.py uses)
  // requires a logged-in bearer token, even for a device marked "public".
  const getPublicToken = async (): Promise<string | null> => {
    if (publicTokenRef.current && Date.now() < publicTokenRef.current.expiresAt) {
      return publicTokenRef.current.token;
    }
    try {
      const response = await fetch(`${THINGSBOARD_HOST}/api/auth/login/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: THINGSBOARD_PUBLIC_ID }),
      });
      if (!response.ok) {
        console.error("ThingsBoard public login failed:", response.status);
        return null;
      }
      const data = await response.json();
      // Cache for 25 minutes; ThingsBoard tokens are typically valid much longer,
      // but refreshing early avoids ever hitting an expired-token 401.
      publicTokenRef.current = { token: data.token, expiresAt: Date.now() + 25 * 60000 };
      return data.token;
    } catch (error) {
      console.error("ThingsBoard public login error:", error);
      return null;
    }
  };

  // Periodic grace period expiration check
  useEffect(() => {
    const interval = setInterval(() => {
      setSlots((prevSlots) => {
        const now = new Date();
        return prevSlots.map((slot) => {
          if (slot.status === "occupied" && slot.expectedExitTime && now > slot.expectedExitTime) {
            return { ...slot, status: "available" as SlotStatus, vehicleNumber: undefined, entryTime: undefined, expectedExitTime: undefined, estimatedDuration: undefined };
          }
          if (slot.status === "reserved" && slot.arrivalTime) {
            const graceEnd = new Date(slot.arrivalTime.getTime() + gracePeriod * 60000);
            if (now > graceEnd) {
              return { ...slot, status: "available" as SlotStatus, vehicleNumber: undefined, entryTime: undefined, expectedExitTime: undefined, estimatedDuration: undefined, arrivalTime: undefined, advancePaid: undefined, reservedBy: undefined };
            }
          }
          return slot;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gracePeriod]);

  // Real-time Hardware Telemetry Integration with ThingsBoard
  useEffect(() => {
    const fetchHardwareStatus = async () => {
      try {
        const token = await getPublicToken();
        if (!token) return;

        const response = await fetch(
          `${THINGSBOARD_HOST}/api/plugins/telemetry/DEVICE/${THINGSBOARD_DEVICE_ID}/values/timeseries?keys=occupied,distance`,
          { headers: { "X-Authorization": `Bearer ${token}` } }
        );

        if (response.status === 401) {
          // Cached token was rejected (expired/revoked) — drop it so the next poll re-logs in.
          publicTokenRef.current = null;
          return;
        }
        if (!response.ok) return;

        const data = await response.json();
        const isOccupied = data.occupied?.[0]?.value === "true" || data.occupied?.[0]?.value === true;

        // Synchronize hardware telemetry state with slot A01
        setSlots((prevSlots) =>
          prevSlots.map((slot) => {
            if (slot.slotNumber === "A01") {
              if (slot.status === "reserved" && !isOccupied) return slot;

              const now = new Date();
              return {
                ...slot,
                status: isOccupied ? ("occupied" as SlotStatus) : ("available" as SlotStatus),
                entryTime: isOccupied ? slot.entryTime || now : undefined,
                vehicleNumber: isOccupied ? slot.vehicleNumber || "HARDWARE_VEHICLE" : undefined,
              };
            }
            return slot;
          })
        );
      } catch (error) {
        console.error("ThingsBoard Telemetry Fetch Error:", error);
      }
    };

    const interval = setInterval(fetchHardwareStatus, 2000); // Fetch telemetry every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const reserveSlot = (slotId: string, arrivalTime: Date, vehicleNumber: string, durationHours: number, paymentMethod: PaymentMethod): { success: boolean; message: string; booking?: Booking } => {
    const now = new Date();
    const diffMinutes = (arrivalTime.getTime() - now.getTime()) / 60000;

    if (diffMinutes < 0 || diffMinutes > 15) {
      return { success: false, message: "Reservation is available only within 15 minutes before your arrival time." };
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
    const expectedExitTime = new Date(arrivalTime.getTime() + durationHours * 3600000);

    const booking: Booking = {
      id: `booking-${Date.now()}`,
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

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? { ...s, status: "reserved" as SlotStatus, vehicleNumber, arrivalTime, advancePaid: advanceAmount, expectedExitTime, reservedBy: "current-user" }
          : s
      )
    );
    setBookings((prev) => [...prev, booking]);

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

  const completeParking = (bookingId: string, paymentMethod: PaymentMethod): Payment => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

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

  const cancelReservation = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

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
        bookings,
        payments,
        hourlyRate,
        gracePeriod,
        billingMethod,
        reserveSlot,
        startParking,
        completeParking,
        cancelReservation,
        setHourlyRate,
        setGracePeriod,
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