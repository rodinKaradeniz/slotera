import * as React from "react";
import { Card } from "@/components/ui/Card";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthCard({ eyebrow, title, subtitle, children, footer }: Props) {
  return (
    <Card padded className="shadow-pop">
      {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
      <h1 className="text-h2 text-ink">{title}</h1>
      {subtitle && <p className="text-body mt-3 text-ink-3">{subtitle}</p>}
      <div className="mt-8">{children}</div>
      {footer && (
        <div className="mt-6 pt-5 border-t border-line-soft text-small text-center">
          {footer}
        </div>
      )}
    </Card>
  );
}
