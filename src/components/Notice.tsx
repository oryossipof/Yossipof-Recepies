import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const STYLES = {
  error: {
    box: "border-destructive/40 bg-destructive/10 text-destructive",
    Icon: AlertCircle,
  },
  success: {
    box: "border-primary/40 bg-primary/10 text-primary",
    Icon: CheckCircle2,
  },
  info: {
    box: "border-border bg-muted text-muted-foreground",
    Icon: Info,
  },
} as const;

/** Inline feedback: a failed save, a mail that was sent, a hint. */
export function Notice({
  kind = "info",
  children,
  className,
}: {
  kind?: keyof typeof STYLES;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  const { box, Icon } = STYLES[kind];

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
