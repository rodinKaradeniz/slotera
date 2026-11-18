import { cn } from "@/lib/cn";
export function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const value = Math.max(
    0,
    Math.min(100, limit > 0 ? (used / limit) * 100 : 0),
  );
  return (
    <div className="space-y-2 rounded-lg border border-line bg-paper p-4">
      <p className="text-body">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-2 overflow-hidden rounded-full bg-line-soft"
      >
        <div
          className={cn(
            "h-full rounded-full bg-accent",
            value >= 90 && "bg-warning",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
