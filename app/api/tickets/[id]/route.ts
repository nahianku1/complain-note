import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { deleteTicket, updateTicket, type TicketStatus } from "../../../../lib/db";

export const runtime = "nodejs";

const requiredFields = ["userId", "phoneNumber", "ticketType", "details"] as const;

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseStatus(value: unknown): TicketStatus | null {
  return value === "pending" || value === "running" || value === "completed" || value === "cancelled" || value === "closed" ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = parseId((await context.params).id);
  const body = (await request.json()) as Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ error: "Invalid ticket id." }, { status: 400 });
  }

  const missingField = requiredFields.find((field) => typeof body[field] !== "string" || !body[field]?.trim());
  if (missingField) {
    return NextResponse.json({ error: `${missingField} is required.` }, { status: 400 });
  }

  const assignedType = typeof body.assignedType === "string" ? body.assignedType.trim() : "";
  const isAssigning = assignedType === "technician" || assignedType === "tech" || assignedType === "team";
  if (isAssigning && (!body.address || typeof body.address !== "string" || !body.address.trim())) {
    return NextResponse.json({ error: "Customer address is required when assigning to a technician or team." }, { status: 400 });
  }

  const status = parseStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status must be pending, running, completed, cancelled, or closed." }, { status: 400 });
  }

  try {
    const ticket = await updateTicket(
      id,
      {
        userId: String(body.userId).trim(),
        phoneNumber: String(body.phoneNumber).trim(),
        whatsappNumber: String(body.whatsappNumber ?? "").trim(),
        address: String(body.address ?? "").trim(),
        ticketType: String(body.ticketType).trim(),
        status,
        details: String(body.details).trim(),
        vlan: String(body.vlan ?? "").trim(),
        pop: String(body.pop ?? "").trim(),
        assignedTo: typeof body.assignedTo === "string" ? body.assignedTo.trim() : "",
        assignedType: typeof body.assignedType === "string" ? body.assignedType.trim() : "",
        assignedId: typeof body.assignedId === "number" && Number.isInteger(body.assignedId) ? body.assignedId : null,
        completedBy: typeof body.completedBy === "string" ? body.completedBy.trim() : "",
        completedDate: typeof body.completedDate === "string" ? body.completedDate.trim() : "",
        closedBy: typeof body.closedBy === "string" ? body.closedBy.trim() : "",
        closedDate: typeof body.closedDate === "string" ? body.closedDate.trim() : "",
        cancelledBy: typeof body.cancelledBy === "string" ? body.cancelledBy.trim() : "",
        cancelledDate: typeof body.cancelledDate === "string" ? body.cancelledDate.trim() : "",
      },
      currentUser.username,
    );
    return NextResponse.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update ticket.";
    return NextResponse.json({ error: message }, { status: message === "Ticket not found." ? 404 : 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid ticket id." }, { status: 400 });
  }

  try {
    return NextResponse.json({ deletedTicket: await deleteTicket(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete ticket.";
    return NextResponse.json({ error: message }, { status: message === "Ticket not found." ? 404 : 409 });
  }
}
