import { PublicTransfer } from "@aia/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicTransfer id={id} />;
}
