"use client";

import * as React from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ContactModal } from "./ContactModal";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Item = {
  icon: IconName;
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
};

const PERSONAS: { slug: string; label: string }[] = [
  { slug: "consultant", label: "Consultant" },
  { slug: "vet", label: "Vet" },
  { slug: "therapist", label: "Therapist" },
  { slug: "trainer", label: "Personal trainer" },
];

const ITEMS: Item[] = [
  {
    icon: "lock",
    title: "Sign in or create a demo account",
    body: "Use the authentication flow to provision a workspace and access the admin dashboard.",
    href: "/register",
    ctaLabel: "Create demo account",
  },
  {
    icon: "grid",
    title: "Explore the admin dashboard",
    body: "Create services, manage availability, view bookings, and test the main admin workflows.",
    href: "/admin/dashboard",
    ctaLabel: "Open admin dashboard",
  },
  {
    icon: "eye",
    title: "Test the public booking page",
    body: "See exactly what customers see when they book a service end-to-end.",
    href: "/booking",
    ctaLabel: "Try booking flow",
  },
];

export function DemoGuidelinesModal({ open, onClose }: Props) {
  const [contactOpen, setContactOpen] = React.useState(false);

  const openContact = () => {
    onClose();
    setContactOpen(true);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title={
          <span className="block">
            <span className="eyebrow block mb-2">Demo guide</span>
            <span
              className="block font-serif text-ink"
              style={{
                fontSize: 30,
                fontWeight: 380,
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              Welcome to Slotera
            </span>
            <span className="block text-body-lg text-ink-3 mt-3 italic">
              Paid bookings, without the calendar chaos.
            </span>
            <span className="block text-body text-ink-2 mt-3">
              This is a demo version of Slotera, built to showcase the main
              booking and admin workflows. Some features are mocked while the
              product is still in progress.
            </span>
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={onClose}
            >
              Start exploring
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-small text-ink-3">You can try:</p>
          <ol className="flex flex-col gap-3">
            {ITEMS.map((item, i) => (
              <li
                key={item.title}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-line-soft bg-surface-warm px-4 py-3"
              >
                <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <Icon name={item.icon} size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink">
                    <span className="text-ink-3 mr-1.5">{i + 1}.</span>
                    {item.title}
                  </div>
                  <p className="text-small mt-0.5">{item.body}</p>
                </div>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="shrink-0 sm:ml-2"
                >
                  <Button variant="secondary" size="sm" iconRight="arrow-right">
                    {item.ctaLabel}
                  </Button>
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-1 rounded-md border border-line-soft bg-surface-warm px-4 py-3">
            <div className="text-[14px] font-medium text-ink">
              Try the booking page in a different context
            </div>
            <p className="text-small mt-0.5 mb-2.5">
              The same booking flow, with services and intake forms tailored to
              each kind of provider.
            </p>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/booking?demo=${p.slug}`}
                  onClick={onClose}
                >
                  <Button variant="secondary" size="sm" iconRight="arrow-right">
                    {p.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-start gap-3 rounded-md border border-line-soft bg-paper-2 px-4 py-3 text-small">
            <div className="flex items-start gap-2 flex-1">
              <Icon
                name="info"
                size={14}
                className="text-ink-3 mt-0.5 shrink-0"
              />
              <span>
                <strong className="text-ink-2">Note:</strong> This is a demo
                environment, so some flows use mocked data while the product is
                still in progress. If anything looks off, you spot a bug or a
                broken flow, have a business inquiry or feature request, or
                would like to book time to discuss Slotera — feel free to
                reach out.
              </span>
            </div>
            <div className="shrink-0 sm:self-center">
              <Button
                variant="secondary"
                size="sm"
                icon="mail"
                onClick={openContact}
              >
                Contact us
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </>
  );
}
