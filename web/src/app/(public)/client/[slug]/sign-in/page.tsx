import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { ClientSignIn } from "@/components/booking/ClientSignIn";
export default async function Page({params}: {params: Promise<{slug: string}>}) {
  if (dataSource === "mock") notFound();
  const {slug} = await params;
  return <ClientSignIn slug={slug} />;
}
