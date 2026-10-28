import { redirect } from "next/navigation";
import TicketTypesManager from "../components/TicketTypesManager";
import { getCurrentUser } from "../../lib/auth";

export default async function TicketTypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TicketTypesManager user={user} />;
}
