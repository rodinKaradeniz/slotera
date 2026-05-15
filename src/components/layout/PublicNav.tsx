"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line-soft">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-[14px] text-ink-2 ml-6">
          <Link href="#features" className="hover:text-ink">Features</Link>
          <Link href="#pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/booking" className="hover:text-ink">Live demo</Link>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm" iconRight="arrow-right">
              Start free trial
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
