import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createTechnician, getTechnicians } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const technicians = await getTechnicians();
    return NextResponse.json({ technicians });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load technicians." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const mobile1 = typeof body.mobile1 === "string" ? body.mobile1.replace(/\s+/g, "").trim() : "";
    const mobile2 = typeof body.mobile2 === "string" ? body.mobile2.replace(/\s+/g, "").trim() : "";
    const whatsappNumber = typeof body.whatsappNumber === "string" ? body.whatsappNumber.replace(/\s+/g, "").trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const nid = typeof body.nid === "string" ? body.nid.trim() : "";
    const fatherName = typeof body.fatherName === "string" ? body.fatherName.trim() : "";
    const motherName = typeof body.motherName === "string" ? body.motherName.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!mobile1) {
      return NextResponse.json({ error: "Primary mobile number is required." }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "Address is required." }, { status: 400 });
    }
    if (!nid) {
      return NextResponse.json({ error: "NID number is required." }, { status: 400 });
    }
    if (!fatherName) {
      return NextResponse.json({ error: "Father's name is required." }, { status: 400 });
    }
    if (!motherName) {
      return NextResponse.json({ error: "Mother's name is required." }, { status: 400 });
    }

    const technician = await createTechnician({
      name,
      mobile1,
      mobile2,
      whatsappNumber,
      address,
      nid,
      fatherName,
      motherName,
    });

    return NextResponse.json({ technician }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add technician." },
      { status: 500 }
    );
  }
}
