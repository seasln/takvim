import { Plus_Jakarta_Sans } from "next/font/google";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import "./calendar-airbnb.css";

const calendarSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-calendar-airbnb",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div
      className={`calendar-airbnb ${calendarSans.variable} flex min-h-screen flex-1 flex-col bg-[#0c0c0f] font-[family-name:var(--font-calendar-airbnb),system-ui,sans-serif] text-[#ececf1] antialiased`}
    >
      {children}
    </div>
  );
}
