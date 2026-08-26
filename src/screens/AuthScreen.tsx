import { useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";

import { sendPasswordReset, signIn, signUp } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/Notice";

type Mode = "signin" | "signup" | "forgot";

const TITLES: Record<Mode, string> = {
  signin: "כניסה",
  signup: "הרשמה",
  forgot: "איפוס סיסמה",
};

/** Sign in, sign up and "forgot my password" — one screen, three modes. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signin") {
        await signIn(email, password);
        // The auth listener swaps this screen out for the app.
      } else if (mode === "signup") {
        await signUp(email, password, displayName);
        setMessage(
          "נשלח אליכם מייל לאישור הכתובת. אם ההרשמה כבר פעילה — אפשר פשוט להתחבר.",
        );
        setMode("signin");
      } else {
        await sendPasswordReset(email);
        setMessage("שלחנו קישור לאיפוס סיסמה לכתובת שהזנתם.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "משהו השתבש");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ChefHat className="size-7" />
          </span>
          <h1 className="text-2xl font-bold">מתכונים</h1>
          <p className="text-sm text-muted-foreground">ספר המתכונים המשותף שלנו</p>
        </header>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">{TITLES[mode]}</h2>

          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">שם</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>
          )}

          {error && <Notice kind="error">{error}</Notice>}
          {message && <Notice kind="success">{message}</Notice>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "כניסה" : mode === "signup" ? "הרשמה" : "שליחת קישור"}
          </Button>

          <div className="space-y-1 text-center text-sm">
            {mode === "signin" && (
              <>
                <p>
                  <button
                    type="button"
                    onClick={() => switchTo("forgot")}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    שכחתי סיסמה
                  </button>
                </p>
                <p className="text-muted-foreground">
                  אין לכם חשבון?{" "}
                  <button
                    type="button"
                    onClick={() => switchTo("signup")}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    הרשמה
                  </button>
                </p>
              </>
            )}

            {mode !== "signin" && (
              <p className="text-muted-foreground">
                <button
                  type="button"
                  onClick={() => switchTo("signin")}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  חזרה לכניסה
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
