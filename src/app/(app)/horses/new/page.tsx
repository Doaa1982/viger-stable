import { requirePerm } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { HorseForm } from "../horse-form";
import { createHorse } from "../actions";

export default async function NewHorsePage() {
  await requirePerm("horsesEdit");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Add a horse" />
      <HorseForm action={createHorse} submitLabel="Save horse" />
    </div>
  );
}
