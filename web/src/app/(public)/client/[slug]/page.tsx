import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { ClientWorkspace } from "@/components/booking/ClientWorkspace";
export default async function Page({params}: {params: Promise<{slug: string}>}) {
  if(dataSource === "mock") notFound();
  const {slug}=await params;
  return <ClientWorkspace slug={slug} />;
}
