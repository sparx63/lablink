"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

export default function AdminAiAllocatePage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [labs, setLabs] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [labId, setLabId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [durationHours, setDurationHours] = useState(2);
  const [engine, setEngine] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.role === "TIMETABLE_COORDINATOR") {
      setMsg("Timetable coordinators do not have AI Allocate access.");
      return;
    }
    Promise.all([
      fetch("/api/labs").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/session").then((r) => r.json()),
    ]).then(([lab, eq, sess]) => {
      const list = lab.labs || [];
      setLabs(list);
      setEquipment(eq.equipment || []);
      setStudents((sess.users || []).filter((u: any) => u.role === "STUDENT"));
      if (list[0]) setLabId(list[0].id);
    });
  }, [user]);

  const labEquipment = useMemo(
    () => equipment.filter((e) => e.labId === labId),
    [equipment, labId]
  );

  useEffect(() => {
    if (!labEquipment.length) {
      setEquipmentId("");
      return;
    }
    if (!labEquipment.some((e) => e.id === equipmentId)) {
      setEquipmentId(labEquipment[0].id);
    }
  }, [labEquipment, equipmentId]);

  async function run() {
    if (!user || !labId || !equipmentId) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/ai/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId,
        equipmentId,
        studentId: studentId || undefined,
        durationHours,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Allocation failed");
      return;
    }
    setEngine(data.engine);
    setSuggestions(data.suggestions || []);
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  if (user.role === "TIMETABLE_COORDINATOR") {
    return (
      <div className="min-h-screen pb-16">
        <Nav user={user} />
        <main className="shell py-8">
          <h1 className="text-3xl font-semibold">Equipment AI</h1>
          <p className="mt-2 text-[var(--ink-soft)]">
            This desk is limited to lab teachers, lab admins, and central admin.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Equipment AI</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Staff GenAI for equipment inventory matching — pick a lab, then choose the component you need.
          For random exam experiment assignment, use{" "}
          <a className="underline" href="/admin/exams#generate-list">
            Exams → Generate experiment list
          </a>
          .
        </p>

        <div className="panel mt-6 grid gap-4 rounded-2xl p-5 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">Laboratory</span>
            <select className="select mt-1 w-full" value={labId} onChange={(e) => setLabId(e.target.value)}>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-semibold">What do you need?</span>
            <select
              className="select mt-1 w-full"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              {labEquipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.tag}
                  {e.quantity > 1 ? ` (${e.quantity} units)` : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-[var(--ink-soft)]">
              Options are limited to equipment in the selected lab.
            </span>
          </label>

          <label className="block text-sm">
            <span className="font-semibold">Student (optional fairness check)</span>
            <select className="select mt-1 w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">— inventory only —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.rollNumber || s.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-semibold">Duration (hours)</span>
            <input
              className="input mt-1 w-full"
              type="number"
              min={1}
              max={8}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value) || 2)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={busy || !equipmentId} onClick={run}>
            {busy ? "Running…" : "Run allocation"}
          </button>
          {engine && <span className="chip">Engine: {engine}</span>}
          {msg && <span className="text-sm text-[var(--bad)]">{msg}</span>}
        </div>

        <div className="mt-8 space-y-3">
          {suggestions.map((s) => (
            <article key={s.equipmentId} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    {equipment.find((e) => e.id === s.equipmentId)?.name || s.equipmentId}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    Score {s.score} · {when(s.suggestedStart)} → {when(s.suggestedEnd)}
                  </p>
                </div>
                <span className="chip">{s.labId}</span>
              </div>
              <p className="mt-3 text-sm">{s.rationale}</p>
              {s.fairnessNotes && (
                <p className="mt-2 text-xs text-[var(--accent-2)]">{s.fairnessNotes}</p>
              )}
              {!!s.conflicts?.length && (
                <ul className="mt-2 list-disc pl-5 text-xs text-[var(--bad)]">
                  {s.conflicts.map((c: string) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
          {!suggestions.length && (
            <p className="text-sm text-[var(--ink-soft)]">Select a component and run allocation to see ranked slots.</p>
          )}
        </div>
      </main>
    </div>
  );
}
