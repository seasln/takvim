import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
}
