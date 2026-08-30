import { Mail, MessageCircle, Share2 } from "lucide-react";

import {
  mailtoLink,
  recipeAsText,
  whatsappLink,
  type SharedRecipe,
} from "@/lib/recipe-share";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// "Send this one to my sister."
//
// Two ways out of the app, and the choice between them is the whole dialog.
// Both hand the recipe over as text — the words themselves, not a link — so it
// can be read in the chat or in the mail by someone who has no account here and
// no intention of getting one. The link to the recipe rides along at the end for
// the family, who do.
//
// Nothing is saved and nothing is written back: the recipe leaves exactly as it
// is stored.

function Choice({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-right transition-colors hover:bg-accent/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export function ShareRecipeDialog({
  open,
  onClose,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  recipe: SharedRecipe;
}) {
  const text = recipeAsText(recipe);

  function send(url: string): void {
    // The chat and the mail app both take over the screen, so the dialog has
    // no reason to still be open behind them when the sender comes back.
    onClose();
    window.location.href = url;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            שיתוף המתכון
          </DialogTitle>
          <DialogDescription>איך לשלוח את "{recipe.title}"?</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Choice
            icon={<MessageCircle />}
            label="וואטסאפ"
            hint="המתכון נשלח כהודעה, ובוחרים למי בוואטסאפ"
            onClick={() => send(whatsappLink(text))}
          />

          <Choice
            icon={<Mail />}
            label="אימייל"
            hint="נפתחת הודעה חדשה עם המתכון בגוף המייל"
            onClick={() => send(mailtoLink(recipe.title, text))}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            סגירה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
