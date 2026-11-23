"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

function overlaps(a: any, b: any) {
  return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
}

export default function ConflictsPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [bookings, setBookings] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await fetch("/api/bookings").then((r) => r.json());
    setBookings(data.bookings || []);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  const conflicts = useMemo(() => {
    const live = bookings.filter((b) => !["REJECTED", "CANCELLED", "NO_SHOW", "COMPLETED"].includes(b.status));
    const pairs: Array<{ a: any; b: any }> = [];
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        if (live[i].equipmentId === live[j].equipmentId && overlaps(live[i], live[j])) {
          pairs.push({ a: live[i], b: live[j] });
        }
      }
    }
    return pairs;
  }, [bookings]);

  async function resolve(id: string, resolution: "KEEP" | "SHIFT" | "CANCEL") {
    if (!user) return;
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolveConflict", resolution, actorId: user.id }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Resolved via ${resolution}` : data.error);
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Scheduling conflicts</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Detect overlapping holds on the same asset and resolve by keeping priority, shifting, or cancelling.
          {user.role !== "SUPER_ADMIN" ? " Conflicts outside your assigned labs are hidden." : ""}
        </p>
        {msg && <p className="mt-3 text-sm text-emerald-800">{msg}</p>}
        <div className="mt-6 space-y-4">
          {conflicts.map(({ a, b }) => (
            <article key={`${a.id}-${b.id}`} className="panel rounded-2xl p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-2)]">
                Conflict on {a.equipment?.name}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[a, b].map((x) => (
                  <div key={x.id} className="rounded-xl border border-[var(--line)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{x.student?.name}</div>
                      <StatusChip status={x.status} />
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink-soft)]">
                      {when(x.start)} → {when(x.end)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn btn-primary !py-1.5" onClick={() => resolve(x.id, "KEEP")}>
                        Keep (reject others)
                      </button>
                      <button className="btn btn-ghost !py-1.5" onClick={() => resolve(x.id, "SHIFT")}>
                        Shift +30m
                      </button>
                      <button className="btn btn-danger !py-1.5" onClick={() => resolve(x.id, "CANCEL")}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {!conflicts.length && (
            <div className="panel rounded-2xl p-8 text-[var(--ink-soft)]">No overlapping bookings detected.</div>
          )}
        </div>
      </main>
    </div>
  );
}
