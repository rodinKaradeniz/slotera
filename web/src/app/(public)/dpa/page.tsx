import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: "Data Processing Agreement · Slotera" };

export default function Page() {
  return <LegalPage doc="dpa" />;
}
