import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function BookingFooter() {
  return (
    <footer className="border-t border-line-soft mt-12">
      <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-micro">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="lock" size={12} /> Secure checkout · Powered by Slotera
        </span>
        <span className="flex items-center gap-4">
          <Link href="#" className="hover:text-ink">Terms</Link>
          <Link href="#" className="hover:text-ink">Privacy</Link>
          <Link href="#" className="hover:text-ink">Imprint</Link>
        </span>
      </div>
    </footer>
  );
}
