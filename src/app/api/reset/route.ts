export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, jsonError, requireSession } from "@/lib/api";
import { resetState } from "@/lib/store";

/** Demo reseed — SUPER_ADMIN only so anonymous clients cannot wipe state. */
export async function POST() {
  try {
    const user = await requireSession();
    if (user.role !== "SUPER_ADMIN") throw new AuthError("Central admin only", 403);
    const state = await resetState();
    return NextResponse.json({ ok: true, users: state.users.length, labs: state.labs.length });
  } catch (e) {
    return jsonError(e);
  }
}
