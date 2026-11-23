"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ROLE_LABEL } from "@/lib/format";
import type { User } from "@/lib/types";

type Gate = "CHOOSE" | "STUDENT" | "STAFF";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const preferred = params.get("role");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<Gate>(() => {
    if (preferred === "STUDENT") return "STUDENT";
    if (preferred === "ADMIN" || preferred === "STAFF" || preferred === "FACULTY") return "STAFF";
    return "CHOOSE";
  });

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (gate === "STUDENT") return users.filter((u) => u.role === "STUDENT");
    if (gate === "STAFF") {
      return users
        .filter((u) => u.role !== "STUDENT")
        .sort((a, b) => {
          const order = ["SUPER_ADMIN", "ADMIN", "FACULTY", "TIMETABLE_COORDINATOR"];
          return order.indexOf(a.role) - order.indexOf(b.role);
        });
    }
    return [];
  }, [users, gate]);

  async function enter(userId: string, role: User["role"]) {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.push(role === "STUDENT" ? "/student" : "/admin");
  }

  return (
    <div className="min-h-screen">
      <Nav user={null} />
      <main className="shell py-12">
        {gate === "CHOOSE" ? (
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold">Enter LabLink</h1>
            <p className="mt-3 text-[var(--ink-soft)]">
              Choose how you want to sign in. Students explore every campus lab; teachers and lab admins only manage
              their assigned laboratories.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => setGate("STUDENT")}
                className="panel rounded-2xl p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Path 1</div>
                <h2 className="mt-2 text-2xl font-semibold">Student</h2>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  Discover equipment across all departments, book in-lab slots, request borrowing, and view your lab
                  timetable.
                </p>
              </button>
              <button
                onClick={() => setGate("STAFF")}
                className="panel rounded-2xl p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-2)]">Path 2</div>
                <h2 className="mt-2 text-2xl font-semibold">Teacher / Admin</h2>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  Lab teachers manage assigned labs; timetable coordinators publish schedules; central admin retains
                  campus-wide oversight.
                </p>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-2xl">
              <button className="text-sm font-semibold text-[var(--accent)]" onClick={() => setGate("CHOOSE")}>
                ← Back to Student / Teacher choice
              </button>
              <h1 className="mt-3 text-4xl font-semibold">
                {gate === "STUDENT" ? "Choose a student persona" : "Choose a teacher or admin"}
              </h1>
              <p className="mt-3 text-[var(--ink-soft)]">
                Demo auth for the hackathon — pick an account to explore the matching dashboard.
              </p>
            </div>

            <div className="mt-8 grid gap-3">
              {loading && <div className="panel rounded-2xl p-6 text-[var(--ink-soft)]">Loading directory…</div>}
              {filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => enter(u.id, u.role)}
                  className="panel flex w-full items-center gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: u.avatarColor }}
                  >
                    {u.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-[var(--ink-soft)]">
                      {ROLE_LABEL[u.role] || u.role} · {u.department}
                      {u.managedLabIds?.length
                        ? ` · ${u.managedLabIds.length} assigned lab${u.managedLabIds.length > 1 ? "s" : ""}`
                        : u.role === "SUPER_ADMIN"
                          ? " · campus-wide"
                          : ""}
                      {u.fineBalance > 0 ? ` · Fine due ₹${u.fineBalance}` : ""}
                    </div>
                  </div>
                  <span className="chip">
                    {u.role === "STUDENT"
                      ? "Student dashboard"
                      : u.role === "SUPER_ADMIN"
                        ? "Central ops"
                        : u.role === "TIMETABLE_COORDINATOR"
                          ? "Timetable desk"
                          : "Lab ops"}
                  </span>
                </button>
              ))}
              {!loading && !filtered.length && (
                <div className="panel rounded-2xl p-6 text-[var(--ink-soft)]">No personas in this path.</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
