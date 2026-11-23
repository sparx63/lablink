import type { User } from "./types";

export function isStaff(user: User | null | undefined): boolean {
  return !!user && user.role !== "STUDENT";
}

/** Campus-wide operators (central admin) see every lab for equipment/ops. */
export function isCampusWide(user: User | null | undefined): boolean {
  return !!user && user.role === "SUPER_ADMIN";
}

/**
 * Lab IDs a staff member may manage for equipment/custody/approvals.
 * `null` means unrestricted (SUPER_ADMIN). Students return `null` for discovery.
 * Timetable coordinators are NOT custody managers unless they also have managedLabIds.
 */
export function managedLabIds(user: User | null | undefined): string[] | null {
  if (!user) return [];
  if (user.role === "STUDENT") return null;
  if (user.role === "SUPER_ADMIN") return null;
  if (user.role === "TIMETABLE_COORDINATOR") {
    return user.managedLabIds?.length ? user.managedLabIds : [];
  }
  return user.managedLabIds?.length ? user.managedLabIds : [];
}

export function canManageLab(user: User | null | undefined, labId: string): boolean {
  if (!user || user.role === "STUDENT") return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "TIMETABLE_COORDINATOR" && !(user.managedLabIds || []).length) return false;
  return (user.managedLabIds || []).includes(labId);
}

/** Timetable publish/edit rights — coordinators are campus-wide for schedules. */
export function canManageTimetable(user: User | null | undefined, labId?: string): boolean {
  if (!user || user.role === "STUDENT") return false;
  if (user.role === "SUPER_ADMIN" || user.role === "TIMETABLE_COORDINATOR") return true;
  if (!labId) return (user.managedLabIds || []).length > 0;
  return (user.managedLabIds || []).includes(labId);
}

export function assertCanManageLab(user: User | null | undefined, labId: string) {
  if (!canManageLab(user, labId)) {
    throw new Error("You can only manage resources for your assigned lab(s)");
  }
}

export function assertCanManageTimetable(user: User | null | undefined, labId: string) {
  if (!canManageTimetable(user, labId)) {
    throw new Error("You are not authorised to edit this laboratory timetable");
  }
}

export function filterByManagedLabs<T extends { labId?: string }>(
  user: User | null | undefined,
  items: T[],
  labIdOf: (item: T) => string = (item) => item.labId || ""
): T[] {
  const scope = managedLabIds(user);
  if (scope === null) return items;
  const set = new Set(scope);
  return items.filter((item) => set.has(labIdOf(item)));
}
