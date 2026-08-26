import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import { signOut, updatePassword, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/Notice";

/**
 * Shown when the user follows the "forgot password" mail. Supabase has already
 * signed them in with a recovery session, so all that is left is choosing a new
 * password — and nothing else in the app is reachable until they do.
 */
export function RecoveryScreen() {
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("הסיסמאות אינן זהות");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      finishRecovery();
    } catch (e) {
      setError(e instanceof Error ? e.message : "עדכון הסיסמה נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-4"
      >
        <header className="space-y-1 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">בחירת סיסמה חדשה</h1>
        </header>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">סיסמה חדשה</Label>
          <Input
            id="new-password"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">אישור סיסמה</Label>
          <Input
            id="confirm-password"
            type="password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          שמירת הסיסמה
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-primary underline-offset-4 hover:underline"
          >
            ביטול והתנתקות
          </button>
        </p>
      </form>
    </div>
  );
}
