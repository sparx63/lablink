export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, jsonError, requireSession } from "@/lib/api";
import { listSavedResources, toggleSavedResource } from "@/lib/store";
import { parseBody, SavedToggleSchema } from "@/lib/validate";

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const requested = new URL(req.url).searchParams.get("studentId");
    const studentId = user.role === "STUDENT" ? user.id : requested || user.id;
    if (user.role === "STUDENT" && requested && requested !== user.id) {
      throw new AuthError("Forbidden", 403);
    }
    const saved = await listSavedResources(studentId);
    return NextResponse.json({ saved });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    if (user.role !== "STUDENT") throw new AuthError("Students only", 403);
    const body = parseBody(SavedToggleSchema, await req.json());
    if (!body.equipmentId && !body.labId) throw new AuthError("equipmentId or labId required", 400);
    const result = await toggleSavedResource(
      { studentId: user.id, equipmentId: body.equipmentId, labId: body.labId },
      user
    );
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
