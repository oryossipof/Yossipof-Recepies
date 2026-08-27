import { supabase } from "@/integrations/supabase/client";

/**
 * One call to a Supabase Edge Function, with the function's own words kept.
 *
 * The functions here report their failures as JSON with a Hebrew message meant
 * for the user — "the AI service is busy", "the daily quota is used up". The
 * client library flattens all of that into a generic "non-2xx status code", so
 * the real message has to be dug back out of the response it held on to.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let detail = "";
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        detail = (await context.json())?.error ?? "";
      } catch {
        // Body was not JSON — fall back to the generic message.
      }
    }
    throw new Error(detail || fallback);
  }

  return data as T;
}
