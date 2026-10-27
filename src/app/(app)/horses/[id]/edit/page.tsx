import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { HorseForm } from "../../horse-form";
import { deleteHorse, updateHorse } from "../../actions";
import { getOwnedHorse } from "../../data";

export default async function EditHorsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const horse = await getOwnedHorse(user, id);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Edit ${horse.name}`}
        actions={
          <form action={deleteHorse.bind(null, id)}>
            <ConfirmButton className="btn-danger btn-sm" message={`Delete ${horse.name} and all records? This cannot be undone.`}>Delete horse</ConfirmButton>
          </form>
        }
      />
      <HorseForm action={updateHorse.bind(null, id)} horse={horse} submitLabel="Save changes" />
    </div>
  );
}
