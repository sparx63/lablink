"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { cn, when } from "@/lib/format";

type QueueFilter = "BOTH" | "IN_LAB" | "BORROW";

export default function ApprovalsPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("BOTH");
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await fetch("/api/bookings").then((r) => r.json());
    setBookings(
      (data.bookings || []).filter((b: any) =>
        ["PENDING", "NEEDS_INFO", "AI_REVIEW", "READY_FOR_COLLECTION", "BORROWED", "OVERDUE", "RETURN_INSPECTION"].includes(
          b.status
        )
      )
    );
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  const visible = useMemo(() => {
    if (filter === "IN_LAB") return bookings.filter((b) => b.usageType === "IN_LAB");
    if (filter === "BORROW") return bookings.filter((b) => b.usageType === "BORROW");
    return bookings;
  }, [bookings, filter]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_INFO") {
    if (!user) return;
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decide",
        decision,
        approverId: user.id,
        note:
          decision === "APPROVED"
            ? "Faculty/admin approved"
            : decision === "NEEDS_INFO"
              ? "More information / evidence required"
              : "Rejected — capacity, safety or policy concern",
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `${decision}` : data.error);
    load();
  }

  async function handover(id: string, equipment: any) {
    if (!user) return;
    const checklist = (equipment?.accessoryChecklist || []).map((a: any) => ({
      accessoryId: a.id,
      label: a.label,
      present: true,
    }));
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "handover",
        actorId: user.id,
        checklist,
        photoUrls: [`https://placehold.co/640x360/png?text=Handover+${id}`],
        conditionNotes: "Issued in good condition",
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Handover recorded — custody transferred" : data.error);
    load();
  }

  async function completeReturn(id: string, equipment: any) {
    if (!user) return;
    const checklist = (equipment?.accessoryChecklist || []).map((a: any) => ({
      accessoryId: a.id,
      label: a.label,
      present: true,
    }));
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "return_inspect",
        actorId: user.id,
        returnCondition: "GOOD",
        checklist,
        photoUrls: [`https://placehold.co/640x360/png?text=Return+${id}`],
        conditionNotes: "Return inspection complete",
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Return inspection closed" : data.error);
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  const filters: { id: QueueFilter; label: string }[] = [
    { id: "IN_LAB", label: "In-lab booking" },
    { id: "BORROW", label: "Borrow request" },
    { id: "BOTH", label: "Both" },
  ];

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Request queue & custody</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          {user.role === "SUPER_ADMIN"
            ? "Campus-wide approvals for in-lab and borrow requests."
            : "Only requests for your assigned laboratories appear here. AI recommends; you decide."}
        </p>

        <div
          className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-[var(--line)] bg-white/80 p-1"
          role="tablist"
          aria-label="Request type filter"
        >
          {filters.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                filter === f.id
                  ? "bg-[var(--ink)] text-white shadow-sm"
                  : "text-[var(--ink-soft)] hover:bg-white"
              )}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--ink-soft)]">
          Showing {visible.length} of {bookings.length} queued item{bookings.length === 1 ? "" : "s"}
          {filter !== "BOTH" ? ` · filter: ${filters.find((f) => f.id === filter)?.label}` : ""}.
        </p>

        {msg && <p className="mt-3 text-sm text-emerald-800">{msg}</p>}
        <div className="mt-6 space-y-3">
          {visible.map((b) => (
            <article key={b.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                    {b.usageType === "BORROW" ? "Borrow request" : "In-lab booking"}
                  </div>
                  <h2 className="text-lg font-semibold">{b.equipment?.name}</h2>
                  <div className="text-sm text-[var(--ink-soft)]">
                    {b.student?.name} · {b.lab?.name} · {when(b.start)} → {when(b.end)}
                    {b.assignedUnitId ? ` · unit ${b.assignedUnitId}` : ""}
                  </div>
                  <p className="mt-2 text-sm">{b.purpose}</p>
                  {b.project && (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-2)]">
                      Project: {b.project.title} ({b.project.priority})
                    </p>
                  )}
                  {b.competition && (
                    <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/70 p-3 text-sm">
                      <div className="font-semibold">Competition verification</div>
                      <p className="mt-1 text-[var(--accent-2)]">{b.competition.aiPriorityReason}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusChip status={b.competition.verificationStatus} />
                        <span className="chip">{b.competition.name}</span>
                        <span className="chip">
                          Engine: {b.competition.verificationEngine || "HEURISTIC"}
                        </span>
                        {typeof b.competition.verificationConfidence === "number" && (
                          <span className="chip">
                            Confidence {Math.round(b.competition.verificationConfidence * 100)}%
                          </span>
                        )}
                      </div>
                      {b.competition.verificationNotes && (
                        <p className="mt-2 text-xs text-[var(--ink-soft)]">{b.competition.verificationNotes}</p>
                      )}
                      {!!b.competition.verificationSources?.length && (
                        <ul className="mt-2 list-disc pl-4 text-xs text-[var(--ink-soft)]">
                          {b.competition.verificationSources.map((s: string) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <StatusChip status={b.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["PENDING", "NEEDS_INFO", "AI_REVIEW"].includes(b.status) && (
                  <>
                    <button className="btn btn-primary" onClick={() => decide(b.id, "APPROVED")}>
                      Approve
                    </button>
                    <button className="btn btn-ghost" onClick={() => decide(b.id, "NEEDS_INFO")}>
                      Request info
                    </button>
                    <button className="btn btn-danger" onClick={() => decide(b.id, "REJECTED")}>
                      Reject
                    </button>
                  </>
                )}
                {b.status === "READY_FOR_COLLECTION" && (
                  <button className="btn btn-accent" onClick={() => handover(b.id, b.equipment)}>
                    Record handover
                  </button>
                )}
                {["BORROWED", "OVERDUE", "RETURN_INSPECTION"].includes(b.status) && (
                  <button className="btn btn-primary" onClick={() => completeReturn(b.id, b.equipment)}>
                    Complete return inspection
                  </button>
                )}
              </div>
            </article>
          ))}
          {!visible.length && (
            <p className="text-[var(--ink-soft)]">
              No {filter === "BOTH" ? "" : filter === "IN_LAB" ? "in-lab " : "borrow "}requests in your scope.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
