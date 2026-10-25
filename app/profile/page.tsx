import { redirect } from "next/navigation";
import ProfileSettings from "../components/ProfileSettings";
import { getCurrentUser } from "../../lib/auth";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ProfileSettings initialUser={user} />;
}
