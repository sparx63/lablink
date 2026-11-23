"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusChip } from "@/components/StatusChip";
import { useSession } from "@/hooks/useSession";
import { DAY_LABEL, LAB_CATEGORY_LABEL, formatHourRange, inr, when } from "@/lib/format";

type Mode = "IN_LAB" | "BORROW" | null;

export default function DiscoverPage() {
  const { user, ready } = useSession({ require: "STUDENT" });
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingEq, setBookingEq] = useState<any>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [showTimetable, setShowTimetable] = useState(false);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [form, setForm] = useState({
    purpose: "",
    start: "",
    end: "",
    notes: "",
    borrowPurpose: "COLLEGE_PROJECT",
    expectedReturnAt: "",
    competitionName: "",
    competitionOrganiser: "",
    competitionDate: "",
    competitionWebsite: "",
    competitionProject: "",
  });

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const [eq, lab] = await Promise.all([
      fetch(`/api/equipment?${params}`).then((r) => r.json()),
      fetch("/api/labs").then((r) => r.json()),
    ]);
    setItems(eq.equipment || []);
    setLabs(lab.labs || []);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function openFlow(eq: any, nextMode: Mode) {
    setBookingEq(eq);
    setMode(nextMode);
    setShowTimetable(false);
    setMessage("");
    setMessageIsError(false);
    if (eq?.labId) {
      const data = await fetch(`/api/timetable?labId=${eq.labId}`).then((r) => r.json());
      setTimetable(data.events || []);
    }
  }

  function parseLocalDateTime(value: string, label: string): string {
    if (!value?.trim()) throw new Error(`${label} is required`);
    const d = new Date(value);
    if (Number.isNaN(+d)) throw new Error(`${label} is invalid`);
    return d.toISOString();
  }

  function canSubmit(): boolean {
    if (!form.start) return false;
    if (mode === "BORROW") {
      if (!form.expectedReturnAt) return false;
      if (form.borrowPurpose === "COMPETITION") {
        return !!(form.competitionName.trim() && form.competitionOrganiser.trim() && form.competitionDate);
      }
      return !!form.purpose.trim();
    }
    return !!(form.purpose.trim() && form.end);
  }

  async function submitBooking() {
    if (!user || !bookingEq || !mode || submitting) return;
    setMessage("");
    setMessageIsError(false);
    setSubmitting(true);
    try {
      if (mode === "IN_LAB") {
        if (!form.purpose.trim()) throw new Error("Purpose / reason is required");
        if (!form.start || !form.end) throw new Error("Start and end times are required");
      } else {
        if (!form.start || !form.expectedReturnAt) {
          throw new Error("Borrow / collect and expected return times are required");
        }
        if (form.borrowPurpose === "COMPETITION") {
          if (!form.competitionName.trim() || !form.competitionOrganiser.trim() || !form.competitionDate) {
            throw new Error("Competition name, organiser and date are required");
          }
        } else if (!form.purpose.trim()) {
          throw new Error("Purpose / reason is required for this borrow type");
        }
      }

      const purposeText =
        form.purpose.trim() ||
        (form.borrowPurpose === "COMPETITION"
          ? `Competition: ${form.competitionName.trim()} (${form.competitionOrganiser.trim()})`
          : "");
      if (!purposeText) throw new Error("Purpose / reason is required");

      const startIso = parseLocalDateTime(form.start, mode === "BORROW" ? "Borrow / collect time" : "Start time");
      const endIso =
        mode === "BORROW"
          ? parseLocalDateTime(form.expectedReturnAt, "Expected return time")
          : parseLocalDateTime(form.end, "End time");
      if (+new Date(endIso) <= +new Date(startIso)) {
        throw new Error(
          mode === "BORROW"
            ? "Expected return must be after borrow / collect time"
            : "End time must be after start time"
        );
      }

      const body: Record<string, unknown> = {
        equipmentId: bookingEq.id,
        studentId: user.id,
        start: startIso,
        end: endIso,
        purpose: purposeText,
        notes: form.notes.trim() ? form.notes.trim() : undefined,
        usageType: mode,
      };
      if (mode === "BORROW") {
        body.borrowPurpose = form.borrowPurpose;
        body.expectedReturnAt = endIso;
        if (form.borrowPurpose === "COMPETITION") {
          body.competition = {
            name: form.competitionName.trim(),
            organiser: form.competitionOrganiser.trim(),
            date: form.competitionDate,
            website: form.competitionWebsite.trim() || undefined,
            projectDescription: form.competitionProject.trim() || undefined,
          };
        }
      }
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageIsError(true);
        setMessage(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : res.status === 401
              ? "Sign in required — refresh and log in again"
              : `Request failed (${res.status})`
        );
        return;
      }
      if (!data.booking?.status) {
        setMessageIsError(true);
        setMessage("Server returned an unexpected response — try again");
        return;
      }
      const eqName = bookingEq.name;
      const status = data.booking.status as string;
      const warnings = (data.timetableWarnings || []).join(" · ");
      // In-modal success first, then close and keep a page-level confirmation.
      setMessageIsError(false);
      setMessage("Request sent");
      await new Promise((r) => setTimeout(r, 700));
      setBookingEq(null);
      setMode(null);
      setForm({
        purpose: "",
        start: "",
        end: "",
        notes: "",
        borrowPurpose: "COLLEGE_PROJECT",
        expectedReturnAt: "",
        competitionName: "",
        competitionOrganiser: "",
        competitionDate: "",
        competitionWebsite: "",
        competitionProject: "",
      });
      setMessageIsError(false);
      setMessage(
        `Request sent — ${eqName} · status ${status}${warnings ? ` · Note: ${warnings}` : ""}`
      );
      load();
    } catch (e) {
      setMessageIsError(true);
      setMessage((e as Error).message || "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">Explore labs & equipment</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Campus-wide discovery — browse every department and laboratory, then choose <strong>Use in Lab</strong> or{" "}
          <strong>Borrow Equipment</strong> (distinct workflows).
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
          <input
            className="input"
            placeholder="Search SEM, PCR, oscilloscope, Jetson…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search equipment"
          />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Lab category">
            <option value="">All lab categories</option>
            {Object.entries(LAB_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={load}>
            Search
          </button>
        </div>

        {message && !bookingEq && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              messageIsError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {message}
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((e) => (
            <article key={e.id} className="lab-card panel rounded-2xl p-5" style={{ ["--hue" as any]: e.lab?.imageHue || 170 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                    {e.lab?.code} · {LAB_CATEGORY_LABEL[e.lab?.category] || e.lab?.category}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold">{e.name}</h2>
                  <div className="mt-1 text-sm text-[var(--ink-soft)]">
                    {e.tag} · {e.lab?.building}
                  </div>
                </div>
                <StatusChip status={e.status} />
              </div>
              <p className="mt-3 text-sm text-[var(--ink-soft)]">{e.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(e.tags || []).slice(0, 4).map((t: string) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
                {e.requiresApproval && <span className="chip tone-warn">Approval required</span>}
                {e.borrowable && <span className="chip">Borrowable</span>}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>Replacement {inr(e.replacementCost)}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-accent !py-2"
                    onClick={() => openFlow(e, "IN_LAB")}
                    disabled={!["AVAILABLE", "IN_USE"].includes(e.status)}
                  >
                    Use in Lab
                  </button>
                  {e.borrowable && (
                    <button
                      className="btn btn-primary !py-2"
                      onClick={() => openFlow(e, "BORROW")}
                      disabled={e.status !== "AVAILABLE"}
                    >
                      Borrow Equipment
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Campus lab map</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">All {labs.length} laboratories — not limited by your department.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((lab) => (
              <div key={lab.id} className="panel rounded-2xl p-4">
                <div className="font-semibold">{lab.name}</div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {lab.building} · {LAB_CATEGORY_LABEL[lab.category]} · {lab.utilizationPct}% util.
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {bookingEq && mode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--paper)] p-5 shadow-xl">
            <h3 id="booking-dialog-title" className="text-xl font-semibold">
              {mode === "BORROW" ? "Borrow" : "Use in Lab"} · {bookingEq.name}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {bookingEq.lab?.name} · locked resource (cannot silently switch equipment)
            </p>

            <button
              className="btn btn-ghost mt-3 !py-2 text-sm"
              onClick={() => setShowTimetable((v) => !v)}
            >
              {showTimetable ? "Hide" : "View"} Laboratory Timetable
            </button>

            {showTimetable && (
              <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/70 p-3 text-sm">
                <p className="mb-2 text-xs text-[var(--ink-soft)]">
                  Full published schedule for this equipment’s lab (including other classes). Your enrolled classes
                  stay on My Lab Timetable; this view is for booking conflict awareness only.
                </p>
                {timetable.length ? (
                  <ul className="space-y-2">
                    {timetable.map((ev) => (
                      <li key={ev.id} className="rounded-lg border border-[var(--line)] px-3 py-2">
                        <div className="font-semibold">
                          {ev.eventDate || DAY_LABEL[ev.dayOfWeek] || "—"}{" "}
                          {formatHourRange(ev.startHour ?? 0, ev.endHour ?? 0)} · {ev.eventType}
                        </div>
                        <div className="text-[var(--ink-soft)]">
                          {ev.title} · {ev.cohort}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--ink-soft)]">No scheduled classes published for this lab.</p>
                )}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">
                Purpose / reason
                {mode === "BORROW" && form.borrowPurpose === "COMPETITION" ? (
                  <span className="font-normal text-[var(--ink-soft)]"> (optional for competitions)</span>
                ) : null}
                <textarea
                  className="textarea mt-1"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder={
                    mode === "BORROW" && form.borrowPurpose === "COMPETITION"
                      ? "Optional notes — competition fields below are enough to submit"
                      : "Describe why you need this equipment"
                  }
                />
              </label>
              {mode === "IN_LAB" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Start
                    <input
                      type="datetime-local"
                      className="input mt-1"
                      value={form.start}
                      onChange={(e) => setForm({ ...form, start: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    End
                    <input
                      type="datetime-local"
                      className="input mt-1"
                      value={form.end}
                      onChange={(e) => setForm({ ...form, end: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Borrow / collect
                      <input
                        type="datetime-local"
                        className="input mt-1"
                        value={form.start}
                        onChange={(e) => setForm({ ...form, start: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Expected return
                      <input
                        type="datetime-local"
                        className="input mt-1"
                        value={form.expectedReturnAt}
                        onChange={(e) => setForm({ ...form, expectedReturnAt: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold">
                    Borrow purpose
                    <select
                      className="select mt-1"
                      value={form.borrowPurpose}
                      onChange={(e) => setForm({ ...form, borrowPurpose: e.target.value })}
                    >
                      <option value="PERSONAL_PROJECT">Personal Project</option>
                      <option value="COLLEGE_PROJECT">Engineering College Project</option>
                      <option value="COMPETITION">Competition</option>
                    </select>
                  </label>
                  {form.borrowPurpose === "COMPETITION" && (
                    <div className="space-y-3 rounded-xl border border-[var(--line)] p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-2)]">
                        Competition details (mandatory name / organiser / date)
                      </div>
                      <input
                        className="input"
                        placeholder="Competition name"
                        value={form.competitionName}
                        onChange={(e) => setForm({ ...form, competitionName: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Organiser"
                        value={form.competitionOrganiser}
                        onChange={(e) => setForm({ ...form, competitionOrganiser: e.target.value })}
                      />
                      <input
                        type="date"
                        className="input"
                        value={form.competitionDate}
                        onChange={(e) => setForm({ ...form, competitionDate: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Website (optional)"
                        value={form.competitionWebsite}
                        onChange={(e) => setForm({ ...form, competitionWebsite: e.target.value })}
                      />
                      <textarea
                        className="textarea"
                        placeholder="Project description (optional)"
                        value={form.competitionProject}
                        onChange={(e) => setForm({ ...form, competitionProject: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}
              <label className="block text-sm font-semibold">
                Notes for lab in-charge (optional)
                <textarea
                  className="textarea mt-1"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            {message && (
              <p
                className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                  messageIsError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"
                }`}
                role="alert"
              >
                {message}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={submitting}
                onClick={() => {
                  setBookingEq(null);
                  setMode(null);
                  setMessage("");
                  setMessageIsError(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitBooking()}
                disabled={!canSubmit() || submitting}
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--ink-soft)]">
              Tip: pick a future window that avoids scheduled classes. Reference {when(new Date().toISOString())}.
              {mode === "BORROW" && form.borrowPurpose === "COMPETITION"
                ? " Competition name, organiser and date unlock submit; purpose notes are optional."
                : null}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
