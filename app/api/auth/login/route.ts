import { NextResponse } from "next/server";
import { createJwtCookie, findUserByIdentifier, toSafeUser, verifyPassword } from "../../../../lib/auth";
import { formatValidationError } from "../../../../lib/auth-response";
import { loginSchema } from "../../../../lib/auth-schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(formatValidationError(result.error), { status: 400 });
  }

  try {
    const user = await findUserByIdentifier(result.data.identifier);
    if (!user || !(await verifyPassword(result.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "The username/email/mobile or password is incorrect." }, { status: 401 });
    }

    const safeUser = toSafeUser(user);
    await createJwtCookie(safeUser);
    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error("Login database error", error);
    return NextResponse.json({ error: "We could not reach the database right now. Please try again shortly." }, { status: 503 });
  }
}
