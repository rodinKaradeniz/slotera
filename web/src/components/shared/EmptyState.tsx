import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";

type Props = {
  icon?: IconName;
  title: string;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "sparkle",
  title,
  body,
  actions,
  className,
}: Props) {
  return (
    <Card padded className={className}>
      <div className="flex flex-col items-center text-center gap-4 py-8">
        <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center">
          <Icon name={icon} size={26} />
        </div>
        <div className="max-w-md">
          <h2 className="text-h3 text-ink">{title}</h2>
          {body && <p className="text-body mt-2 text-ink-3">{body}</p>}
        </div>
        {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
      </div>
    </Card>
  );
}
