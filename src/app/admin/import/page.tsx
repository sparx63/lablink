"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";

export default function ImportPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [csv, setCsv] = useState("");
  const [sampleCsv, setSampleCsv] = useState("");
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user || user.role !== "SUPER_ADMIN") return;
    fetch("/api/import")
      .then((r) => r.json())
      .then((d) => {
        setSampleCsv(d.sampleCsv || "");
        setCsv(d.sampleCsv || "");
        setProgrammes(d.programmes || []);
        setStudents(d.students || []);
      });
  }, [user]);

  async function previewCsv() {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", csv }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setPreview(data);
      setMsg(data.valid ? "Preview valid" : "Fix row errors before import");
    }
  }

  async function doImport() {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", csv }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Imported ${data.created} new, ${data.updated} updated` : data.error);
  }

  async function progress(studentId: string, progressAction: string) {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "progress", studentId, progressAction }),
    });
    const data = await res.json();
    setMsg(res.ok ? `${progressAction} → sem ${data.student.semester}` : data.error);
    const d = await fetch("/api/import").then((r) => r.json());
    setStudents(d.students || []);
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;
  if (user.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen pb-16">
        <Nav user={user} />
        <main className="shell py-8">
          <h1 className="text-3xl font-semibold">Student import</h1>
          <p className="mt-2 text-[var(--ink-soft)]">Central admin only.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">CSV student master import</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Upload/paste CSV (student id, name, email, department, programme, batch, semester, section, lab enrolments).
        </p>
        {msg && <p className="mt-3 text-sm text-emerald-800">{msg}</p>}

        <textarea className="textarea mt-6 min-h-[220px] w-full font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => setCsv(sampleCsv)}>
            Load sample CSV
          </button>
          <button className="btn btn-ghost" onClick={previewCsv}>
            Preview / validate
          </button>
          <button className="btn btn-primary" onClick={doImport}>
            Import into store
          </button>
        </div>

        {preview && (
          <div className="panel mt-6 overflow-x-auto rounded-2xl p-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {preview.headers?.map((h: string) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                  <th className="p-2">errors</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows?.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-[var(--line)]">
                    <td className="p-2">{r.studentId}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.email}</td>
                    <td className="p-2">{r.department}</td>
                    <td className="p-2">{r.programme}</td>
                    <td className="p-2">{r.batch}</td>
                    <td className="p-2">{r.semester}</td>
                    <td className="p-2">{r.section}</td>
                    <td className="p-2 max-w-[180px] truncate">{r.labEnrolments}</td>
                    <td className="p-2 text-[var(--bad)]">{r.errors?.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Programme calendar</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {programmes.map((p) => (
              <div key={p.id} className="panel rounded-2xl p-4 text-sm">
                <div className="font-semibold">{p.name}</div>
                <div className="text-[var(--ink-soft)]">
                  {p.durationYears}y · {p.totalSemesters} semesters · current {p.currentAcademicYear}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-[var(--ink-soft)]">
                  {p.yearSemesterMap.map((y: any) => (
                    <li key={y.academicYear}>
                      {y.academicYear}: Sem {y.semesters.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Academic progression</h2>
          <div className="mt-3 space-y-2">
            {students.map((s) => (
              <div key={s.id} className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div className="text-sm">
                  <div className="font-semibold">
                    {s.name} · {s.rollNumber}
                  </div>
                  <div className="text-[var(--ink-soft)]">
                    Sem {s.semester} · {s.academicStanding || "ACTIVE"}
                    {s.backlogSemesters?.length ? ` · backlog [${s.backlogSemesters.join(",")}]` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => progress(s.id, "PROMOTE")}>
                    Promote
                  </button>
                  <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => progress(s.id, "BACKLOG")}>
                    Backlog
                  </button>
                  <button
                    className="btn btn-ghost !py-1.5 text-sm"
                    onClick={() =>
                      fetch("/api/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "progress",
                          studentId: s.id,
                          progressAction: "CORRECT",
                          patch: { semester: s.semester, academicStanding: "ACTIVE", backlogSemesters: [] },
                        }),
                      }).then(() => progress(s.id, "CORRECT"))
                    }
                  >
                    Clear backlog
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
