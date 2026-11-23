"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { useSession } from "@/hooks/useSession";
import {
  DAY_LABEL,
  LAB_CATEGORY_LABEL,
  TIMETABLE_EVENT_TYPE_LABEL,
  formatHourRange,
  hourToTimeInput,
  makeClassKey,
  parseTimeToHour,
} from "@/lib/format";

type ClassOption = {
  subject: string;
  cohort: string;
  facultyId?: string;
  classKey?: string;
  source: "enrollment" | "timetable";
};

type FieldErrors = Partial<Record<"labId" | "schedule" | "classKey" | "eventType" | "times", string>>;

const EVENT_TYPES = ["SPECIAL", "CLASS", "EXAM", "MAINTENANCE"] as const;
const GENERAL_CLASS_KEY = "__general__";

function classKeyOf(c: Pick<ClassOption, "subject" | "cohort">) {
  return `${c.subject}|||${c.cohort}`;
}

function defaultTitle(eventType: string, subject: string) {
  if (eventType === "CLASS") return subject;
  if (eventType === "EXAM") return `Exam · ${subject}`;
  if (eventType === "MAINTENANCE") return "Lab maintenance";
  if (eventType === "SPECIAL") return subject === "Special session" ? "Special lab session" : `Special · ${subject}`;
  return subject;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminTimetablePage() {
  const { user, ready } = useSession({ require: "STAFF" });
  const [labs, setLabs] = useState<any[]>([]);
  const [labId, setLabId] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const [scheduleMode, setScheduleMode] = useState<"once" | "weekly">("once");
  const [eventDate, setEventDate] = useState(todayISO());
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [classKey, setClassKey] = useState("");
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>("SPECIAL");
  const [notes, setNotes] = useState("");

  const canEdit =
    !!user &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "TIMETABLE_COORDINATOR" ||
      user.role === "FACULTY" ||
      user.role === "ADMIN");

  useEffect(() => {
    if (!user) return;
    fetch("/api/labs")
      .then((r) => r.json())
      .then((d) => {
        const list = d.labs || [];
        setLabs(list);
        if (list[0]) setLabId((prev) => prev || list[0].id);
      });
  }, [user]);

  async function loadEvents(id = labId) {
    if (!id) {
      setEvents([]);
      return;
    }
    const d = await fetch(`/api/timetable?labId=${encodeURIComponent(id)}`).then((r) => r.json());
    setEvents(d.events || []);
  }

  async function loadClasses(id = labId) {
    if (!id || !canEdit) {
      setClasses([]);
      return;
    }
    const d = await fetch(`/api/timetable?labId=${encodeURIComponent(id)}&classes=1`).then((r) => r.json());
    const list: ClassOption[] = d.classes || [];
    setClasses(list);
    setClassKey((prev) => {
      if (prev === GENERAL_CLASS_KEY) return prev;
      if (prev && list.some((c) => classKeyOf(c) === prev)) return prev;
      return list[0] ? classKeyOf(list[0]) : GENERAL_CLASS_KEY;
    });
  }

  useEffect(() => {
    if (!labId) return;
    loadEvents(labId);
    loadClasses(labId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when lab or edit rights change
  }, [labId, canEdit]);

  const selectedClass = useMemo(() => {
    if (!classKey || classKey === GENERAL_CLASS_KEY) return null;
    return classes.find((c) => classKeyOf(c) === classKey) || null;
  }, [classKey, classes]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!labId) next.labId = "Select a laboratory.";
    if (scheduleMode === "once") {
      if (!eventDate) next.schedule = "Select a date.";
    } else if (dayOfWeek < 0 || dayOfWeek > 6) {
      next.schedule = "Select a day of week.";
    }
    const startH = parseTimeToHour(startTime);
    const endH = parseTimeToHour(endTime);
    if (!startTime || !endTime) next.times = "Start and end time are required.";
    else if (endH <= startH) next.times = "End time must be after start time.";
    if (!classKey) next.classKey = "Select a class or campus general.";
    if (!EVENT_TYPES.includes(eventType)) next.eventType = "Select an event type.";
    return next;
  }

  async function publish() {
    if (!user || !canEdit) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMsg("Fix the highlighted fields before publishing.");
      setMsgTone("err");
      return;
    }

    const subject = selectedClass?.subject || (eventType === "MAINTENANCE" ? "Maintenance" : "Special session");
    const cohort = selectedClass?.cohort || "All";
    const title = defaultTitle(eventType, subject);
    const startHour = parseTimeToHour(startTime);
    const endHour = parseTimeToHour(endTime);
    const resolvedClassKey = selectedClass
      ? selectedClass.classKey || makeClassKey(labId, selectedClass.subject, selectedClass.cohort)
      : makeClassKey(labId, subject, cohort);

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            labId,
            title,
            subject,
            cohort,
            classKey: resolvedClassKey,
            dayOfWeek: scheduleMode === "weekly" ? Number(dayOfWeek) : undefined,
            eventDate: scheduleMode === "once" ? eventDate : undefined,
            startHour,
            endHour,
            eventType,
            notes: notes.trim() || undefined,
            facultyId: selectedClass?.facultyId || user.id,
            published: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Could not publish event");
        setMsgTone("err");
        return;
      }
      setMsg("Timetable event published");
      setMsgTone("ok");
      setNotes("");
      setErrors({});
      await loadEvents(labId);
      await loadClasses(labId);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch("/api/timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Event removed" : data.error);
    setMsgTone(res.ok ? "ok" : "err");
    await loadEvents(labId);
  }

  if (!ready || !user) return <div className="shell py-20">Loading…</div>;

  return (
    <div className="min-h-screen pb-16">
      <Nav user={user} />
      <main className="shell py-8">
        <h1 className="text-3xl font-semibold">
          {user.role === "TIMETABLE_COORDINATOR" ? "Timetable coordinator desk" : "Laboratory timetable"}
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          {user.role === "TIMETABLE_COORDINATOR"
            ? "Publish class-to-lab mappings campus-wide. Enrolled students and the assigned teacher see class sessions by default; other students only see a lab’s schedule when booking or borrowing there."
            : user.role === "SUPER_ADMIN"
              ? "Central view of published lab schedules used in booking conflict checks."
              : "Schedules for your assigned laboratories and classes — students in those classes see matching sessions on My Lab Timetable."}
        </p>
        {msg && (
          <p className={`mt-3 text-sm ${msgTone === "err" ? "text-rose-800" : "text-emerald-800"}`}>{msg}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <label className="block min-w-[16rem] flex-1 text-sm">
            <span className="font-medium">1. Select lab</span>
            <select
              className="select mt-1 w-full max-w-xl"
              value={labId}
              onChange={(e) => {
                setLabId(e.target.value);
                setErrors((prev) => ({ ...prev, labId: undefined }));
              }}
              aria-invalid={!!errors.labId}
            >
              {!labs.length && <option value="">No labs in scope</option>}
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {LAB_CATEGORY_LABEL[l.category] || l.category}
                </option>
              ))}
            </select>
            {errors.labId && <span className="mt-1 block text-xs text-rose-700">{errors.labId}</span>}
          </label>
          <span className="chip self-end">{labs.length} lab{labs.length === 1 ? "" : "s"} in scope</span>
        </div>

        {canEdit && (
          <section className="panel mt-6 rounded-2xl p-5">
            <h2 className="text-lg font-semibold">Publish timetable event</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Choose schedule, class, and type — then publish so students and booking conflict checks can see it.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <fieldset className="md:col-span-2">
                <legend className="text-sm font-medium">2. Select date and time</legend>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === "once"}
                      onChange={() => setScheduleMode("once")}
                    />
                    One-off date
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === "weekly"}
                      onChange={() => setScheduleMode("weekly")}
                    />
                    Recurring weekly
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {scheduleMode === "once" ? (
                    <label className="block text-sm sm:col-span-1">
                      <span className="text-[var(--ink-soft)]">Date</span>
                      <input
                        className="input mt-1 w-full"
                        type="date"
                        value={eventDate}
                        onChange={(e) => {
                          setEventDate(e.target.value);
                          setErrors((prev) => ({ ...prev, schedule: undefined }));
                        }}
                      />
                    </label>
                  ) : (
                    <label className="block text-sm sm:col-span-1">
                      <span className="text-[var(--ink-soft)]">Day of week</span>
                      <select
                        className="select mt-1 w-full"
                        value={dayOfWeek}
                        onChange={(e) => {
                          setDayOfWeek(Number(e.target.value));
                          setErrors((prev) => ({ ...prev, schedule: undefined }));
                        }}
                      >
                        {DAY_LABEL.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="block text-sm">
                    <span className="text-[var(--ink-soft)]">Start time</span>
                    <input
                      className="input mt-1 w-full"
                      type="time"
                      step={1800}
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value || hourToTimeInput(9));
                        setErrors((prev) => ({ ...prev, times: undefined }));
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--ink-soft)]">End time</span>
                    <input
                      className="input mt-1 w-full"
                      type="time"
                      step={1800}
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value || hourToTimeInput(11));
                        setErrors((prev) => ({ ...prev, times: undefined }));
                      }}
                    />
                  </label>
                </div>
                {(errors.schedule || errors.times) && (
                  <p className="mt-2 text-xs text-rose-700">{errors.schedule || errors.times}</p>
                )}
              </fieldset>

              <label className="block text-sm md:col-span-2">
                <span className="font-medium">3. Select which class</span>
                <select
                  className="select mt-1 w-full"
                  value={classKey}
                  onChange={(e) => {
                    setClassKey(e.target.value);
                    setErrors((prev) => ({ ...prev, classKey: undefined }));
                  }}
                >
                  <option value={GENERAL_CLASS_KEY}>Campus / general (no specific cohort)</option>
                  {classes.map((c) => (
                    <option key={classKeyOf(c)} value={classKeyOf(c)}>
                      {c.subject} · {c.cohort}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                  Options come from lab enrolments and existing timetable rows for this lab.
                </span>
                {errors.classKey && <span className="mt-1 block text-xs text-rose-700">{errors.classKey}</span>}
              </label>

              <label className="block text-sm">
                <span className="font-medium">4. Select type</span>
                <select
                  className="select mt-1 w-full"
                  value={eventType}
                  onChange={(e) => {
                    setEventType(e.target.value as (typeof EVENT_TYPES)[number]);
                    setErrors((prev) => ({ ...prev, eventType: undefined }));
                  }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TIMETABLE_EVENT_TYPE_LABEL[t] || t}
                    </option>
                  ))}
                </select>
                {errors.eventType && <span className="mt-1 block text-xs text-rose-700">{errors.eventType}</span>}
              </label>

              <label className="block text-sm md:col-span-1">
                <span className="font-medium">5. Note</span>
                <textarea
                  className="input mt-1 min-h-[2.75rem] w-full resize-y"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note for faculty / students"
                />
              </label>
            </div>

            <div className="mt-5">
              <button className="btn btn-primary" onClick={publish} disabled={busy || !labId}>
                {busy ? "Publishing…" : "6. Publish / add session"}
              </button>
            </div>
          </section>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-semibold">Events for this lab</h2>
          <div className="mt-4 space-y-3">
            {events.map((ev) => (
              <article key={ev.id} className="panel rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {ev.eventDate
                      ? `${ev.eventDate} (${DAY_LABEL[ev.dayOfWeek] || "?"})`
                      : `${DAY_LABEL[ev.dayOfWeek] || "—"} · weekly`}{" "}
                    · {formatHourRange(ev.startHour ?? 0, ev.endHour ?? 0)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="chip">{TIMETABLE_EVENT_TYPE_LABEL[ev.eventType] || ev.eventType}</span>
                    {canEdit && (
                      <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => remove(ev.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1">{ev.title}</div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {ev.subject} · {ev.cohort} · {ev.faculty?.name || "Unassigned faculty"}
                </div>
                {ev.notes && <p className="mt-2 text-xs text-[var(--accent-2)]">{ev.notes}</p>}
              </article>
            ))}
            {!events.length && <p className="text-[var(--ink-soft)]">No timetable events for this lab.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
