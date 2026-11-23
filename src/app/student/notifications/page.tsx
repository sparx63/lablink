"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import { when } from "@/lib/format";

export default function StudentNotificationsPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const d = await fetch("/api/notifications").then((r) => r.json());
    setItems(d.notifications || []);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <div className="mt-6 space-y-3">
          {items.map((n) => (
            <article key={n.id} className="panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{n.body}</p>
                  <div className="mt-2 text-xs text-[var(--ink-soft)]">{when(n.createdAt)}</div>
                </div>
                {!n.read && (
                  <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => markRead(n.id)}>
                    Mark read
                  </button>
                )}
              </div>
            </article>
          ))}
          {!items.length && <p className="text-[var(--ink-soft)]">Inbox clear.</p>}
        </div>
      </main>
    </div>
  );
}
