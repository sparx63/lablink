import { NextResponse } from "next/server";
import { getSessionUser } from "./store";
import type { User } from "./types";
import { ValidationError } from "./validate";

/** Simple in-memory rate limit (demo-scale; per-process). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || hit.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (hit.count >= limit) return false;
  hit.count += 1;
  return true;
}

export function clientKey(req: Request, suffix: string) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${fwd || "local"}:${suffix}`;
}

export async function requireSession(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Sign in required", 401);
  return user;
}

export async function requireStaff(opts?: { allowCoordinator?: boolean }): Promise<User> {
  const user = await requireSession();
  if (user.role === "STUDENT") throw new AuthError("Staff only", 403);
  if (user.role === "TIMETABLE_COORDINATOR" && opts?.allowCoordinator === false) {
    throw new AuthError("Lab staff only", 403);
  }
  return user;
}

export async function requireLabStaff(): Promise<User> {
  return requireStaff({ allowCoordinator: false });
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Safe JSON error — never leak stacks. */
export function jsonError(err: unknown, fallback = "Request failed") {
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  // Avoid leaking internal paths / stack fragments
  const safe = message.replace(/\/[\w./-]+/g, "[path]").slice(0, 240);
  return NextResponse.json({ error: safe || fallback }, { status: 400 });
}
