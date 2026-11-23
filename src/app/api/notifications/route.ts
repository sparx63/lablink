export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/lib/store";
import { NotificationPatchSchema, parseBody } from "@/lib/validate";

export async function GET() {
  try {
    const user = await requireSession();
    return NextResponse.json({ notifications: await listNotifications(user.id) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireSession();
    const body = parseBody(NotificationPatchSchema, await req.json());
    const n = await markNotificationRead(body.id, user.id);
    return NextResponse.json({ notification: n });
  } catch (e) {
    return jsonError(e);
  }
}
