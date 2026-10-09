import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · Slotera" };

export default function Page() {
  return <LegalPage doc="terms" />;
}
