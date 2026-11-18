import { connection } from "next/server";
import type { Metadata } from "next";
import { PageScrollbar } from "@/components/ui/ScrollArea";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { DemoGuideProvider } from "@/components/public/DemoGuideProvider";
import "./fonts/fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slotera: booking software for consultants & coaches",
  description:
    "Paid booking and session management for individual service providers.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonces belong to each document, including public and error surfaces.
  await connection();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
    >
      <body id="page-content" className="min-h-screen bg-paper text-ink antialiased">
        <I18nProvider>
          <ToastProvider>
            <PageScrollbar />
            {/* DemoGuide modal is a single shared instance — the public nav and
                the auth shell both expose triggers, so the provider lives at the
                root. Auto-open stays landing-only via <DemoGuideAutoOpen />. */}
            <DemoGuideProvider>{children}</DemoGuideProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
