"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";

export default function StudentResultsPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/exams?view=student-results&studentId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results || []));
  }, [user]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">My Results</h1>
        <p className="mt-2 text-[var(--ink-soft)]">Published practical marks only.</p>
        <div className="mt-6 space-y-3">
          {results.map((r) => (
            <article key={r.id} className="panel rounded-2xl p-5">
              <h2 className="text-lg font-semibold">{r.exam?.title || "Exam"}</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{r.experiment?.title}</p>
              <p className="mt-3 text-2xl font-semibold">
                {r.marksObtained} / {r.maxMarks}
              </p>
              {r.remarks && <p className="mt-2 text-sm text-[var(--ink-soft)]">{r.remarks}</p>}
            </article>
          ))}
          {!results.length && <p className="text-[var(--ink-soft)]">No published results yet.</p>}
        </div>
      </main>
    </div>
  );
}
