import { STATUS_TONE } from "@/lib/format";

export function StatusChip({ status }: { status?: string | null }) {
  const label = status || "UNKNOWN";
  return <span className={`chip ${STATUS_TONE[label] || "tone-muted"}`}>{label.replace(/_/g, " ")}</span>;
}
