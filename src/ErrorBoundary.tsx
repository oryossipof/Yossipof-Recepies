import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, a missing VITE_SUPABASE_* variable on the host produces a
// blank white screen with no clue what went wrong — the most common way a
// deploy goes sideways.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isConfigError = error.message.includes("Supabase");

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 space-y-4 text-center">
          <span className="text-4xl block">🛒</span>
          <h1 className="text-lg font-bold text-foreground">האפליקציה לא נטענה</h1>

          {isConfigError ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>חסרה הגדרת חיבור למסד הנתונים.</p>
              <p className="text-xs">
                בדקו שהוגדרו המשתנים <code className="font-mono">VITE_SUPABASE_URL</code> ו-
                <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> בהגדרות האתר,
                ואז בנו מחדש.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              משהו השתבש. נסו לרענן את הדף.
            </p>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            רענון
          </button>

          <details className="text-right">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              פרטים טכניים
            </summary>
            <pre className="mt-2 text-[10px] text-muted-foreground whitespace-pre-wrap break-words text-left" dir="ltr">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
