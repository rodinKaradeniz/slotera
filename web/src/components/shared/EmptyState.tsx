import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";

type Props = {
  /** What the missing things are (a service, a client): never a generic sparkle. */
  icon: IconName;
  title: string;
  /** One sentence that teaches the next step. */
  body?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, body, actions, className }: Props) {
  return (
    <Card padded className={className}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
          <Icon name={icon} size={20} />
        </div>
        <div className="min-w-0 max-w-[60ch]">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {body && <p className="text-body mt-1 text-ink-3">{body}</p>}
          {actions && <div className="flex flex-wrap gap-2 mt-4">{actions}</div>}
        </div>
      </div>
    </Card>
  );
}
