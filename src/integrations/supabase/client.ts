import { createClient } from "@supabase/supabase-js";

import { clockSkewFetch } from "@/lib/clock-skew-fetch";

import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const missing = [
    ...(!SUPABASE_URL ? ["VITE_SUPABASE_URL"] : []),
    ...(!SUPABASE_PUBLISHABLE_KEY ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
  throw new Error(
    `חסרים משתני סביבה של Supabase: ${missing.join(", ")}. ` +
      `הוסיפו אותם לקובץ .env המקומי ולהגדרות האתר אצל ספק האחסון.`,
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // The password-reset mail lands on the app with the recovery token in the
    // URL; supabase-js picks it up and turns it into a session for us.
    detectSessionInUrl: true,
    flowType: "pkce",
  },
  // Rides out the second or two when a fresh token is "issued at future" by
  // the database's clock — see clock-skew-fetch.ts.
  global: { fetch: clockSkewFetch() },
});
