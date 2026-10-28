import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { deleteTeam, updateTeam } from "../../../../lib/db";

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
    return NextResponse.json({ error: "Invalid team id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const technicianIds = Array.isArray(body.technicianIds)
      ? (body.technicianIds as unknown[])
          .map(Number)
          .filter((tid) => Number.isInteger(tid) && tid > 0)
      : [];

    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const team = await updateTeam(id, name, technicianIds);
    return NextResponse.json({ team });
  } catch (error) {
    const isDuplicate =
      typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
    const message = isDuplicate
      ? `A team named "${name}" already exists.`
      : error instanceof Error
        ? error.message
        : "Unable to update team.";
    return NextResponse.json(
      { error: message },
      { status: isDuplicate ? 409 : message === "Team not found." ? 404 : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid team id." }, { status: 400 });
  }

  try {
    const deletedTeam = await deleteTeam(id);
    return NextResponse.json({ deletedTeam });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete team.";
    return NextResponse.json(
      { error: message },
      { status: message === "Team not found." ? 404 : 500 },
    );
  }
}
