import { aiEnabled } from "@/lib/ai/client";
import { ROLE_LABEL, getAccess } from "@/lib/access";
import { Sidebar, type NavGroup } from "@/components/nav";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, can, stableName } = await getAccess();
  const member = user.role === "MEMBER";
  // Platform accounts: stables and riders run a yard; members get what their stable role allows
  const yardAccount = member ? can("yard") : user.role === "STABLE" || user.role === "RIDER";
  const ownerOnly = (ok: boolean) => (member ? false : ok);
  const g = (title: string, items: (NavGroup["items"][number] | false)[]): NavGroup => ({ title, items: items.filter(Boolean) as NavGroup["items"] });

  const groups: NavGroup[] = [
    g("Overview", [
      yardAccount && { href: "/dashboard", label: "Dashboard" },
      (member || yardAccount) && can("portal") && { href: "/me", label: member && !can("yard") ? "My account" : "My shifts & tasks" },
      can("assistant") && yardAccount && { href: "/assistant", label: "AI Assistant", ai: true },
      can("assistant") && yardAccount && { href: "/ai", label: "AI Center", ai: true },
    ]),
    g("Bookings", [
      yardAccount && can("customerBookings") && { href: "/customer-bookings", label: "Customer bookings" },
      yardAccount && can("bookingSettings") && { href: "/booking-page", label: "Booking page" },
    ]),
    g("Riders & team", [
      yardAccount && can("students") && { href: "/students", label: "Riding school" },
      yardAccount && can("team") && { href: "/team", label: "People & access" },
    ]),
    g("Run the yard", [
      yardAccount && { href: "/tasks", label: "Tasks" },
      yardAccount && can("staffRota") && { href: "/staff", label: "Staff & rota" },
      yardAccount && { href: "/health", label: "Health Hub" },
      yardAccount && { href: "/feeding", label: "Feeding" },
      yardAccount && { href: "/yard-board", label: "Yard board" },
      yardAccount && can("finance") && { href: "/finance", label: "Finance" },
      yardAccount && can("breeding") && { href: "/breeding", label: "Breeding" },
    ]),
    g("Horses", [
      (yardAccount || ownerOnly(user.role === "PROFESSIONAL")) && { href: "/horses", label: member ? "Horses" : "My horses" },
      (!member || can("marketplace")) && { href: "/marketplace", label: "Marketplace", ai: true },
      !member && { href: "/trials", label: "Trials" },
      !member && { href: "/saved", label: "Saved" },
    ]),
    g("Community", [
      { href: "/arena", label: "The Arena" },
      { href: "/messages", label: "Messages" },
      !member && { href: "/professionals", label: "Professionals" },
      !member && { href: "/bookings", label: "Bookings" },
      !member && { href: "/jobs", label: "Jobs & talent" },
    ]),
    g("Account", [{ href: "/profile", label: "Profile" }]),
  ].filter((grp) => grp.items.length > 0);

  const roleText = member ? `${ROLE_LABEL[role] ?? role} · ${stableName}` : `${user.role.charAt(0) + user.role.slice(1).toLowerCase()} account`;
  return (
    <div className="min-h-screen md:flex">
      <Sidebar groups={groups} userName={user.name} role={roleText} aiOn={aiEnabled()} logout={logout} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
