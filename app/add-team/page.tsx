import { redirect } from "next/navigation";
import TeamManager from "../components/TeamManager";
import { getCurrentUser } from "../../lib/auth";

export const metadata = {
  title: "Teams | TicketDesk",
  description: "Organise technicians into field teams for efficient dispatch and management.",
};

export default async function AddTeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TeamManager user={user} />;
}
