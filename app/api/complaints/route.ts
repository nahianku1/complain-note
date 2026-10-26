import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createComplaint, getComplaints, type ComplaintStatus } from "../../../lib/db";

export const runtime = "nodejs";

const requiredFields = ["userId", "phoneNumber", "complaintType", "details"] as const;

function parseStatus(value: unknown): ComplaintStatus | null {
  if (value === undefined) return "pending";
  return value === "pending" || value === "completed" ? value : null;
}

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ complaints: await getComplaints() });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const missingField = requiredFields.find((field) => typeof body[field] !== "string" || !body[field]?.trim());

  if (missingField) {
    return NextResponse.json({ error: `${missingField} is required.` }, { status: 400 });
  }

  const status = parseStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status must be pending or completed." }, { status: 400 });
  }

  const complaint = await createComplaint({
    userId: String(body.userId).trim(),
    entryBy: currentUser.username,
    phoneNumber: String(body.phoneNumber).trim(),
    whatsappNumber: String(body.whatsappNumber).trim(),
    complaintType: String(body.complaintType).trim(),
    status,
    details: String(body.details).trim(),
    vlan: String(body.vlan).trim(),
    pop: String(body.pop).trim(),
  });

  return NextResponse.json({ complaint }, { status: 201 });
}
