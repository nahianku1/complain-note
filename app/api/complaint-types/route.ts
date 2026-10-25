import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createComplaintType, getComplaintTypes } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ complaintTypes: getComplaintTypes() });
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Complaint type name is required." }, { status: 400 });
  }

  if (name.length > 60) {
    return NextResponse.json({ error: "Complaint type name must be 60 characters or fewer." }, { status: 400 });
  }

  try {
    return NextResponse.json({ complaintType: createComplaintType(name) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save complaint type." }, { status: 409 });
  }
}
