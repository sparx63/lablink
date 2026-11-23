export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, jsonError, requireSession } from "@/lib/api";
import { getPolicies, updatePolicies } from "@/lib/store";
import type { PolicyConfig } from "@/lib/types";
import { parseBody, PoliciesPatchSchema } from "@/lib/validate";

export async function GET() {
  const policies = await getPolicies();
  return NextResponse.json({ policies });
}

export async function PUT(req: Request) {
  try {
    const user = await requireSession();
    if (user.role !== "SUPER_ADMIN") throw new AuthError("Central admin only", 403);
    const raw = await req.json();
    // Accept { policies } or { patch } or flat body
    const patch =
      raw?.policies && typeof raw.policies === "object"
        ? raw.policies
        : raw?.patch && typeof raw.patch === "object"
          ? parseBody(PoliciesPatchSchema, raw).patch
          : raw;
    const policies = await updatePolicies(patch as Partial<PolicyConfig>, user);
    return NextResponse.json({ policies });
  } catch (e) {
    return jsonError(e);
  }
}
