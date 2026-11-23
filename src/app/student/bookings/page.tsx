"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

export default function StudentBookingsPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [bookings, setBookings] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    if (!user) return;
    const data = await fetch(`/api/bookings?studentId=${user.id}&usageType=IN_LAB`).then((r) => r.json());
    setBookings(data.bookings || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Updated booking (${action})` : data.error);
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">My bookings</h1>
        <p className="mt-2 text-[var(--ink-soft)]">Check in when you arrive, check out with condition notes when you leave.</p>
        {msg && <p className="mt-4 text-sm text-emerald-800">{msg}</p>}
        <div className="mt-6 space-y-3">
          {bookings.map((b) => (
            <article key={b.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{b.equipment?.name}</h2>
                  <div className="text-sm text-[var(--ink-soft)]">
                    {b.usageType === "BORROW" ? "Borrow" : "In-lab"} · {b.lab?.name} · {when(b.start)} → {when(b.end)}
                  </div>
                  <p className="mt-2 text-sm">{b.purpose}</p>
                  {b.approvalNote && <p className="mt-1 text-xs text-[var(--ink-soft)]">Note: {b.approvalNote}</p>}
                </div>
                <StatusChip status={b.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {b.status === "APPROVED" && b.usageType === "IN_LAB" && (
                  <button className="btn btn-accent !py-2" onClick={() => act(b.id, "checkin")}>
                    Check in
                  </button>
                )}
                {(b.status === "ACTIVE" || b.status === "BORROWED") && (
                  <>
                    <button className="btn btn-primary !py-2" onClick={() => act(b.id, "checkout", { returnCondition: "GOOD" })}>
                      Return — Good
                    </button>
                    <button className="btn btn-danger !py-2" onClick={() => act(b.id, "checkout", { returnCondition: "DAMAGED" })}>
                      Return — Damaged
                    </button>
                    <button className="btn btn-danger !py-2" onClick={() => act(b.id, "checkout", { returnCondition: "LOST" })}>
                      Report lost
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
