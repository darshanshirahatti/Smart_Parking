import { useState, useEffect } from "react";
import { useParking } from "@/lib/parking-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, IndianRupee, CheckCircle2, XCircle } from "lucide-react";

export function BookingPanel() {
  const { bookings, slots, hourlyRate, startParking, completeParking, cancelReservation, billingMethod } = useParking();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeBookings = bookings.filter((b) => b.status === "reserved" || b.status === "active");
  const completedBookings = bookings.filter((b) => b.status === "completed" || b.status === "cancelled");

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const calculateActualFee = (entryTime: Date, estimatedDuration: number) => {
    const durationMs = now.getTime() - entryTime.getTime();
    let durationHours = durationMs / 3600000;
    if (billingMethod === "rounded") {
      durationHours = Math.ceil(durationHours);
    }
    return Math.round(durationHours * hourlyRate * 100) / 100;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Booking</h2>
        <p className="text-sm text-slate-500">Manage your current parking sessions</p>
      </div>

      {activeBookings.length === 0 && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Timer className="mb-4 h-12 w-12 text-slate-400" />
            <p className="text-lg font-medium text-slate-600">No active bookings</p>
            <p className="text-sm text-slate-500">Go to Find Parking to reserve a slot</p>
          </CardContent>
        </Card>
      )}

      {activeBookings.map((booking) => {
        const slot = slots.find((s) => s.id === booking.slotId);
        const isReserved = booking.status === "reserved";
        const timeUntilArrival = booking.arrivalTime.getTime() - now.getTime();
        const timeSinceEntry = booking.entryTime ? now.getTime() - booking.entryTime.getTime() : 0;
        const currentFee = booking.entryTime ? calculateActualFee(booking.entryTime, booking.estimatedDuration) : booking.estimatedAmount;

        return (
          <Card key={booking.id} className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Slot {booking.slotNumber}</CardTitle>
                <Badge className={isReserved ? "bg-amber-500" : "bg-emerald-500"}>
                  {isReserved ? "RESERVED" : "ACTIVE"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Vehicle</p>
                  <p className="font-mono font-semibold text-slate-900">{booking.vehicleNumber}</p>
                </div>
                <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Arrival Time</p>
                  <p className="font-semibold text-slate-900">{booking.arrivalTime.toLocaleTimeString()}</p>
                </div>
                {booking.entryTime && (
                  <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Entry Time</p>
                    <p className="font-semibold text-slate-900">{booking.entryTime.toLocaleTimeString()}</p>
                  </div>
                )}
                <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Expected Exit</p>
                  <p className="font-semibold text-slate-900">{booking.expectedExitTime?.toLocaleTimeString()}</p>
                </div>
              </div>

              {isReserved ? (
                <div className="rounded-lg bg-amber-50 p-4">
                  <p className="mb-2 text-sm font-medium text-amber-800">Time Until Arrival</p>
                  <p className="font-mono text-2xl font-bold text-amber-600">{formatDuration(timeUntilArrival)}</p>
                </div>
              ) : (
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="mb-2 text-sm font-medium text-emerald-800">Parking Duration</p>
                  <p className="font-mono text-2xl font-bold text-emerald-600">{formatDuration(timeSinceEntry)}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Estimated Fee</p>
                  <p className="flex items-center gap-1 text-lg font-bold text-slate-900">
                    <IndianRupee className="h-4 w-4" />{booking.estimatedAmount}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Advance Paid</p>
                  <p className="flex items-center gap-1 text-lg font-bold text-emerald-600">
                    <IndianRupee className="h-4 w-4" />{booking.advanceAmount}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Current Fee</p>
                  <p className="flex items-center gap-1 text-lg font-bold text-slate-900">
                    <IndianRupee className="h-4 w-4" />{currentFee}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {isReserved ? (
                  <>
                    <Button onClick={() => startParking(booking.id)} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Vehicle Arrived
                    </Button>
                    <Button onClick={() => cancelReservation(booking.id)} variant="outline" className="flex-1 text-red-600">
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel Reservation
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => completeParking(booking.id)} className="flex-1 bg-blue-500 hover:bg-blue-600">
                    <IndianRupee className="mr-2 h-4 w-4" />
                    Pay & Exit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {completedBookings.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Parking History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedBookings.slice(-5).reverse().map((booking) => (
                <div key={booking.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="font-medium text-slate-900">Slot {booking.slotNumber} · {booking.vehicleNumber}</p>
                    <p className="text-xs text-slate-500">
                      {booking.entryTime?.toLocaleDateString()} {booking.entryTime?.toLocaleTimeString()} - {booking.actualExitTime?.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">₹{booking.estimatedAmount}</p>
                    <Badge variant="outline" className={booking.status === "completed" ? "text-emerald-600" : "text-red-600"}>
                      {booking.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}