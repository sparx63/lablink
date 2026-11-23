import dynamic from "next/dynamic";

const DiscoverClient = dynamic(() => import("./DiscoverClient"), {
  loading: () => <div className="shell py-20 text-[var(--ink-soft)]">Loading equipment discovery…</div>,
});

export default function DiscoverPage() {
  return <DiscoverClient />;
}
