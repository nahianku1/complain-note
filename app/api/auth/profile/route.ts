import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { formatValidationError } from "../../../../lib/auth-response";
import { profileSchema } from "../../../../lib/auth-schemas";
import { findUserByEmail, findUserByMobile, findUserByUsername, updateUserProfile } from "../../../../lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const result = profileSchema.safeParse(body);
  if (!result.success) return NextResponse.json(formatValidationError(result.error), { status: 400 });

  const { username, email, mobile } = result.data;
  const usernameOwner = findUserByUsername(username);
  if (usernameOwner && usernameOwner.id !== currentUser.id) {
    return NextResponse.json({ error: "That username is already taken.", fieldErrors: { username: "Username is already taken." } }, { status: 409 });
  }
  const emailOwner = findUserByEmail(email);
  if (emailOwner && emailOwner.id !== currentUser.id) {
    return NextResponse.json({ error: "An account with this email already exists.", fieldErrors: { email: "Email is already registered." } }, { status: 409 });
  }
  const mobileOwner = findUserByMobile(mobile);
  if (mobileOwner && mobileOwner.id !== currentUser.id) {
    return NextResponse.json({ error: "An account with this mobile number already exists.", fieldErrors: { mobile: "Mobile number is already registered." } }, { status: 409 });
  }

  try {
    return NextResponse.json({ user: updateUserProfile(currentUser.id, { username, email, mobile }) });
  } catch {
    return NextResponse.json({ error: "We could not update your profile right now. Please try again." }, { status: 500 });
  }
}
