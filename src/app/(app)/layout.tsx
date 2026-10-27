import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/client";
import { Sidebar, type NavGroup } from "@/components/nav";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const yard = user.role === "STABLE" || user.role === "RIDER";
  const groups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/assistant", label: "AI Assistant", ai: true },
        { href: "/ai", label: "AI Center", ai: true },
      ],
    },
    ...(yard
      ? [
          {
            title: "Run the yard",
            items: [
              { href: "/customer-bookings", label: "Customer bookings" },
              { href: "/booking-page", label: "Booking page" },
              { href: "/tasks", label: "Tasks" },
              { href: "/staff", label: "Staff & rota" },
              { href: "/health", label: "Health Hub" },
              { href: "/feeding", label: "Feeding" },
              { href: "/yard-board", label: "Yard board" },
              { href: "/finance", label: "Finance" },
              { href: "/breeding", label: "Breeding" },
            ],
          },
        ]
      : []),
    {
      title: "Horses",
      items: [
        ...(user.role !== "FAN" ? [{ href: "/horses", label: "My horses" }] : []),
        { href: "/marketplace", label: "Marketplace", ai: true },
        { href: "/trials", label: "Trials" },
        { href: "/saved", label: "Saved" },
      ],
    },
    {
      title: "Community",
      items: [
        { href: "/arena", label: "The Arena" },
        { href: "/messages", label: "Messages" },
        { href: "/professionals", label: "Professionals" },
        { href: "/bookings", label: "Bookings" },
        { href: "/jobs", label: "Jobs & talent" },
      ],
    },
    { title: "Account", items: [{ href: "/profile", label: "Profile" }] },
  ];

  return (
    <div className="min-h-screen md:flex">
      <Sidebar groups={groups} userName={user.name} role={user.role} aiOn={aiEnabled()} logout={logout} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
