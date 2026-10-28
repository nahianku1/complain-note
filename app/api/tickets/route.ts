import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createTicket, getTickets, type TicketStatus } from "../../../lib/db";

export const runtime = "nodejs";

const requiredFields = ["userId", "phoneNumber", "ticketType", "details"] as const;

function parseStatus(value: unknown): TicketStatus | null {
  if (value === undefined) return "pending";
  return value === "pending" || value === "running" || value === "completed" || value === "cancelled" || value === "closed" ? value : null;
}

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ tickets: await getTickets() });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
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

  const isCompleted = status === "completed";
  const isClosed = status === "closed";
  const isCancelled = status === "cancelled";
  const now = new Date().toISOString();

  const ticket = await createTicket({
    userId: String(body.userId).trim(),
    entryBy: currentUser.username,
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
    completedBy: isCompleted ? currentUser.username : "",
    completedDate: isCompleted ? now : "",
    closedBy: isClosed ? currentUser.username : "",
    closedDate: isClosed ? now : "",
    cancelledBy: isCancelled ? currentUser.username : "",
    cancelledDate: isCancelled ? now : "",
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
