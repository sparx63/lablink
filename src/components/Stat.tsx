export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-sm text-[var(--ink-soft)]">{hint}</div> : null}
    </div>
  );
}
