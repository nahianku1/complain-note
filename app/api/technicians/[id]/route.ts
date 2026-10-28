import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { deleteTechnician, updateTechnician } from "../../../../lib/db";

export const runtime = "nodejs";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid technician id." }, { status: 400 });
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

    const technician = await updateTechnician(id, {
      name,
      mobile1,
      mobile2,
      whatsappNumber,
      address,
      nid,
      fatherName,
      motherName,
    });

    return NextResponse.json({ technician });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update technician.";
    return NextResponse.json(
      { error: message },
      { status: message === "Technician not found." ? 404 : 500 }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid technician id." }, { status: 400 });
  }

  try {
    const deletedTechnician = await deleteTechnician(id);
    return NextResponse.json({ deletedTechnician });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete technician.";
    return NextResponse.json(
      { error: message },
      { status: message === "Technician not found." ? 404 : 500 }
    );
  }
}
