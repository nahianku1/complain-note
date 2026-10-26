import { NextResponse } from "next/server";
import { createUser, hashPassword } from "../../../../lib/auth";
import { formatValidationError } from "../../../../lib/auth-response";
import { signupSchema } from "../../../../lib/auth-schemas";
import { findUserByEmail, findUserByMobile, findUserByUsername } from "../../../../lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = signupSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(formatValidationError(result.error), { status: 400 });
  }

  try {
    const { username, email, mobile, password } = result.data;
    if (await findUserByUsername(username)) {
      return NextResponse.json({ error: "That username is already taken.", fieldErrors: { username: "Username is already taken." } }, { status: 409 });
    }
    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "An account with this email already exists.", fieldErrors: { email: "Email is already registered." } }, { status: 409 });
    }
    if (await findUserByMobile(mobile)) {
      return NextResponse.json({ error: "An account with this mobile number already exists.", fieldErrors: { mobile: "Mobile number is already registered." } }, { status: 409 });
    }

    const user = await createUser({ username, email, mobile, passwordHash: await hashPassword(password) });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Signup database error", error);
    return NextResponse.json({ error: "We could not reach the database right now. Please try again shortly." }, { status: 503 });
  }
}
