import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { isExpiredSessionError } from "@/lib/errors";

/*
 * Keeping the access token alive.
 *
 * Supabase signs every request with an access token that is good for an hour,
 * and the client renews it in the background on a timer. A phone suspends that
 * timer the moment the app goes behind something else — and it stops it
 * altogether while the screen is off. Come back to the app the next morning and
 * the stored token is long expired, while the client, which has only just woken
 * up, hands it to the first requests anyway. The database answers "JWT expired",
 * which is the red line the recipes never arrived behind, and nothing asked
 * again once the renewal did go through: the screen stayed empty until the page
 * was reloaded by hand.
 *
 * So two things happen here. A token that is spent — or about to be — is
 * renewed before the request that would have carried it, and a request refused
 * over its token anyway is given one more go behind a fresh one. Reloading the
 * page is then never the thing that fixes it.
 */

/** A token with less than this left on it is treated as already gone. */
const MARGIN_SECONDS = 60;

/**
 * The shortest time between two renewals. A device whose clock is wrong by
 * hours believes every token it is handed has already expired; without this,
 * each renewal would ask for another. The token lives an hour, so nothing
 * legitimate needs renewing twice in the same minute.
 */
const MIN_GAP_MS = 30_000;

/**
 * How long anything waits for a renewal before carrying on without one. The
 * splash screen waits on this, and an app opened with no signal at all should
 * still open: the renewal is left running, and the app picks up the new token
 * from the event that arrives when it lands.
 */
const PATIENCE_MS = 8_000;

let inFlight: Promise<Session | null> | null = null;
let lastAttempt = 0;

/** Seconds left on this session's access token, by the device's own clock. */
function secondsLeft(session: Session): number {
  return (session.expires_at ?? 0) - Date.now() / 1000;
}

/** Whether this session's token is spent, or close enough to it. */
export function isSessionStale(session: Session): boolean {
  return secondsLeft(session) <= MARGIN_SECONDS;
}

/**
 * Renews the session. Concurrent callers — and on start-up there are several,
 * one per thing the app loads — share the single renewal rather than each
 * asking for one of their own. Returns null if it could not be done, which is
 * the honest answer when the device is offline or the refresh token has been
 * withdrawn; the caller then carries on and lets the request itself fail with
 * whatever the real reason is.
 */
export function renewSession(): Promise<Session | null> {
  if (inFlight) return inFlight;
  if (Date.now() - lastAttempt < MIN_GAP_MS) return Promise.resolve(null);

  lastAttempt = Date.now();
  const renewal = supabase.auth
    .refreshSession()
    .then(({ data }) => data.session)
    .catch(() => null);

  inFlight = Promise.race([
    renewal,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PATIENCE_MS)),
  ]).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Makes sure the next request will travel with a token that is still good. */
export async function ensureFreshSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  // No session at all is not this function's problem: whatever runs next will
  // be refused for the right reason.
  if (data.session && isSessionStale(data.session)) await renewSession();
}

/**
 * Runs something that talks to Supabase, with a good token in hand, and runs it
 * once more behind a new token if the server refuses the old one regardless.
 * Safe to retry: a request turned away over its token never reached the data.
 *
 * `work` has to throw on failure rather than hand back an error — which is what
 * the hooks already do with everything Supabase returns.
 */
export async function withFreshSession<T>(work: () => Promise<T>): Promise<T> {
  await ensureFreshSession();

  try {
    return await work();
  } catch (e) {
    if (!isExpiredSessionError(e)) throw e;
    await renewSession();
    return work();
  }
}
