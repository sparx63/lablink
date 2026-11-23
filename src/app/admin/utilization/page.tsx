"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import { LAB_CATEGORY_LABEL } from "@/lib/format";

export default function UtilizationPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [labs, setLabs] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/labs").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]).then(([l, e, s]) => {
      setLabs(l.labs || []);
      setEquipment(e.equipment || []);
      setStats(s.stats);
    });
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Utilization & readiness</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          {user.role === "SUPER_ADMIN"
            ? "Spot overbooked labs, quarantined assets, and category coverage across the campus network."
            : "Utilisation and asset health for your assigned laboratories only."}
        </p>

        <div className="mt-6 panel rounded-2xl p-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Network average</div>
          <div className="mt-2 text-4xl font-semibold">{stats?.utilization ?? "—"}%</div>
          <div className="mt-4 space-y-3">
            {labs
              .slice()
              .sort((a, b) => b.utilizationPct - a.utilizationPct)
              .map((lab) => (
                <div key={lab.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">
                      {lab.name} · {LAB_CATEGORY_LABEL[lab.category]}
                    </span>
                    <span>{lab.utilizationPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--paper-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${lab.utilizationPct}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Asset health</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {equipment.map((e) => (
              <div key={e.id} className="panel rounded-2xl p-4 text-sm">
                <div className="font-semibold">{e.name}</div>
                <div className="text-[var(--ink-soft)]">
                  {e.status} · {e.lab?.name}
                </div>
                <div className="mt-2 text-[var(--ink-soft)]">{e.conditionNotes}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
