import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PilotApplication } from "@/components/public/PilotApplication";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Join the pilot · Slotera" };

// The pilot waitlist lives in the real app; the mock demo only links here.
export default function Page() {
  if (dataSource !== "api") notFound();
  return <PilotApplication />;
}
