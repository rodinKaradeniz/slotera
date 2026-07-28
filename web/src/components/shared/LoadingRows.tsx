import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = { count?: number; className?: string };

export function LoadingRows({ count = 5, className }: Props) {
  return (
    <Card padded={false} className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-4 border-b border-line-soft last:border-b-0"
        >
          <Skeleton w={36} h={36} className="rounded-full" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton w="40%" h={12} />
            <Skeleton w="60%" h={10} />
          </div>
          <Skeleton w={72} h={20} className="rounded-full" />
          <Skeleton w={80} h={20} className="rounded-full" />
        </div>
      ))}
    </Card>
  );
}
