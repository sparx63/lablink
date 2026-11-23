"use client";

import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import { ROLE_LABEL } from "@/lib/format";

export default function StudentProfilePage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Profile & Settings</h1>
        <div className="panel mt-6 max-w-xl space-y-3 rounded-2xl p-5 text-sm">
          <div>
            <span className="text-[var(--ink-soft)]">Name</span>
            <div className="font-semibold">{user.name}</div>
          </div>
          <div>
            <span className="text-[var(--ink-soft)]">Email</span>
            <div className="font-semibold">{user.email}</div>
          </div>
          <div>
            <span className="text-[var(--ink-soft)]">Role</span>
            <div className="font-semibold">{ROLE_LABEL[user.role] || user.role}</div>
          </div>
          <div>
            <span className="text-[var(--ink-soft)]">Department / programme</span>
            <div className="font-semibold">
              {user.department}
              {user.programme ? ` · ${user.programme}` : ""}
            </div>
          </div>
          <div>
            <span className="text-[var(--ink-soft)]">Semester / section / batch</span>
            <div className="font-semibold">
              Sem {user.semester || "—"} · Sec {user.section || "—"} · Batch {user.batch || "—"}
            </div>
          </div>
          <div>
            <span className="text-[var(--ink-soft)]">Roll number</span>
            <div className="font-semibold">{user.rollNumber || "—"}</div>
          </div>
          <div>
            <span className="text-[var(--ink-soft)]">Academic standing</span>
            <div className="font-semibold">{user.academicStanding || "ACTIVE"}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
