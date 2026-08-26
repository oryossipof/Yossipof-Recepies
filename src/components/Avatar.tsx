import { cn } from "@/lib/utils";

/** First letter of the name (or of the email) as a stand-in for a photo. */
function initial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export function Avatar({
  name,
  url,
  size = "sm",
  className,
}: {
  name: string | null | undefined;
  url: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-6 text-[0.65rem]",
    md: "size-10 text-sm",
    lg: "size-24 text-2xl",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        initial(name)
      )}
    </span>
  );
}
