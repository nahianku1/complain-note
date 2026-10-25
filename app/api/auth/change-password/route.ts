import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "../../../../lib/auth";
import { formatValidationError } from "../../../../lib/auth-response";
import { changePasswordSchema } from "../../../../lib/auth-schemas";
import { findUserById, updateUserPassword } from "../../../../lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const result = changePasswordSchema.safeParse(body);
  if (!result.success) return NextResponse.json(formatValidationError(result.error), { status: 400 });

  const storedUser = findUserById(currentUser.id);
  if (!storedUser || !(await verifyPassword(result.data.currentPassword, storedUser.passwordHash))) {
    return NextResponse.json({ error: "The current password is incorrect.", fieldErrors: { currentPassword: "Current password is incorrect." } }, { status: 400 });
  }

  if (await verifyPassword(result.data.password, storedUser.passwordHash)) {
    return NextResponse.json({ error: "Your new password must be different from the current password.", fieldErrors: { password: "Choose a different password." } }, { status: 400 });
  }

  await updateUserPassword(currentUser.id, await hashPassword(result.data.password));
  return NextResponse.json({ ok: true });
}
