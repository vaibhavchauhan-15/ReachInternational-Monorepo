import { redirect } from "next/navigation";

export default async function MachineEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/machines/${id}`);
}
