import { NextResponse } from "next/server";
import { clearLoginSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearLoginSession();
  return NextResponse.json({ ok: true });
}
