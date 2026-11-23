import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="shell py-20 text-[var(--ink-soft)]">Loading login…</div>}>
      <LoginClient />
    </Suspense>
  );
}
