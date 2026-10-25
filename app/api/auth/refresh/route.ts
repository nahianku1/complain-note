import { NextResponse } from "next/server";
import { refreshAuthCookies } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const user = await refreshAuthCookies();
  if (!user) return NextResponse.json({ error: "Refresh token is invalid or expired." }, { status: 401 });
  return NextResponse.json({ ok: true, user });
}
