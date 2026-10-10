/**
 * Turning whatever a `catch` caught into something worth showing a person.
 *
 * The reason this needs saying: Supabase rejects with a `PostgrestError`, which
 * is a plain object carrying `message`, `details` and `hint` — it is not an
 * `Error`. So the obvious `e instanceof Error ? e.message : "…נכשל"` misses
 * every database failure there is and replaces the one useful sentence with a
 * generic one, which is how the app came to say only "טעינת המתכונים נכשלה"
 * without ever saying what went wrong.
 */
/**
 * What a person is told when the request was refused because the token it
 * travelled with had run out. The app renews the token by itself and tries the
 * request again, so this sentence only appears when even that did not help.
 * It does not say to reload the page: on a phone the app is installed to the
 * home screen, where there is no address bar to reload from. Trying again is
 * what renews the token, and the main screen offers that beside the message.
 */
export const EXPIRED_SESSION_MESSAGE =
  "ההתחברות פגה. נסו שוב, ואם זה חוזר — התנתקו והתחברו מחדש.";

/**
 * Whether this is the server refusing a request because its access token had
 * expired. Supabase says so in more than one voice — PostgREST answers with
 * the code PGRST301, Storage and the Edge Functions with a sentence — so each
 * of them is recognised here. No Supabase client is touched: this has to stay
 * a question that can be asked about a caught value anywhere.
 */
export function isExpiredSessionError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;

  const { code, message } = e as { code?: unknown; message?: unknown };
  if (code === "PGRST301") return true;
  if (typeof message !== "string") return false;

  const said = message.toLowerCase();
  return (
    said.includes("jwt expired") ||
    said.includes("jwt is expired") ||
    said.includes("token is expired") ||
    said.includes("token has expired") ||
    said.includes("invalid jwt")
  );
}

export function errorMessage(e: unknown, fallback: string): string {
  if (isExpiredSessionError(e)) return EXPIRED_SESSION_MESSAGE;
  if (typeof e === "string" && e.trim()) return e;

  if (typeof e === "object" && e !== null) {
    const { message } = e as { message?: unknown };
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}
