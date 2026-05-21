import { Sun, Sunset, Moon, UtensilsCrossed } from "lucide-react";
import type { DoseSchedule } from "../lib/types.ts";

interface DoseGridProps {
  schedule: DoseSchedule;
  lang: "en" | "bn";
}

export function DoseGrid({ schedule, lang }: DoseGridProps) {
  const slots = [
    { key: "morning", count: schedule.morning, icon: Sun, label: lang === "bn" ? "সকাল" : "Morning" },
    { key: "noon", count: schedule.noon, icon: Sunset, label: lang === "bn" ? "দুপুর" : "Noon" },
    { key: "night", count: schedule.night, icon: Moon, label: lang === "bn" ? "রাত" : "Night" },
  ];

  const foodNote = schedule.before_food
    ? (lang === "bn" ? "খাবারের আগে" : "Before food")
    : schedule.after_food
    ? (lang === "bn" ? "খাবারের পরে" : "After food")
    : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s) => {
          const Icon = s.icon;
          const active = s.count > 0;
          return (
            <div
              key={s.key}
              className={`rounded-xl border p-2 text-center transition-colors ${
                active ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100 opacity-60"
              }`}
            >
              <Icon size={16} className={`mx-auto mb-1 ${active ? "text-emerald-600" : "text-gray-400"}`} />
              <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-emerald-700" : "text-gray-400"}`}>
                {s.label}
              </p>
              <p className={`text-lg font-black leading-none mt-0.5 ${active ? "text-emerald-900" : "text-gray-400"}`}>
                {s.count}
              </p>
            </div>
          );
        })}
      </div>
      {(foodNote || schedule.notes) && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <UtensilsCrossed size={12} className="text-gray-400" />
          {foodNote && <span className="font-medium">{foodNote}</span>}
          {schedule.notes && <span className="text-gray-500">· {schedule.notes}</span>}
        </div>
      )}
    </div>
  );
}
