import type { Metadata } from "next";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { DemoGuideProvider } from "@/components/public/DemoGuideProvider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Slotera — Booking software for consultants & coaches",
  description:
    "Paid reservation and session management for individual service providers.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink antialiased">
        <I18nProvider>
          <ToastProvider>
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
