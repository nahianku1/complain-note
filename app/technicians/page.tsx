import { redirect } from "next/navigation";
import TechnicianManager from "../components/TechnicianManager";
import { getCurrentUser } from "../../lib/auth";

export const metadata = {
  title: "Technicians | TicketDesk",
  description: "Manage technician profiles, contact details, and NID identification.",
};

export default async function TechniciansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TechnicianManager user={user} />;
}
