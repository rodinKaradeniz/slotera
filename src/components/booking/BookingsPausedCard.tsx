"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ContactModal } from "@/components/public/ContactModal";

type Props = {
  /** Operator's public display name. */
  displayName: string;
};

/**
 * Rendered on /booking when the operator has toggled `bookingPageEnabled = false`
 * in Settings → Business Profile. Existing booking links keep working but visitors
 * see a soft "currently paused" message instead of the stepper.
 *
 * Visual brief: paper card, big muted icon, the operator's name front-and-centre,
 * one CTA (Get in touch) that opens the shared ContactModal.
 */
export function BookingsPausedCard({ displayName }: Props) {
  const [contactOpen, setContactOpen] = React.useState(false);

  return (
    <>
      <Card padded className="text-center max-w-xl mx-auto">
        <div className="flex flex-col items-center gap-5 py-6">
          <span className="w-14 h-14 rounded-full bg-paper-2 text-ink-3 flex items-center justify-center">
            <Icon name="pause" size={22} />
          </span>

          <div className="flex flex-col gap-2">
            <div className="eyebrow">{displayName}</div>
            <h1
              className="font-serif text-ink"
              style={{
                fontSize: 30,
                fontWeight: 380,
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              Bookings are paused
            </h1>
            <p className="text-body text-ink-3 max-w-md mx-auto">
              This booking page isn&apos;t currently accepting new reservations.
              If you need to get in touch, send a message and we&apos;ll reply.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            icon="mail"
            onClick={() => setContactOpen(true)}
          >
            Get in touch
          </Button>
        </div>
      </Card>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
