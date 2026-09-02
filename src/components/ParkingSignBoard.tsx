import { useParking } from "@/lib/parking-context";

const BAY_SLOT_IDS = ["slot-A01", "slot-A02", "slot-A03", "slot-A04"];

const bayStyles: Record<string, { border: string; fill: string; label: string }> = {
  available: { border: "border-white/70", fill: "bg-transparent", label: "text-white/80" },
  occupied: { border: "border-red-400", fill: "bg-red-500/20", label: "text-red-300" },
  reserved: { border: "border-amber-400", fill: "bg-amber-500/20", label: "text-amber-300" },
};

export function ParkingSignBoard() {
  const { slots } = useParking();

  const bays = BAY_SLOT_IDS.map((id) => slots.find((s) => s.id === id)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s)
  );

  return (
    <div className="rounded-2xl bg-neutral-800 p-6 shadow-lg sm:p-8">
      <h2 className="mb-6 text-center text-xl font-extrabold tracking-wide text-white sm:text-2xl">
        SMART PARKING AREA
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {bays.map((slot, index) => {
          const style = bayStyles[slot.status];
          return (
            <div
              key={slot.id}
              className={`flex h-40 flex-col items-center justify-between rounded-lg border-2 ${style.border} ${style.fill} p-3 transition-colors sm:h-48`}
            >
              <span className="text-xs font-semibold text-white/60">
                Bay {index + 1} · {slot.slotNumber}
              </span>

              <div className="flex flex-1 flex-col items-center justify-center gap-1">
                {slot.status === "available" ? (
                  <span className="text-sm font-medium text-white/50">Empty</span>
                ) : (
                  <>
                    <span className={`text-xs font-semibold uppercase ${style.label}`}>
                      {slot.status}
                    </span>
                    {slot.vehicleNumber && (
                      <span className="font-mono text-xs text-white/80">{slot.vehicleNumber}</span>
                    )}
                  </>
                )}
              </div>

              <span className={`h-2 w-2 rounded-full ${
                slot.status === "available"
                  ? "bg-emerald-400"
                  : slot.status === "occupied"
                  ? "bg-red-400"
                  : "bg-amber-400"
              }`} />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px] text-white/40">
        Live status from ThingsBoard telemetry
      </p>
    </div>
  );
}
