import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { deleteComplaint, updateComplaint, type ComplaintStatus } from "../../../../lib/db";

export const runtime = "nodejs";

const requiredFields = ["userId", "phoneNumber", "complaintType", "details"] as const;

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseStatus(value: unknown): ComplaintStatus | null {
  return value === "pending" || value === "completed" ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = parseId((await context.params).id);
  const body = (await request.json()) as Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ error: "Invalid complaint id." }, { status: 400 });
  }

  const missingField = requiredFields.find((field) => typeof body[field] !== "string" || !body[field]?.trim());
  if (missingField) {
    return NextResponse.json({ error: `${missingField} is required.` }, { status: 400 });
  }

  const status = parseStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status must be pending or completed." }, { status: 400 });
  }

  try {
    const complaint = updateComplaint(id, {
      userId: String(body.userId).trim(),
      phoneNumber: String(body.phoneNumber).trim(),
      whatsappNumber: String(body.whatsappNumber).trim(),
      complaintType: String(body.complaintType).trim(),
      status,
      details: String(body.details).trim(),
      vlan: String(body.vlan).trim(),
      pop: String(body.pop).trim(),
    });
    return NextResponse.json({ complaint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update complaint.";
    return NextResponse.json({ error: message }, { status: message === "Complaint not found." ? 404 : 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid complaint id." }, { status: 400 });
  }

  try {
    return NextResponse.json({ deletedComplaint: deleteComplaint(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete complaint.";
    return NextResponse.json({ error: message }, { status: message === "Complaint not found." ? 404 : 409 });
  }
}
