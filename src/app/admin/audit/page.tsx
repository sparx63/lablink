"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

const TYPES = [
  "",
  "IMPORT",
  "TIMETABLE_EDIT",
  "APPROVAL",
  "REJECT",
  "OVERRIDE",
  "HANDOVER",
  "RETURN",
  "MARK_EDIT",
  "PUBLICATION",
  "POLICY_CHANGE",
  "PROGRESSION",
  "EXAM_EDIT",
];

export default function AuditPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [type, setType] = useState("");
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = type ? `?type=${type}` : "";
    fetch(`/api/audit${q}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []));
  }, [user, type]);

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Audit log</h1>
        <p className="mt-2 text-[var(--ink-soft)]">Append-only governance trail.</p>
        <select className="select mt-4 max-w-xs" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t || "all"} value={t}>
              {t || "All types"}
            </option>
          ))}
        </select>
        <div className="mt-6 space-y-2">
          {events.map((e) => (
            <article key={e.id} className="panel rounded-2xl p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="chip">{e.type}</span>
                <span className="text-xs text-[var(--ink-soft)]">{when(e.createdAt)}</span>
              </div>
              <div className="mt-2 font-semibold">{e.summary}</div>
              <div className="text-xs text-[var(--ink-soft)]">
                {e.actorName} · {e.actorId}
              </div>
            </article>
          ))}
          {!events.length && <p className="text-[var(--ink-soft)]">No events.</p>}
        </div>
      </main>
    </div>
  );
}
