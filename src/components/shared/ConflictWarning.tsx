import * as React from "react";
import { Icon } from "@/components/ui/Icon";

type Props = { message?: string };

export function ConflictWarning({
  message = "This time overlaps with another session.",
}: Props) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-md bg-[#F4E9D6] border border-[rgba(180,123,43,0.3)] text-warning">
      <Icon name="alert" size={16} className="mt-0.5 flex-shrink-0" />
      <span className="text-[13px] leading-snug">{message}</span>
    </div>
  );
}
