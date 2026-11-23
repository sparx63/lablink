export function inr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function when(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const LAB_CATEGORY_LABEL: Record<string, string> = {
  IDEATION: "Ideation",
  ELECTRONICS: "Electronics",
  CHEMISTRY: "Chemistry",
  PHYSICS: "Physics",
  BIOTECH: "Biotech",
  MECHANICAL: "Mechanical",
  COMPUTING: "Computing",
  MATERIALS: "Materials",
  ROBOTICS: "Robotics",
  OPTICS: "Optics",
  FABRICATION: "Fabrication",
  MULTIDISCIPLINARY: "Cross-disciplinary",
};

export const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "tone-ok",
  APPROVED: "tone-ok",
  COMPLETED: "tone-ok",
  CLOSED: "tone-ok",
  PAID: "tone-ok",
  WAIVED: "tone-ok",
  VERIFIED: "tone-ok",
  READY_FOR_COLLECTION: "tone-ok",
  LIVE: "tone-ok",
  PUBLISHED: "tone-ok",
  SCHEDULED: "tone-warn",
  PENDING: "tone-warn",
  PARTIAL: "tone-warn",
  IN_USE: "tone-warn",
  ACTIVE: "tone-warn",
  BORROWED: "tone-warn",
  RESERVED: "tone-warn",
  MAINTENANCE: "tone-warn",
  AI_REVIEW: "tone-warn",
  NEEDS_INFO: "tone-warn",
  RETURN_INSPECTION: "tone-warn",
  DRAFT: "tone-muted",
  QUARANTINED: "tone-bad",
  REJECTED: "tone-bad",
  CANCELLED: "tone-muted",
  NO_SHOW: "tone-bad",
  OVERDUE: "tone-bad",
  LOST: "tone-bad",
  BROKEN: "tone-bad",
  DAMAGED: "tone-bad",
  RETIRED: "tone-muted",
  DISPUTED: "tone-warn",
  UNABLE_TO_VERIFY: "tone-warn",
};

export const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TIMETABLE_EVENT_TYPE_LABEL: Record<string, string> = {
  CLASS: "Class",
  SPECIAL: "Special",
  EXAM: "Exam",
  MAINTENANCE: "Maintenance",
  HOLIDAY: "Holiday",
};

/** Format a decimal hour (e.g. 9.5) as HH:MM. */
export function formatHour(h: number) {
  const n = Number(h);
  if (!Number.isFinite(n)) return "--:--";
  const hours = Math.floor(n);
  const mins = Math.round((n - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function formatHourRange(startHour: number, endHour: number) {
  return `${formatHour(startHour)}–${formatHour(endHour)}`;
}

export function parseTimeToHour(value: string): number {
  if (!value || typeof value !== "string") return 0;
  const [hh, mm] = value.split(":").map((p) => Number(p));
  if (!Number.isFinite(hh)) return 0;
  return hh + (Number.isFinite(mm) ? mm / 60 : 0);
}

export function hourToTimeInput(h: number) {
  return formatHour(h);
}

/** Stable class membership key shared by enrolments and timetable events. */
export function makeClassKey(labId: string, subject: string, cohort: string) {
  return `${labId}|${subject}|${cohort}`;
}

export function isGeneralTimetableCohort(cohort: string) {
  const c = (cohort || "").trim().toLowerCase();
  return !c || c === "all" || c === "campus" || c === "general";
}

export const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Lab teacher",
  ADMIN: "Lab admin",
  SUPER_ADMIN: "Central admin",
  TIMETABLE_COORDINATOR: "Timetable coordinator",
};
