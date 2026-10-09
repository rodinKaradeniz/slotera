import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Slotera" };

export default function Page() {
  return <LegalPage doc="privacy" />;
}
