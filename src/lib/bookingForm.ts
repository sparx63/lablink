import type { BorrowPurpose, UsageType } from "./types";

/** Shared booking dialog state (Explore Use-in-Lab / Borrow). */
export type BookingFormState = {
  purpose: string;
  start: string;
  end: string;
  notes: string;
  borrowPurpose: BorrowPurpose;
  expectedReturnAt: string;
  competitionName: string;
  competitionOrganiser: string;
  competitionDate: string;
  competitionWebsite: string;
  competitionProject: string;
};

export const EMPTY_BOOKING_FORM: BookingFormState = {
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
};

export type BookingMode = Extract<UsageType, "IN_LAB" | "BORROW">;

export function bookingFormCanSubmit(form: BookingFormState, mode: BookingMode | null): boolean {
  if (!mode || !form.start) return false;
  if (mode === "BORROW") {
    if (!form.expectedReturnAt) return false;
    if (form.borrowPurpose === "COMPETITION") {
      return !!(form.competitionName.trim() && form.competitionOrganiser.trim() && form.competitionDate);
    }
    return !!form.purpose.trim();
  }
  return !!(form.purpose.trim() && form.end);
}

export function resolveBookingPurpose(form: BookingFormState): string {
  const trimmed = form.purpose.trim();
  if (trimmed) return trimmed;
  if (form.borrowPurpose === "COMPETITION") {
    return `Competition: ${form.competitionName.trim()} (${form.competitionOrganiser.trim()})`;
  }
  return "";
}
