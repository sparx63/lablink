"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import { DAY_LABEL, LAB_CATEGORY_LABEL, TIMETABLE_EVENT_TYPE_LABEL, formatHourRange } from "@/lib/format";

export default function StudentTimetablePage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/timetable?studentId=${user.id}`)
      .then((r) => r.json())
      .then(setData);
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">My Lab Timetable</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Only practical sessions for classes you are enrolled in. Other labs appear under{" "}
          <strong className="font-medium text-[var(--ink)]">View Laboratory Timetable</strong> when you book or
          borrow equipment there — they do not show on this page.
        </p>

        <section className="mt-6 panel rounded-2xl p-5">
          <h2 className="text-xl font-semibold">Enrolled lab classes</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(data?.enrollments || []).map((en: any) => (
              <div key={en.id} className="rounded-xl border border-[var(--line)] p-3">
                <div className="font-semibold">{en.subject}</div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {en.lab?.name} · {LAB_CATEGORY_LABEL[en.lab?.category] || ""} · {en.cohort}
                </div>
                <div className="mt-1 text-xs text-[var(--ink-soft)]">
                  {en.academicYear} · Sem {en.semester} · Faculty {en.faculty?.name || "—"}
                </div>
              </div>
            ))}
            {!data?.enrollments?.length && (
              <p className="text-sm text-[var(--ink-soft)]">No lab-class enrolments on file for this academic year.</p>
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Weekly practical schedule</h2>
          <div className="mt-4 space-y-3">
            {(data?.schedule || [])
              .filter((row: any) => row?.event)
              .map((row: any) => (
                <article
                  key={`${row.enrollment?.id || "en"}-${row.event.id}`}
                  className="panel rounded-2xl p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">
                      {row.event.eventDate
                        ? `${row.event.eventDate} (${DAY_LABEL[row.event.dayOfWeek] || "?"})`
                        : DAY_LABEL[row.event.dayOfWeek] || "—"}{" "}
                      · {formatHourRange(row.event.startHour, row.event.endHour)}
                    </div>
                    <span className="chip">
                      {TIMETABLE_EVENT_TYPE_LABEL[row.event.eventType] || row.event.eventType}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    {row.event.title} · {row.lab?.name}
                  </div>
                  <div className="text-sm text-[var(--ink-soft)]">
                    {row.event.subject} · {row.event.cohort}
                  </div>
                </article>
              ))}
            {!data?.schedule?.filter((r: any) => r?.event).length && (
              <p className="text-[var(--ink-soft)]">No timetable events linked to your enrolments yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
