import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { uploadRecipeImage } from "@/lib/images";
import { Button } from "@/components/ui/button";

import { Notice } from "./Notice";

/**
 * Picks a photo for the recipe, compresses and uploads it, and keeps the public
 * URL. The upload happens on choosing the file so that pressing save is never
 * a long wait.
 */
export function ImageField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file || !user) return;

    setBusy(true);
    setError(null);
    try {
      onChange(await uploadRecipeImage(user.id, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative w-full max-w-xs overflow-hidden rounded-lg border border-border">
          <img src={value} alt="תמונת המתכון" className="aspect-square w-full object-cover" />
          <button
            type="button"
            aria-label="הסרת התמונה"
            onClick={() => onChange(null)}
            className="absolute left-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {busy ? "מעלה…" : "בחירת תמונה"}
        </Button>
      )}

      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
