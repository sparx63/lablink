"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { inr, when } from "@/lib/format";

export default function IncidentsPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [bookings, setBookings] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [form, setForm] = useState({
    bookingId: "",
    type: "BROKEN",
    severity: "MEDIUM",
    description: "",
    fineAmount: 5000,
    fineReason: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const [b, f] = await Promise.all([
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/fines").then((r) => r.json()),
    ]);
    setBookings(
      (b.bookings || []).filter((x: any) => ["ACTIVE", "COMPLETED", "APPROVED"].includes(x.status))
    );
    setFines(f.fines || []);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function submitIncident() {
    if (!user) return;
    const res = await fetch("/api/fines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "incident",
        bookingId: form.bookingId,
        reportedById: user.id,
        type: form.type,
        severity: form.severity,
        description: form.description,
        fineAmount: Number(form.fineAmount),
        fineReason: form.fineReason || undefined,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Incident logged${data.fine ? ` + fine ${inr(data.fine.amount)}` : ""}` : data.error);
    load();
  }

  async function waive(fineId: string) {
    await fetch("/api/fines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "update", fineId, patch: { status: "WAIVED" } }),
    });
    setMsg("Fine waived");
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Incidents & fine desk</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          When equipment is lost or broken after student use, the lab in-charge sets the fine. Quarantine locks the asset
          until resolved. {user.role !== "SUPER_ADMIN" ? "Only incidents in your assigned labs are listed." : ""}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="panel rounded-2xl p-5 space-y-3">
            <h2 className="text-xl font-semibold">File incident</h2>
            <label className="block text-sm font-semibold">
              Related booking
              <select
                className="select mt-1"
                value={form.bookingId}
                onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
              >
                <option value="">Select booking</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.equipment?.name} · {b.student?.name} · {b.status}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Type
                <select className="select mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {["LOST", "BROKEN", "DAMAGED", "MISSING_PARTS", "CONTAMINATED"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Severity
                <select
                  className="select mt-1"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Description
              <textarea
                className="textarea mt-1"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              Fine amount (₹) — decided by administration
              <input
                type="number"
                className="input mt-1"
                value={form.fineAmount}
                onChange={(e) => setForm({ ...form, fineAmount: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm font-semibold">
              Fine rationale
              <input
                className="input mt-1"
                value={form.fineReason}
                onChange={(e) => setForm({ ...form, fineReason: e.target.value })}
                placeholder="Partial replacement / deposit forfeiture…"
              />
            </label>
            <button className="btn btn-primary" onClick={submitIncident} disabled={!form.bookingId || !form.description}>
              Log incident & set fine
            </button>
            {msg && <p className="text-sm text-emerald-800">{msg}</p>}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Fine ledger</h2>
            {fines.map((f) => (
              <article key={f.id} className="panel rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {f.student?.name} · {inr(f.amount)}
                    </div>
                    <div className="text-sm text-[var(--ink-soft)]">
                      {f.equipment?.name} · due {when(f.dueDate)}
                    </div>
                    <p className="mt-2 text-sm">{f.reason}</p>
                  </div>
                  <StatusChip status={f.status} />
                </div>
                {(f.status === "PENDING" || f.status === "PARTIAL") && (
                  <button className="btn btn-ghost mt-3 !py-2" onClick={() => waive(f.id)}>
                    Waive
                  </button>
                )}
              </article>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
