import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { ParkingMap } from "@/components/ParkingMap";
import { BookingPanel } from "@/components/BookingPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminLogin } from "@/components/AdminLogin";
import { AuthGate } from "@/components/AuthGate";
import { AuthUser } from "@/lib/auth-api";
import { ParkingProvider } from "@/lib/parking-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Car, LayoutDashboard, LogOut, MapPin, Settings } from "lucide-react";

export default function App() {
  return (
    <AuthGate>
      {(user, signOut) => (
        <ParkingProvider>
          <ParkingApp user={user} signOut={signOut} />
        </ParkingProvider>
      )}
    </AuthGate>
  );
}

function ParkingApp({ user, signOut }: { user: AuthUser; signOut: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [adminAuthorized, setAdminAuthorized] = useState(false);

  const handleTabChange = (nextTab: string) => {
    if (activeTab === "admin" && nextTab !== "admin") {
      setAdminAuthorized(false);
    }
    setActiveTab(nextTab);
  };

  return (
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
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-48 truncate text-sm font-medium">{user.email || user.phone}</p>
                <p className="text-xs text-slate-400">Signed in</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void signOut()} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
              {adminAuthorized ? (
                <AdminPanel />
              ) : (
                <AdminLogin
                  defaultEmail={user.email || ""}
                  onAuthorized={() => setAdminAuthorized(true)}
                />
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
  );
}