"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Stat } from "@/components/Stat";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { inr, when } from "@/lib/format";

export default function StudentHome() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/bookings?studentId=${user.id}`).then((r) => r.json()),
      fetch(`/api/stats?studentId=${user.id}`).then((r) => r.json()),
      fetch(`/api/fines?studentId=${user.id}`).then((r) => r.json()),
    ]).then(([bookings, stats, fines]) => setData({ ...bookings, ...stats, ...fines }));
  }, [user]);

  if (!ready || !user) {
    return (
      <div className="shell py-20 text-[var(--ink-soft)]">Loading student workspace…</div>
    );
  }

  const upcoming = (data?.bookings || []).filter((b: any) =>
    ["PENDING", "APPROVED", "ACTIVE"].includes(b.status)
  );

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold md:text-4xl">Student dashboard</h1>
            <p className="mt-2 text-[var(--ink-soft)]">
              Explore every campus lab (any department), book in-lab slots or borrow assets, and view your consolidated
              practical timetable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/student/discover" className="btn btn-primary">
              Explore labs
            </Link>
            <Link href="/student/timetable" className="btn btn-ghost">
              My Lab Timetable
            </Link>
            <Link href="/student/exams" className="btn btn-accent">
              My Examinations
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Active holds" value={upcoming.length} hint="Pending + approved + in-lab" />
          <Stat label="Fine balance" value={inr(user.fineBalance)} hint="Blocks new bookings if unpaid" />
          <Stat label="Campus labs" value={data?.stats?.labCount || "—"} hint="Universal typology" />
        </div>

        <section className="panel mt-8 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Upcoming bookings</h2>
            <Link href="/student/bookings" className="text-sm font-semibold text-[var(--accent)]">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {upcoming.slice(0, 4).map((b: any) => (
              <div key={b.id} className="rounded-xl border border-[var(--line)] bg-[#fffcf6] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{b.equipment?.name}</div>
                  <StatusChip status={b.status} />
                </div>
                <div className="mt-1 text-sm text-[var(--ink-soft)]">
                  {b.lab?.name} · {when(b.start)} → {when(b.end)}
                </div>
              </div>
            ))}
            {!upcoming.length && (
              <p className="text-sm text-[var(--ink-soft)]">No upcoming bookings yet. Start from Explore Labs.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
