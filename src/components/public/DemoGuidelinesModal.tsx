"use client";

import * as React from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ContactModal } from "./ContactModal";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
};

type StepId = "dashboard" | "booking" | "reservation";

type Item = {
  id: StepId;
  icon: IconName;
  href: string;
};

const ITEMS: Item[] = [
  { id: "dashboard", icon: "grid", href: "/admin/dashboard" },
  { id: "booking", icon: "eye", href: "/booking" },
  { id: "reservation", icon: "clipboard", href: "/reservation/demo" },
];

const PERSONAS: { slug: "consultant" | "vet" | "therapist" | "trainer" }[] = [
  { slug: "consultant" },
  { slug: "vet" },
  { slug: "therapist" },
  { slug: "trainer" },
];

export function DemoGuidelinesModal({ open, onClose }: Props) {
  const { t } = useI18n();
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
        size="lg"
        title={
          <span className="block">
            <span className="eyebrow block mb-2">{t("demoGuide.eyebrow")}</span>
            <span
              className="block font-serif text-ink"
              style={{
                fontSize: 30,
                fontWeight: 380,
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              {t("demoGuide.title")}
            </span>
            <span className="block text-body text-ink-2 mt-3">
              {t("demoGuide.disclaimer")}
            </span>
          </span>
        }
        footer={
          <div className="flex flex-1 flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Account creation is intentionally secondary to the demo cards. */}
            <Link
              href="/register"
              onClick={onClose}
              className="text-[13px] text-ink-3 hover:text-ink underline-offset-2 hover:underline self-center sm:self-auto"
            >
              {t("demoGuide.createAccount")}
            </Link>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                {t("demoGuide.close")}
              </Button>
              <Button variant="primary" iconRight="arrow-right" onClick={onClose}>
                {t("demoGuide.startExploring")}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-small text-ink-3">{t("demoGuide.youCanTry")}</p>
          <ol className="flex flex-col gap-3">
            {ITEMS.map((item, i) => (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-md border border-line-soft bg-surface-warm px-4 py-3"
              >
                <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0 self-start sm:self-center">
                  <Icon name={item.icon} size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink">
                    <span className="text-ink-3 mr-1.5">{i + 1}.</span>
                    {t(`demoGuide.step.${item.id}.title`)}
                  </div>
                  <p className="text-small mt-0.5">
                    {t(`demoGuide.step.${item.id}.body`)}
                  </p>

                  {/* The booking step keeps its default link on the left; the
                      persona chips live in the right-hand column below. */}
                  {item.id === "booking" && (
                    <Link
                      href="/booking"
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink mt-2.5"
                    >
                      {t("demoGuide.step.booking.defaultLink")}
                      <Icon name="arrow-right" size={13} />
                    </Link>
                  )}
                </div>

                {/* Booking step: persona/context chips on the right (stacked on
                    mobile). Compact pill chips rather than full buttons. */}
                {item.id === "booking" && (
                  <div className="shrink-0 sm:w-[208px] sm:text-right">
                    <div className="text-micro mb-1.5">
                      {t("demoGuide.step.booking.tryAs")}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {PERSONAS.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/booking?demo=${p.slug}`}
                          onClick={onClose}
                          className="inline-flex items-center h-7 px-2.5 rounded-full border border-line bg-surface text-[12px] text-ink-2 hover:border-ink-3 hover:text-ink transition-colors"
                        >
                          {t(`demoGuide.persona.${p.slug}`)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Steps 1 + 2 keep a single right-aligned CTA. */}
                {item.id !== "booking" && (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="shrink-0 sm:ml-2"
                  >
                    <Button variant="secondary" size="sm" iconRight="arrow-right">
                      {t(`demoGuide.step.${item.id}.cta`)}
                    </Button>
                  </Link>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-start gap-3 rounded-md border border-line-soft bg-paper-2 px-4 py-3 text-small">
            <div className="flex items-start gap-2 flex-1">
              <Icon
                name="info"
                size={14}
                className="text-ink-3 mt-0.5 shrink-0"
              />
              <span>
                <strong className="text-ink-2">
                  {t("demoGuide.noteLabel")}
                </strong>{" "}
                {t("demoGuide.note")}
              </span>
            </div>
            <div className="shrink-0 sm:self-center">
              <Button
                variant="secondary"
                size="sm"
                icon="mail"
                onClick={openContact}
              >
                {t("demoGuide.contact")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
