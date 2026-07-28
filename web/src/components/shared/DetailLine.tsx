import * as React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type Props = {
  icon: IconName;
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
};

export function DetailLine({ icon, label, value, action }: Props) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-micro">{label}</div>
        <div className="text-[14px] text-ink truncate">{value}</div>
      </div>
      {action}
    </div>
  );
}
