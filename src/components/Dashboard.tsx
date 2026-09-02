import { useParking } from "@/lib/parking-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParkingSignBoard } from "@/components/ParkingSignBoard";
import { Car, Clock, IndianRupee, MapPin, ParkingCircle, Users } from "lucide-react";

export function Dashboard() {
  const { slots, bookings, hourlyRate, payments } = useParking();

  const available = slots.filter((s) => s.status === "available").length;
  const occupied = slots.filter((s) => s.status === "occupied").length;
  const reserved = slots.filter((s) => s.status === "reserved").length;
  const activeBookings = bookings.filter((b) => b.status === "active").length;
  const todayRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    { label: "Total Slots", value: slots.length, icon: ParkingCircle, color: "bg-slate-100 text-slate-700" },
    { label: "Available", value: available, icon: MapPin, color: "bg-emerald-100 text-emerald-700" },
    { label: "Occupied", value: occupied, icon: Car, color: "bg-red-100 text-red-700" },
    { label: "Reserved", value: reserved, icon: Clock, color: "bg-amber-100 text-amber-700" },
    { label: "Vehicles Parked", value: activeBookings, icon: Users, color: "bg-blue-100 text-blue-700" },
    { label: "Rate", value: `₹${hourlyRate}/hr`, icon: IndianRupee, color: "bg-indigo-100 text-indigo-700" },
    { label: "Today's Revenue", value: `₹${todayRevenue}`, icon: IndianRupee, color: "bg-emerald-100 text-emerald-700" },
    { label: "Active Reservations", value: reserved, icon: Clock, color: "bg-amber-100 text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Parking Dashboard</h2>
          <p className="text-sm text-slate-500">Real-time overview of the parking facility</p>
        </div>
        <Badge className="bg-emerald-500">Live</Badge>
      </div>

      <ParkingSignBoard />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className={`mb-3 inline-flex rounded-xl p-2 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Slots Becoming Available Soon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {slots
              .filter((s) => s.status === "occupied" && s.expectedExitTime)
              .sort((a, b) => (a.expectedExitTime?.getTime() || 0) - (b.expectedExitTime?.getTime() || 0))
              .slice(0, 5)
              .map((slot) => {
                const remaining = slot.expectedExitTime ? Math.max(0, Math.round((slot.expectedExitTime.getTime() - Date.now()) / 60000)) : 0;
                return (
                  <div key={slot.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full bg-red-500"></span>
                      <span className="font-mono font-semibold text-slate-900">{slot.slotNumber}</span>
                      <span className="text-sm text-slate-500">{slot.vehicleNumber}</span>
                    </div>
                    <span className="text-sm font-medium text-amber-600">~{remaining} min</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.slice(-5).reverse().map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{payment.type === "ADVANCE" ? "Advance Payment" : "Final Payment"}</p>
                  <p className="text-xs text-slate-500">{payment.transactionId}</p>
                </div>
                <span className="font-semibold text-emerald-600">₹{payment.amount}</span>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-sm text-slate-500">No payments yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
