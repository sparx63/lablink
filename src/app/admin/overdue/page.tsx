"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

export default function OverduePage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [bookings, setBookings] = useState<any[]>([]);

  async function load() {
    await fetch("/api/overdue", { method: "POST" });
    const d = await fetch("/api/overdue").then((r) => r.json());
    setBookings(d.bookings || []);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Overdue custody</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Borrowed assets past expected return. Students receive overdue notifications.
        </p>
        <div className="mt-6 space-y-3">
          {bookings.map((b) => (
            <article key={b.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{b.equipment?.name}</h2>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {b.student?.name} · unit {b.assignedUnitId || "—"} · due {when(b.expectedReturnAt)}
                  </p>
                </div>
                <StatusChip status={b.status} />
              </div>
            </article>
          ))}
          {!bookings.length && <p className="text-[var(--ink-soft)]">No overdue borrows in scope.</p>}
        </div>
      </main>
    </div>
  );
}
