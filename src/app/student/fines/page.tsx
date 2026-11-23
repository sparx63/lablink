"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { inr, when } from "@/lib/format";

export default function StudentFinesPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [fines, setFines] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    if (!user) return;
    const data = await fetch(`/api/fines?studentId=${user.id}`).then((r) => r.json());
    setFines(data.fines || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function pay(fineId: string, amount: number) {
    const res = await fetch("/api/fines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "update", fineId, patch: { paidAmount: amount, status: "PAID" } }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Payment recorded" : data.error);
    // refresh session balance via reload path
    await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user!.id }) });
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Fines & accountability</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Lost, broken, or damaged equipment after use triggers an admin-set fine. Outstanding balances block new bookings.
        </p>
        <div className="mt-4 panel rounded-2xl p-4 text-sm">
          Current balance: <strong>{inr(user.fineBalance)}</strong>
        </div>
        {msg && <p className="mt-3 text-sm text-emerald-800">{msg}</p>}
        <div className="mt-6 space-y-3">
          {fines.map((f) => (
            <article key={f.id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{f.equipment?.name}</h2>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{f.reason}</p>
                  <p className="mt-2 text-sm">Due {when(f.dueDate)} · Assessed {inr(f.amount)}</p>
                </div>
                <StatusChip status={f.status} />
              </div>
              {(f.status === "PENDING" || f.status === "PARTIAL") && (
                <button className="btn btn-primary mt-4" onClick={() => pay(f.id, f.amount)}>
                  Pay {inr(f.amount - f.paidAmount)}
                </button>
              )}
            </article>
          ))}
          {!fines.length && <p className="text-[var(--ink-soft)]">No fines on your account. Keep returns clean.</p>}
        </div>
      </main>
    </div>
  );
}
