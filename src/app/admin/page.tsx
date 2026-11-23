"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Stat } from "@/components/Stat";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { LAB_CATEGORY_LABEL, ROLE_LABEL, inr } from "@/lib/format";

export default function AdminHome() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/labs").then((r) => r.json()),
    ]).then(([stats, bookings, labs]) =>
      setData({
        ...stats,
        bookings: (bookings.bookings || []).filter((b: any) =>
          ["PENDING", "NEEDS_INFO", "AI_REVIEW"].includes(b.status)
        ),
        labs: labs.labs,
      })
    );
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading admin workspace…</div>;

  const scoped = user.role !== "SUPER_ADMIN";

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold md:text-4xl">
              {user.role === "SUPER_ADMIN" ? "Central administration" : "Lab in-charge workspace"}
            </h1>
            <p className="mt-2 text-[var(--ink-soft)]">
              {ROLE_LABEL[user.role] || user.role} ·{" "}
              {scoped
                ? `Scoped to your assigned lab${(user.managedLabIds || []).length === 1 ? "" : "s"} — equipment, bookings, approvals, incidents and utilisation.`
                : "Campus-wide oversight across all laboratories."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role !== "TIMETABLE_COORDINATOR" && (
              <>
                <Link href="/admin/approvals" className="btn btn-primary">
                  Review approvals
                </Link>
                <Link href="/admin/ai" className="btn btn-accent">
                  AI Allocate
                </Link>
                <Link href="/admin/exams" className="btn btn-ghost">
                  Exams
                </Link>
              </>
            )}
            {user.role === "TIMETABLE_COORDINATOR" && (
              <Link href="/admin/timetable" className="btn btn-primary">
                Timetable desk
              </Link>
            )}
            {user.role === "SUPER_ADMIN" && (
              <Link href="/admin/import" className="btn btn-ghost">
                Student import
              </Link>
            )}
          </div>
        </div>

        {scoped && (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink-soft)]">
            Assigned labs: {(data?.labs || []).map((l: any) => l.code).join(", ") || "none"}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Pending approvals" value={data?.stats?.pending ?? "—"} />
          <Stat label="Active / borrowed" value={data?.stats?.active ?? "—"} />
          <Stat label="Available assets" value={data?.stats?.available ?? "—"} />
          <Stat label="Outstanding fines" value={inr(data?.stats?.outstandingFines || 0)} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="panel rounded-2xl p-5">
            <h2 className="text-xl font-semibold">Approval queue</h2>
            <div className="mt-4 space-y-3">
              {(data?.bookings || []).slice(0, 5).map((b: any) => (
                <div key={b.id} className="rounded-xl border border-[var(--line)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{b.equipment?.name}</div>
                    <StatusChip status={b.status} />
                  </div>
                  <div className="mt-1 text-sm text-[var(--ink-soft)]">
                    {b.student?.name} · {b.lab?.name} · {b.usageType}
                  </div>
                  {b.competition?.aiPriorityReason && (
                    <p className="mt-2 text-xs text-[var(--accent-2)]">{b.competition.aiPriorityReason}</p>
                  )}
                </div>
              ))}
              {!data?.bookings?.length && <p className="text-sm text-[var(--ink-soft)]">Queue clear.</p>}
            </div>
          </section>

          <section className="panel rounded-2xl p-5">
            <h2 className="text-xl font-semibold">{scoped ? "Your labs" : "Lab network"}</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(data?.labs || []).map((lab: any) => (
                <div key={lab.id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                  <div className="font-semibold">{lab.code}</div>
                  <div className="text-[var(--ink-soft)]">
                    {LAB_CATEGORY_LABEL[lab.category]} · {lab.utilizationPct}%
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
