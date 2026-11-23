export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clientKey, jsonError, rateLimit } from "@/lib/api";
import { getSessionUser, listUsers, setSession } from "@/lib/store";
import { parseBody, SessionBodySchema } from "@/lib/validate";

export async function GET() {
  const user = await getSessionUser();
  // Demo directory is intentional — only non-secret persona metadata for login gate.
  const users = await listUsers();
  const safeUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    managedLabIds: u.managedLabIds,
    avatarColor: u.avatarColor,
    fineBalance: u.fineBalance,
    programme: u.programme,
    certifications: u.certifications,
  }));
  return NextResponse.json({ user, users: safeUsers });
}

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, "session"), 40)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(SessionBodySchema, await req.json());
    const user = await setSession(body.userId ?? null);
    return NextResponse.json({ user });
  } catch (e) {
    return jsonError(e);
  }
}
