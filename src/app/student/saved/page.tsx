"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";

export default function SavedResourcesPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [saved, setSaved] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const d = await fetch(`/api/saved?studentId=${user.id}`).then((r) => r.json());
    setSaved(d.saved || []);
  }

  useEffect(() => {
    if (!user) return;
    fetch(`/api/saved?studentId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setSaved(d.saved || []));
  }, [user]);

  async function unsave(item: any) {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: item.equipmentId, labId: item.labId }),
    });
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Saved Resources</h1>
        <p className="mt-2 text-[var(--ink-soft)]">Bookmarked equipment and laboratories.</p>
        <div className="mt-6 space-y-3">
          {saved.map((s) => (
            <article key={s.id} className="panel flex items-center justify-between gap-3 rounded-2xl p-5">
              <div>
                <div className="font-semibold">{s.equipment?.name || s.lab?.name}</div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {s.equipment ? `Equipment · ${s.lab?.name || s.equipment.labId}` : `Lab · ${s.lab?.code}`}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => unsave(s)}>
                Remove
              </button>
            </article>
          ))}
          {!saved.length && <p className="text-[var(--ink-soft)]">No saved resources yet.</p>}
        </div>
      </main>
    </div>
  );
}
