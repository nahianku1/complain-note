import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createTicketType, getTicketTypes } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ ticketTypes: await getTicketTypes() });
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Ticket type name is required." }, { status: 400 });
  }

  if (name.length > 60) {
    return NextResponse.json({ error: "Ticket type name must be 60 characters or fewer." }, { status: 400 });
  }

  try {
    return NextResponse.json({ ticketType: await createTicketType(name) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save ticket type." }, { status: 409 });
  }
}
