import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { ParkingMap } from "@/components/ParkingMap";
import { BookingPanel } from "@/components/BookingPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { ParkingProvider } from "@/lib/parking-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Car, LayoutDashboard, MapPin, Settings } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <ParkingProvider>
      <div className="min-h-screen bg-slate-100">
        <header className="bg-slate-900 text-white shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
                <Car className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">SmartPark</h1>
                <p className="text-xs text-slate-400">Smart City Parking System</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-sm text-slate-300">Live</span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 gap-2 bg-white p-1 rounded-xl shadow-sm">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="parking" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Find Parking</span>
              </TabsTrigger>
              <TabsTrigger value="booking" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                <span className="hidden sm:inline">My Booking</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <Dashboard />
            </TabsContent>
            <TabsContent value="parking">
              <ParkingMap />
            </TabsContent>
            <TabsContent value="booking">
              <BookingPanel />
            </TabsContent>
            <TabsContent value="admin">
              <AdminPanel />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ParkingProvider>
  );
}