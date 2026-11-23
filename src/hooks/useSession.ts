"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";

export function useSession(opts?: { require?: "STUDENT" | "STAFF" }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user as User | null;
        setUser(u);
        if (!u) {
          router.replace("/login");
          return;
        }
        if (opts?.require === "STUDENT" && u.role !== "STUDENT") {
          router.replace("/admin");
          return;
        }
        if (opts?.require === "STAFF" && u.role === "STUDENT") {
          router.replace("/student");
          return;
        }
        // FACULTY / ADMIN / SUPER_ADMIN all use the staff hub.
      })
      .finally(() => setReady(true));
  }, [router, opts?.require]);

  return { user, ready };
}
