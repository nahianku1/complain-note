import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { deleteTicketType, updateTicketType } from "../../../../lib/db";

export const runtime = "nodejs";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = parseId((await context.params).id);
  const body = (await request.json()) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!id) {
    return NextResponse.json({ error: "Invalid ticket type id." }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Ticket type name is required." }, { status: 400 });
  }

  if (name.length > 60) {
    return NextResponse.json({ error: "Ticket type name must be 60 characters or fewer." }, { status: 400 });
  }

  try {
    return NextResponse.json({ ticketType: await updateTicketType(id, name) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update ticket type.";
    return NextResponse.json({ error: message }, { status: message === "Ticket type not found." ? 404 : 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = parseId((await context.params).id);

  if (!id) {
    return NextResponse.json({ error: "Invalid ticket type id." }, { status: 400 });
  }

  try {
    return NextResponse.json({ deletedType: await deleteTicketType(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete ticket type.";
    return NextResponse.json({ error: message }, { status: message === "Ticket type not found." ? 404 : 409 });
  }
}
