"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";

export default function PoliciesPage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [policies, setPolicies] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies));
  }, []);

  async function save() {
    const res = await fetch("/api/policies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policies }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Policies saved" : data.error);
    if (res.ok) setPolicies(data.policies);
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;
  if (user.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen pb-16">
        <Nav user={user} />
        <main className="shell py-8">
          <h1 className="text-3xl font-semibold">Policies</h1>
          <p className="mt-2 text-[var(--ink-soft)]">Central admin only.</p>
        </main>
      </div>
    );
  }
  if (!policies) return <div className="shell py-20">Loading policies…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Institutional policies</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Priority weights feed the AI allocator; borrow limits and evidence toggles gate requests.
        </p>
        {msg && <p className="mt-3 text-sm text-emerald-800">{msg}</p>}

        <div className="panel mt-6 grid gap-4 rounded-2xl p-5 md:grid-cols-2">
          {(["LOW", "MEDIUM", "HIGH", "CRITICAL", "COMPETITION_BONUS", "PERSONAL_PROJECT_PENALTY"] as const).map(
            (k) => (
              <label key={k} className="text-sm">
                <span className="font-semibold">{k}</span>
                <input
                  className="input mt-1 w-full"
                  type="number"
                  value={policies.priorityWeights[k]}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      priorityWeights: { ...policies.priorityWeights, [k]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            )
          )}
          <label className="text-sm">
            <span className="font-semibold">Max borrow duration (days)</span>
            <input
              className="input mt-1 w-full"
              type="number"
              value={policies.maxBorrowDurationDays}
              onChange={(e) => setPolicies({ ...policies, maxBorrowDurationDays: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={policies.evidenceRequirements.competitionWebsiteRequired}
              onChange={(e) =>
                setPolicies({
                  ...policies,
                  evidenceRequirements: {
                    ...policies.evidenceRequirements,
                    competitionWebsiteRequired: e.target.checked,
                  },
                })
              }
            />
            Competition website required
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={policies.evidenceRequirements.selectionEvidenceRequired}
              onChange={(e) =>
                setPolicies({
                  ...policies,
                  evidenceRequirements: {
                    ...policies.evidenceRequirements,
                    selectionEvidenceRequired: e.target.checked,
                  },
                })
              }
            />
            Selection evidence required
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={policies.evidenceRequirements.projectLinkRequiredForCollege}
              onChange={(e) =>
                setPolicies({
                  ...policies,
                  evidenceRequirements: {
                    ...policies.evidenceRequirements,
                    projectLinkRequiredForCollege: e.target.checked,
                  },
                })
              }
            />
            Project link required for college project borrows
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-semibold">Cancellation rules summary</span>
            <textarea
              className="textarea mt-1 w-full"
              rows={4}
              value={policies.cancellationRulesSummary}
              onChange={(e) => setPolicies({ ...policies, cancellationRulesSummary: e.target.value })}
            />
          </label>
        </div>
        <button className="btn btn-primary mt-4" onClick={save}>
          Save policies
        </button>
      </main>
    </div>
  );
}
