"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

export default function StudentRequestsPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [bookings, setBookings] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const [b, n] = await Promise.all([
      fetch(`/api/bookings?studentId=${user.id}&usageType=BORROW`).then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
    ]);
    setBookings(b.bookings || []);
    setNotifications(n.notifications || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">My Requests</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Borrowing and custody requests with staff messages, AI verification notes, and collection status.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-3">
            {bookings.map((b) => (
              <article key={b.id} className="panel rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{b.equipment?.name}</h2>
                    <div className="text-sm text-[var(--ink-soft)]">
                      {b.lab?.name} · {b.borrowPurpose?.replace(/_/g, " ")} · collect {when(b.start)}
                      {b.expectedReturnAt ? ` · return ${when(b.expectedReturnAt)}` : ""}
                    </div>
                    <p className="mt-2 text-sm">{b.purpose}</p>
                    {b.competition && (
                      <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/60 p-3 text-sm">
                        <div className="font-semibold">
                          {b.competition.name} · {b.competition.organiser}
                        </div>
                        <div className="text-[var(--ink-soft)]">Date {b.competition.date}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusChip status={b.competition.verificationStatus} />
                        </div>
                        {b.competition.aiPriorityReason && (
                          <p className="mt-2 text-xs text-[var(--accent-2)]">{b.competition.aiPriorityReason}</p>
                        )}
                      </div>
                    )}
                    {b.approvalNote && <p className="mt-2 text-xs text-[var(--ink-soft)]">Staff: {b.approvalNote}</p>}
                  </div>
                  <StatusChip status={b.status} />
                </div>
              </article>
            ))}
            {!bookings.length && <p className="text-[var(--ink-soft)]">No borrow requests yet.</p>}
          </section>

          <section className="panel rounded-2xl p-5">
            <h2 className="text-xl font-semibold">Notifications</h2>
            <div className="mt-4 space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                  <div className="font-semibold">{n.title}</div>
                  <p className="mt-1 text-[var(--ink-soft)]">{n.body}</p>
                  <div className="mt-1 text-xs text-[var(--ink-soft)]">{when(n.createdAt)}</div>
                </div>
              ))}
              {!notifications.length && <p className="text-sm text-[var(--ink-soft)]">Inbox clear.</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
