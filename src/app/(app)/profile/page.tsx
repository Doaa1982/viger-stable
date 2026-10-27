import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Card, PageHeader } from "@/components/ui";
import { label } from "@/lib/utils";
import { updateProfile } from "./actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const pro = user.role === "PROFESSIONAL";
  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" subtitle={`${label(user.role)} account${user.trade ? ` · ${label(user.trade)}` : ""} · ${user.email}`} />
      <Card>
        <form action={updateProfile} className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2"><span className="lbl">Name</span><input name="name" className="input" defaultValue={user.name} /></label>
          <label className="block"><span className="lbl">City</span><input name="city" className="input" defaultValue={user.city ?? ""} /></label>
          <label className="block"><span className="lbl">Phone / WhatsApp</span><input name="phone" className="input" defaultValue={user.phone ?? ""} /></label>
          <label className="block md:col-span-2"><span className="lbl">About</span><textarea name="bio" rows={3} className="input" defaultValue={user.bio ?? ""} /></label>
          {pro && (
            <>
              <label className="block md:col-span-2"><span className="lbl">Credentials / licence</span><input name="credentials" className="input" defaultValue={user.credentials ?? ""} /></label>
              <label className="block"><span className="lbl">Rates</span><input name="rates" className="input" defaultValue={user.rates ?? ""} /></label>
              <label className="block"><span className="lbl">Service area</span><input name="serviceArea" className="input" defaultValue={user.serviceArea ?? ""} /></label>
            </>
          )}
          <div className="md:col-span-2"><SubmitButton>Save profile</SubmitButton></div>
        </form>
      </Card>
    </div>
  );
}
