"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";

type GenMode = "INDIVIDUAL" | "GROUP";

export default function AdminExamsPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [exams, setExams] = useState<any[]>([]);
  const [bank, setBank] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [allocExamId, setAllocExamId] = useState("");
  const [allocStudentId, setAllocStudentId] = useState("");
  const [allocExperimentId, setAllocExperimentId] = useState("");
  const [markExamId, setMarkExamId] = useState("");
  const [markStudentId, setMarkStudentId] = useState("");
  const [markExperimentId, setMarkExperimentId] = useState("");
  const [marks, setMarks] = useState(18);

  // Generate experiment list
  const [genExamId, setGenExamId] = useState("");
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [genMode, setGenMode] = useState<GenMode>("GROUP");
  const [groupSize, setGroupSize] = useState(2);
  const [genBusy, setGenBusy] = useState(false);
  const [genPreview, setGenPreview] = useState<any | null>(null);
  const [rosterCount, setRosterCount] = useState(0);

  const genExam = useMemo(() => exams.find((e) => e.id === genExamId), [exams, genExamId]);
  const labBank = useMemo(() => {
    if (!genExam) return bank;
    return bank.filter((b) => b.labId === genExam.labId);
  }, [bank, genExam]);

  async function load() {
    const [ex, sess] = await Promise.all([
      fetch("/api/exams").then((r) => r.json()),
      fetch("/api/session").then((r) => r.json()),
    ]);
    const examList = ex.exams || [];
    setExams(examList);
    setBank(ex.bank || []);
    setStudents((sess.users || []).filter((u: any) => u.role === "STUDENT"));
    if (examList[0]) {
      setAllocExamId((prev) => prev || examList[0].id);
      setGenExamId((prev) => prev || examList[0].id);
      setMarkExamId((prev) => prev || examList[0].id);
    }
    if ((ex.bank || [])[0]) setAllocExperimentId((prev) => prev || ex.bank[0].id);
  }

  useEffect(() => {
    if (user && user.role !== "TIMETABLE_COORDINATOR") load();
  }, [user]);

  useEffect(() => {
    if (!genExam?.labId) {
      setRosterCount(0);
      return;
    }
    const labExps = bank.filter((b) => b.labId === genExam.labId && b.active !== false);
    setSelectedExpIds((prev) => {
      const stillValid = prev.filter((id) => labExps.some((b) => b.id === id));
      if (stillValid.length) return stillValid;
      return labExps.slice(0, Math.min(3, labExps.length)).map((b) => b.id);
    });
    fetch(`/api/exams?view=roster&labId=${genExam.labId}`)
      .then((r) => r.json())
      .then((d) => setRosterCount((d.roster || []).length))
      .catch(() => setRosterCount(0));
  }, [genExam?.labId, bank]);

  async function act(action: string, body: Record<string, unknown> = {}) {
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    setMsg(res.ok ? `${action} ok` : data.error);
    load();
  }

  function toggleExp(id: string) {
    setSelectedExpIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function generateList(save: boolean) {
    if (!genExamId || !selectedExpIds.length) {
      setMsg("Select an exam and at least one experiment");
      return;
    }
    setGenBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: genExamId,
          experimentIds: selectedExpIds,
          mode: genMode,
          groupSize: genMode === "GROUP" ? groupSize : undefined,
          save,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Generate failed");
        setGenPreview(null);
        return;
      }
      setGenPreview(data);
      setMsg(
        save
          ? `Saved ${data.allocations?.length || 0} allocations — Start the test when ready`
          : `Generated preview (${data.groups?.length || 0} ${genMode === "GROUP" ? "groups" : "students"}) — save to persist`
      );
      if (save) load();
    } finally {
      setGenBusy(false);
    }
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;
  if (user.role === "TIMETABLE_COORDINATOR") {
    return (
      <div className="min-h-screen pb-16">
        <Nav user={user} />
        <main className="shell py-8">
          <h1 className="text-3xl font-semibold">Practical exams</h1>
          <p className="mt-2 text-[var(--ink-soft)]">Exam management is for lab teachers and admins.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Practical exams & experiment bank</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Generate a random experiment list for the exam roster, save it, then click <strong>Start the test</strong> so
          students see their assignment on My Examinations.
        </p>
        {msg && <p className="mt-3 text-sm text-emerald-800">{msg}</p>}

        <section id="generate-list" className="panel mt-8 rounded-2xl p-5">
          <h2 className="text-xl font-semibold">Generate experiment list</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Multi-select experiments from your lab bank, choose Individual or Group mode, then randomly assign so each
            experiment is used roughly equally.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Exam</span>
              <select
                className="select mt-1 w-full"
                value={genExamId}
                onChange={(e) => {
                  setGenExamId(e.target.value);
                  setGenPreview(null);
                }}
              >
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.lab?.name || e.labId})
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm text-[var(--ink-soft)] md:pt-7">
              Enrolled roster: <strong className="text-[var(--ink)]">{rosterCount}</strong> student
              {rosterCount === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">Experiments in this exam</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {labBank.map((b) => {
                const on = selectedExpIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      on ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--line)] bg-white/70"
                    }`}
                  >
                    <input type="checkbox" className="mt-1" checked={on} onChange={() => toggleExp(b.id)} />
                    <span>
                      <span className="font-semibold">
                        {b.code} · {b.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{b.durationMinutes} min</span>
                    </span>
                  </label>
                );
              })}
              {!labBank.length && (
                <p className="text-sm text-[var(--ink-soft)]">No experiments in the bank for this lab.</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <fieldset className="text-sm">
              <legend className="font-medium">Mode</legend>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="genMode"
                    checked={genMode === "INDIVIDUAL"}
                    onChange={() => setGenMode("INDIVIDUAL")}
                  />
                  Individual
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="genMode"
                    checked={genMode === "GROUP"}
                    onChange={() => setGenMode("GROUP")}
                  />
                  Group
                </label>
              </div>
            </fieldset>
            {genMode === "GROUP" && (
              <label className="text-sm">
                <span className="font-medium">Students per group</span>
                <input
                  className="input mt-1 w-24"
                  type="number"
                  min={2}
                  max={12}
                  value={groupSize}
                  onChange={(e) => setGroupSize(Math.max(2, Number(e.target.value) || 2))}
                />
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              disabled={genBusy || !genExamId || !selectedExpIds.length}
              onClick={() => generateList(false)}
            >
              {genBusy ? "Working…" : genPreview ? "Regenerate list" : "Generate list"}
            </button>
            <button
              className="btn btn-accent"
              disabled={genBusy || !genPreview}
              onClick={() => generateList(true)}
            >
              Save allocations
            </button>
          </div>

          {genPreview?.groups?.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                    <th className="py-2 pr-3">{genMode === "GROUP" ? "Group" : "#"}</th>
                    <th className="py-2 pr-3">Students</th>
                    <th className="py-2">Experiment</th>
                  </tr>
                </thead>
                <tbody>
                  {genPreview.groups.map((g: any, idx: number) => (
                    <tr key={idx} className="border-b border-[var(--line)]/70">
                      <td className="py-2.5 pr-3 font-medium">{g.groupLabel || idx + 1}</td>
                      <td className="py-2.5 pr-3">
                        {(g.students || []).map((s: any) => s.name).join(", ") || g.studentIds?.join(", ")}
                      </td>
                      <td className="py-2.5">
                        <span className="font-semibold">{g.experiment?.code}</span>
                        {g.experiment?.title ? ` · ${g.experiment.title}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {genPreview.saved && (
                <p className="mt-2 text-xs text-emerald-800">Allocations saved to the exam. Students see them after Start the test.</p>
              )}
            </div>
          )}
        </section>

        <div className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Scheduled exams</h2>
          {exams.map((ex) => (
            <article key={ex.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{ex.title}</h2>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {ex.lab?.name} · {ex.examDate} · {ex.startHour}:00–{ex.endHour}:00 · {ex.allocations?.length || 0}{" "}
                    allocations
                  </p>
                </div>
                <StatusChip status={ex.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["DRAFT", "SCHEDULED"].includes(ex.status) && (
                  <button className="btn btn-primary" onClick={() => act("start", { examId: ex.id })}>
                    Start the test
                  </button>
                )}
                {ex.status === "LIVE" && (
                  <button className="btn btn-ghost" onClick={() => act("end", { examId: ex.id })}>
                    End test
                  </button>
                )}
                {["LIVE", "COMPLETED"].includes(ex.status) && (
                  <button className="btn btn-accent" onClick={() => act("publish", { examId: ex.id })}>
                    Publish results
                  </button>
                )}
                <a className="btn btn-ghost" href="#generate-list" onClick={() => setGenExamId(ex.id)}>
                  Generate list
                </a>
              </div>
            </article>
          ))}
        </div>

        <section className="panel mt-8 rounded-2xl p-5">
          <h2 className="text-xl font-semibold">Manual allocate (single student)</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select className="select" value={allocExamId} onChange={(e) => setAllocExamId(e.target.value)}>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <select className="select" value={allocStudentId} onChange={(e) => setAllocStudentId(e.target.value)}>
              <option value="">Student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={allocExperimentId}
              onChange={(e) => setAllocExperimentId(e.target.value)}
            >
              {bank.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.title}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary mt-4"
            disabled={!allocExamId || !allocStudentId || !allocExperimentId}
            onClick={() =>
              act("allocate", {
                allocation: {
                  examId: allocExamId,
                  studentId: allocStudentId,
                  experimentId: allocExperimentId,
                  groupLabel: "Batch A",
                },
              })
            }
          >
            Save allocation
          </button>
        </section>

        <section className="panel mt-6 rounded-2xl p-5">
          <h2 className="text-xl font-semibold">Enter marks</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select className="select" value={markExamId || allocExamId} onChange={(e) => setMarkExamId(e.target.value)}>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <select className="select" value={markStudentId} onChange={(e) => setMarkStudentId(e.target.value)}>
              <option value="">Student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={markExperimentId || allocExperimentId}
              onChange={(e) => setMarkExperimentId(e.target.value)}
            >
              {bank.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
            <input className="input" type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
          </div>
          <button
            className="btn btn-primary mt-4"
            disabled={!markStudentId}
            onClick={() =>
              act("mark", {
                mark: {
                  examId: markExamId || allocExamId,
                  studentId: markStudentId,
                  experimentId: markExperimentId || allocExperimentId,
                  marksObtained: marks,
                  maxMarks: bank.find((b) => b.id === (markExperimentId || allocExperimentId))?.maxMarks || 25,
                },
              })
            }
          >
            Save marks
          </button>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Experiment bank</h2>
          <div className="mt-3 space-y-2">
            {bank.map((b) => (
              <div key={b.id} className="rounded-xl border border-[var(--line)] bg-white/70 p-3 text-sm">
                <div className="font-semibold">
                  {b.code} · {b.title}
                </div>
                <div className="text-[var(--ink-soft)]">
                  {b.labId} · max {b.maxMarks} · {b.durationMinutes} min
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
