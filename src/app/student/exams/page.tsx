"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";

export default function StudentExamsPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [exams, setExams] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/exams?view=student-exams&studentId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setExams(d.exams || []));
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">My Examinations</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Experiment assignments appear only after your teacher clicks <strong>Start the test</strong> (LIVE exams).
        </p>
        <div className="mt-6 space-y-3">
          {exams.map((row: any) => (
            <article key={row.allocation.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{row.exam.title}</h2>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {row.lab?.name} · {row.exam.examDate} · {row.exam.startHour}:00–{row.exam.endHour}:00
                  </p>
                </div>
                <StatusChip status={row.exam.status} />
              </div>
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/70 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Assigned experiment
                </div>
                <div className="mt-1 font-semibold">
                  {row.experiment?.code} · {row.experiment?.title}
                </div>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">{row.experiment?.description}</p>
                {(row.allocation.groupLabel || row.allocation.seat) && (
                  <p className="mt-2 text-xs text-[var(--ink-soft)]">
                    {row.allocation.groupLabel}
                    {row.allocation.seat ? ` · ${row.allocation.seat}` : ""}
                  </p>
                )}
              </div>
            </article>
          ))}
          {!exams.length && (
            <p className="text-[var(--ink-soft)]">
              No live examinations right now. Your assigned experiment will show here once the teacher starts the test.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
