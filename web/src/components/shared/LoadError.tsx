import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = { message: string; onRetry: () => void };

/** Shown in place of a list or page whose request failed. */
export function LoadError({ message, onRetry }: Props) {
  return (
    <Card className="flex flex-col items-start gap-3" role="alert">
      <div className="text-[13px] font-medium text-ink">Couldn&apos;t load this</div>
      <div className="text-[13px] text-ink-3">{message}</div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}
