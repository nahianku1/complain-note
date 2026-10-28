import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createTeam, getTeams } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const teams = await getTeams();
    return NextResponse.json({ teams });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load teams." },
      { status: 500 },
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
    const technicianIds = Array.isArray(body.technicianIds)
      ? (body.technicianIds as unknown[])
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const team = await createTeam(name, technicianIds);
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    const isDuplicate =
      typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
    const message = isDuplicate
      ? `A team named "${name}" already exists.`
      : error instanceof Error
        ? error.message
        : "Unable to create team.";
    return NextResponse.json({ error: message }, { status: isDuplicate ? 409 : 500 });
  }
}
