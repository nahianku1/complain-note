import TicketDashboard from "./components/TicketDashboard";
import { getCurrentUser } from "../lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TicketDashboard user={user} />;
}
