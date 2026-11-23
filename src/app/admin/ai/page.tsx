import dynamic from "next/dynamic";

const AdminAiClient = dynamic(() => import("./AiClient"), {
  loading: () => <div className="shell py-20 text-[var(--ink-soft)]">Loading GenAI allocator…</div>,
});

export default function AdminAiAllocatePage() {
  return <AdminAiClient />;
}
