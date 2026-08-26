import { useRef, useState } from "react";
import { Camera, FileText, Link2, Loader2, Sparkles, Upload } from "lucide-react";

import {
  parseFromDrive,
  parseFromFile,
  parseFromImage,
  parseFromText,
  parseFromUrl,
  type ParsedRecipe,
  type SourceKind,
} from "@/lib/parse-recipe";
import { isBlankHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { Notice } from "./Notice";
import { RichTextEditor } from "./RichTextEditor";

// The front door of the add-recipe screen: whatever form the recipe arrives in,
// it lands here, goes to the AI, and comes back split into the app's fields.

type Source = { kind: SourceKind; label: string; Icon: typeof FileText };

const SOURCES: Source[] = [
  { kind: "text", label: "הדבקת טקסט", Icon: FileText },
  { kind: "file", label: "העלאת קובץ", Icon: Upload },
  { kind: "drive", label: "Google Drive", Icon: Link2 },
  { kind: "image", label: "תמונה מהגלריה", Icon: Camera },
  { kind: "url", label: "קישור למתכון", Icon: Link2 },
];

export function RecipeImporter({
  onParsed,
}: {
  onParsed: (recipe: ParsedRecipe, source: { kind: SourceKind; ref: string | null }) => void;
}) {
  const [kind, setKind] = useState<SourceKind>("text");
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  async function run(work: () => Promise<ParsedRecipe>, ref: string | null) {
    setBusy(true);
    setError(null);
    try {
      onParsed(await work(), { kind, ref });
    } catch (e) {
      setError(e instanceof Error ? e.message : "פירוק המתכון נכשל");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    switch (kind) {
      case "text":
        if (isBlankHtml(pasted)) return setError("הדביקו קודם את המתכון");
        return void run(() => parseFromText(pasted), null);
      case "url":
        if (!url.trim()) return setError("הזינו כתובת של דף מתכון");
        return void run(() => parseFromUrl(url.trim()), url.trim());
      case "drive":
        if (!url.trim()) return setError("הזינו קישור ל-Google Drive");
        return void run(() => parseFromDrive(url.trim()), url.trim());
      case "file":
        return fileRef.current?.click();
      case "image":
        return imageRef.current?.click();
    }
  }

  function chooseSource(next: SourceKind) {
    setKind(next);
    setError(null);
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div>
        <h2 className="text-base font-semibold">מאיפה לקחת את המתכון?</h2>
        <p className="text-sm text-muted-foreground">
          ה-AI יפרק אותו אוטומטית לשם, רכיבים, אופן הכנה, הערות וערכים תזונתיים.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOURCES.map(({ kind: sourceKind, label, Icon }) => (
          <button
            key={sourceKind}
            type="button"
            aria-pressed={kind === sourceKind}
            onClick={() => chooseSource(sourceKind)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              kind === sourceKind
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {kind === "text" && (
        <RichTextEditor
          value={pasted}
          onChange={setPasted}
          placeholder="הדביקו כאן את המתכון — העיצוב של המקור יישמר"
          minHeight="10rem"
        />
      )}

      {(kind === "url" || kind === "drive") && (
        <Input
          type="url"
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            kind === "drive" ? "https://drive.google.com/…" : "https://example.com/recipe"
          }
        />
      )}

      {kind === "drive" && (
        <p className="text-xs text-muted-foreground">
          הקישור צריך להיות משותף להצגה לכל מי שיש לו את הקישור.
        </p>
      )}

      {kind === "file" && (
        <p className="text-sm text-muted-foreground">
          קובץ טקסט, PDF או תמונה. קובצי Word — עדיף להעתיק ולהדביק את התוכן.
        </p>
      )}

      {kind === "image" && (
        <p className="text-sm text-muted-foreground">
          צלמו את המתכון או בחרו תמונה מהגלריה, וה-AI יקרא אותה.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,.json,.html,.htm,.rtf,application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(() => parseFromFile(file), file.name);
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(() => parseFromImage(file), file.name);
        }}
      />

      <Button type="button" onClick={submit} disabled={busy} className="w-full">
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "מפרק את המתכון…" : "פירוק אוטומטי"}
      </Button>

      {error && <Notice kind="error">{error}</Notice>}
    </section>
  );
}
