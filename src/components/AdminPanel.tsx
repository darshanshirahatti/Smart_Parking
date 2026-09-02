import { useState } from "react";
import { useParking } from "@/lib/parking-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, Plus, Trash2, Settings } from "lucide-react";

export function AdminPanel() {
  const {
    slots,
    bookings,
    payments,
    hourlyRate,
    gracePeriod,
    billingMethod,
    setHourlyRate,
    setGracePeriod,
    setBillingMethod,
    addSlot,
    removeSlot,
    cancelReservation,
  } = useParking();

  const [newSlotNumber, setNewSlotNumber] = useState("");
  const [newRate, setNewRate] = useState(hourlyRate.toString());
  const [newGracePeriod, setNewGracePeriod] = useState(gracePeriod.toString());

  const available = slots.filter((s) => s.status === "available").length;
  const occupied = slots.filter((s) => s.status === "occupied").length;
  const reserved = slots.filter((s) => s.status === "reserved").length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleAddSlot = () => {
    if (newSlotNumber.trim()) {
      addSlot(newSlotNumber.trim().toUpperCase());
      setNewSlotNumber("");
    }
  };

  const handleUpdateRate = () => {
    const rate = parseFloat(newRate);
    if (!isNaN(rate) && rate > 0) {
      setHourlyRate(rate);
    }
  };

  const handleUpdateGracePeriod = () => {
    const period = parseInt(newGracePeriod);
    if (!isNaN(period) && period > 0) {
      setGracePeriod(period);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="text-sm text-slate-500">Manage parking slots, pricing, and reservations</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-slate-900">{slots.length}</p>
            <p className="text-sm text-slate-500">Total Slots</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-600">{available}</p>
            <p className="text-sm text-slate-500">Available</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{occupied}</p>
            <p className="text-sm text-slate-500">Occupied</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-600">{reserved}</p>
            <p className="text-sm text-slate-500">Reserved</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hourly Rate (₹)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  min="1"
                />
                <Button onClick={handleUpdateRate}>Update</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reservation Grace Period (minutes)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={newGracePeriod}
                  onChange={(e) => setNewGracePeriod(e.target.value)}
                  min="1"
                />
                <Button onClick={handleUpdateGracePeriod}>Update</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Method</Label>
              <Select value={billingMethod} onValueChange={(v) => setBillingMethod(v as "exact" | "rounded")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact Billing</SelectItem>
                  <SelectItem value="rounded">Rounded-Up Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" />
              Add Parking Slot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. G01"
                value={newSlotNumber}
                onChange={(e) => setNewSlotNumber(e.target.value)}
              />
              <Button onClick={handleAddSlot} className="bg-emerald-500 hover:bg-emerald-600">
                Add Slot
              </Button>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{slot.slotNumber}</span>
                    <Badge
                      className={
                        slot.status === "available"
                          ? "bg-emerald-500"
                          : slot.status === "occupied"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }
                    >
                      {slot.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSlot(slot.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Active Reservations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings
              .filter((b) => b.status === "reserved")
              .map((booking) => (
                <div key={booking.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="font-medium text-slate-900">Slot {booking.slotNumber} · {booking.vehicleNumber}</p>
                    <p className="text-xs text-slate-500">Arrival: {booking.arrivalTime.toLocaleTimeString()}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelReservation(booking.id)}
                    className="text-red-600"
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            {bookings.filter((b) => b.status === "reserved").length === 0 && (
              <p className="text-sm text-slate-500">No active reservations</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5" />
              Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">₹{totalRevenue}</p>
            </div>
            <div className="space-y-2">
              {payments.slice(-5).reverse().map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                  <div>
                    <p className="text-sm font-medium">{payment.type === "ADVANCE" ? "Advance" : "Final"} Payment</p>
                    <p className="text-xs text-slate-500">{payment.transactionId}</p>
                  </div>
                  <span className="font-semibold text-emerald-600">₹{payment.amount}</span>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-slate-500">No payments yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}