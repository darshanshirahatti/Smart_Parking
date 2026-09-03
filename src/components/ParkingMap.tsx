import { useState } from "react";
import { useParking, ParkingSlot, PaymentMethod } from "@/lib/parking-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Timer, IndianRupee, Clock, CheckCircle2, XCircle } from "lucide-react";

const DURATION_OPTIONS = [
  { label: "30 minutes", hours: 0.5 },
  { label: "1 hour", hours: 1 },
  { label: "1.5 hours", hours: 1.5 },
  { label: "2 hours", hours: 2 },
  { label: "3 hours", hours: 3 },
  { label: "4 hours", hours: 4 },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Credit/Debit Card" },
  { value: "netbanking", label: "Net Banking" },
  { value: "wallet", label: "Wallet" },
];

export function ParkingMap() {
  const { slots, hourlyRate, reserveSlot, startParking } = useParking();
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "occupied" | "reserved">("all");
  const [arrivalTime, setArrivalTime] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [duration, setDuration] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ bookingId: string; transactionId: string } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredSlots = slots.filter((slot) => {
    const matchesSearch = slot.slotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (slot.vehicleNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || slot.status === filter;
    return matchesSearch && matchesFilter;
  });

  const rows = ["A", "B", "C", "D", "E", "F"];

  const getSlotColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500 hover:bg-emerald-600";
      case "occupied":
        return "bg-red-500 hover:bg-red-600";
      case "reserved":
        return "bg-amber-500 hover:bg-amber-600";
      default:
        return "bg-slate-300";
    }
  };

  const formatTimeAMPM = (date: Date | null | undefined): string => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const parseTimeToDate = (timeStr: string): Date | null => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const now = new Date();
    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);

    // Handle midnight crossing: if selected time is earlier than now, assume next day
    if (date.getTime() < now.getTime()) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  };

  const getCountdown = (arrival: Date) => {
    const now = new Date();
    const diff = arrival.getTime() - now.getTime();
    if (diff <= 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleSlotClick = (slot: ParkingSlot) => {
    setSelectedSlot(slot);
    setBookingMessage(null);
    setShowPayment(false);
    setPaymentSuccess(null);
    setArrivalTime("");
    setVehicleNumber("");
    setError(null);
    setCountdown(null);
  };

  const handleReserveClick = () => {
    if (!selectedSlot || !vehicleNumber.trim()) {
      setBookingMessage("Please enter vehicle number");
      return;
    }

    const arrival = parseTimeToDate(arrivalTime);
    if (!arrival) {
      setBookingMessage("Please select arrival time");
      return;
    }

    const now = new Date();
    const diffMinutes = (arrival.getTime() - now.getTime()) / 60000;

    if (diffMinutes <= 0) {
      setBookingMessage("Please select a future arrival time.");
      return;
    }

    if (diffMinutes > 15) {
      const opensAt = new Date(arrival.getTime() - 15 * 60000);
      setBookingMessage(`Reservation is available only within 15 minutes before your arrival time. Reservation opens at ${formatTimeAMPM(opensAt)}.`);
      setCountdown(getCountdown(opensAt));
      return;
    }

    setBookingMessage(null);
    setCountdown(null);
    setShowPayment(true);
  };

  const handlePayment = () => {
    if (!selectedSlot || !vehicleNumber.trim()) return;
    const arrival = parseTimeToDate(arrivalTime);
    if (!arrival) return;

    const result = reserveSlot(selectedSlot.id, arrival, vehicleNumber.trim(), duration, paymentMethod);
    if (result.success && result.booking) {
      setPaymentSuccess({ bookingId: result.booking.id, transactionId: `TXN${Math.floor(Math.random() * 1000000000)}` });
      setShowPayment(false);
      setSelectedSlot(null);
      setArrivalTime("");
      setVehicleNumber("");
      setDuration(2);
      setPaymentMethod("upi");
    } else {
      setError(result.message);
      setShowPayment(false);
    }
  };

  const handleParkNow = () => {
    if (!selectedSlot || !vehicleNumber.trim()) {
      setBookingMessage("Please enter vehicle number");
      return;
    }

    const now = new Date();
    const result = reserveSlot(selectedSlot.id, now, vehicleNumber.trim(), duration, "cash");
    if (result.success && result.booking) {
      const parkResult = startParking(result.booking.id);
      if (parkResult.success) {
        setSelectedSlot(null);
        setVehicleNumber("");
        setDuration(2);
        setBookingMessage("Vehicle parked successfully!");
      } else {
        setError(parkResult.message);
      }
    } else {
      setError(result.message);
    }
  };

  const estimatedFee = duration * hourlyRate;
  const advanceAmount = estimatedFee * 0.5;
  const remainingAmount = estimatedFee - advanceAmount;

  const renderSlotContent = (slot: ParkingSlot) => {
    if (slot.status === "reserved") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-amber-500">RESERVED</Badge>
            <span className="text-sm text-slate-500">₹{hourlyRate}/hour</span>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">This parking slot is already reserved.</p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex justify-between">
                <span className="text-slate-500">Reserved Until:</span>
                <span className="font-medium">{formatTimeAMPM(slot.arrivalTime)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500">Available After:</span>
                <span className="font-medium">{slot.arrivalTime ? formatTimeAMPM(new Date(slot.arrivalTime.getTime() + 10 * 60000)) : ""}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setSelectedSlot(null)}>
            Choose Another Slot
          </Button>
        </div>
      );
    }

    if (slot.status === "occupied") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-red-500">OCCUPIED</Badge>
            <span className="text-sm text-slate-500">₹{hourlyRate}/hour</span>
          </div>
          <div className="space-y-2 rounded-lg bg-slate-50 p-4">
            <p className="text-sm"><span className="font-medium">Vehicle:</span> {slot.vehicleNumber}</p>
            <p className="text-sm"><span className="font-medium">Entry:</span> {formatTimeAMPM(slot.entryTime)}</p>
            <p className="text-sm"><span className="font-medium">Est. Exit:</span> {formatTimeAMPM(slot.expectedExitTime)}</p>
            {slot.expectedExitTime && (
              <div className="flex items-center gap-2 text-amber-600">
                <Timer className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Available in ~{Math.max(0, Math.round((slot.expectedExitTime.getTime() - Date.now()) / 60000))} minutes
                </span>
              </div>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setSelectedSlot(null)}>
            Choose Another Slot
          </Button>
        </div>
      );
    }

    // Available slot - show booking form
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge className="bg-emerald-500">AVAILABLE</Badge>
          <span className="text-sm text-slate-500">₹{hourlyRate}/hour</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vehicle">Vehicle Number</Label>
          <Input
            id="vehicle"
            placeholder="e.g. KA01AB1234"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="arrival">Arrival Time</Label>
          <div className="relative">
            <Input
              id="arrival"
              type="time"
              value={arrivalTime}
              onChange={(e) => {
                setArrivalTime(e.target.value);
                setBookingMessage(null);
                setCountdown(null);
              }}
              className="pl-9"
            />
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500">
            {arrivalTime ? `Selected: ${formatTimeAMPM(parseTimeToDate(arrivalTime))}` : "Select time (e.g. 07:00 PM)"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Expected Parking Duration</Label>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <Button
                key={opt.hours}
                variant={duration === opt.hours ? "default" : "outline"}
                onClick={() => setDuration(opt.hours)}
                className="justify-start"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {countdown && (
          <div className="rounded-lg bg-amber-50 p-4 text-center">
            <p className="text-sm font-medium text-amber-800">Reservation opens in</p>
            <p className="font-mono text-2xl font-bold text-amber-600">{countdown}</p>
          </div>
        )}

        {bookingMessage && (
          <p className="text-sm text-amber-600">{bookingMessage}</p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
            <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleReserveClick} className="flex-1 bg-amber-500 hover:bg-amber-600">
            Reserve Slot
          </Button>
          <Button onClick={handleParkNow} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
            Park Now
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Find Parking</h2>
          <p className="text-sm text-slate-500">Select a slot to view details or make a reservation</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search slot or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "available", "occupied", "reserved"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Parking Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row} className="flex flex-wrap gap-2">
                {filteredSlots
                  .filter((s) => s.slotNumber.startsWith(row))
                  .map((slot) => (
                    <Dialog key={slot.id}>
                      <DialogTrigger asChild>
                        <button
                          onClick={() => handleSlotClick(slot)}
                          className={`flex h-16 w-16 flex-col items-center justify-center rounded-lg text-white shadow-sm transition-all hover:scale-105 ${getSlotColor(slot.status)}`}
                        >
                          <span className="text-sm font-bold">{slot.slotNumber}</span>
                          <span className="text-[10px] opacity-80">
                            {slot.status === "available" ? "FREE" : slot.status === "occupied" ? "FULL" : "RESERVED"}
                          </span>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Slot {slot.slotNumber}</DialogTitle>
                        </DialogHeader>

                        {paymentSuccess ? (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center rounded-lg bg-emerald-50 p-6">
                              <CheckCircle2 className="mb-2 h-12 w-12 text-emerald-500" />
                              <h3 className="text-lg font-bold text-emerald-700">PAYMENT SUCCESSFUL</h3>
                              <p className="text-sm text-emerald-600">Reservation Confirmed</p>
                            </div>
                            <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                              <p className="text-sm"><span className="font-medium">Slot:</span> {slot.slotNumber}</p>
                              <p className="text-sm"><span className="font-medium">Vehicle:</span> {vehicleNumber}</p>
                              <p className="text-sm"><span className="font-medium">Arrival:</span> {formatTimeAMPM(parseTimeToDate(arrivalTime))}</p>
                              <p className="text-sm"><span className="font-medium">Estimated Fee:</span> ₹{estimatedFee}</p>
                              <p className="text-sm"><span className="font-medium">Advance Paid:</span> ₹{advanceAmount}</p>
                              <p className="text-sm"><span className="font-medium">Remaining:</span> ₹{remainingAmount}</p>
                              <p className="text-sm"><span className="font-medium">Transaction ID:</span> {paymentSuccess.transactionId}</p>
                            </div>
                          </div>
                        ) : showPayment ? (
                          <div className="space-y-4">
                            <div className="rounded-lg bg-slate-50 p-4">
                              <h3 className="mb-3 font-semibold text-slate-900">Payment Details</h3>
                              <div className="space-y-2 text-sm">
                                <p className="flex justify-between"><span className="text-slate-500">Slot:</span> <span className="font-medium">{slot.slotNumber}</span></p>
                                <p className="flex justify-between"><span className="text-slate-500">Vehicle:</span> <span className="font-medium">{vehicleNumber}</span></p>
                                <p className="flex justify-between"><span className="text-slate-500">Arrival:</span> <span className="font-medium">{formatTimeAMPM(parseTimeToDate(arrivalTime))}</span></p>
                                <p className="flex justify-between"><span className="text-slate-500">Duration:</span> <span className="font-medium">{duration} hours</span></p>
                                <p className="flex justify-between"><span className="text-slate-500">Rate:</span> <span className="font-medium">₹{hourlyRate}/hour</span></p>
                                <p className="flex justify-between border-t pt-2"><span className="text-slate-500">Estimated Fee:</span> <span className="font-bold">₹{estimatedFee}</span></p>
                                <p className="flex justify-between"><span className="text-slate-500">Advance (50%):</span> <span className="font-bold text-emerald-600">₹{advanceAmount}</span></p>
                                <p className="flex justify-between"><span className="text-slate-500">Remaining:</span> <span className="font-bold">₹{remainingAmount}</span></p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Choose Payment Method</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {PAYMENT_METHODS.map((method) => (
                                  <Button
                                    key={method.value}
                                    variant={paymentMethod === method.value ? "default" : "outline"}
                                    onClick={() => setPaymentMethod(method.value)}
                                    className="justify-start"
                                  >
                                    {method.label}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <Button onClick={handlePayment} className="w-full bg-emerald-500 hover:bg-emerald-600">
                              Pay ₹{advanceAmount}
                            </Button>
                          </div>
                        ) : (
                          renderSlotContent(slot)
                        )}
                      </DialogContent>
                    </Dialog>
                  ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500"></span> Available</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500"></span> Occupied</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500"></span> Reserved</span>
      </div>
    </div>
  );
}