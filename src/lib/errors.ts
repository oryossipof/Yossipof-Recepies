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
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === "string" && e.trim()) return e;

  if (typeof e === "object" && e !== null) {
    const { message } = e as { message?: unknown };
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}
