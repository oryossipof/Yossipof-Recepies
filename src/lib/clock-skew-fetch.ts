/**
 * A `fetch` that waits out "JWT issued at future".
 *
 * Supabase Auth stamps every access token with the moment it was issued
 * (`iat`), and the database's API (PostgREST) refuses a token whose `iat` is
 * still ahead of its own clock — answering 401 with code PGRST303. The two run
 * on different machines, so right after a sign-in or a token refresh the clocks
 * can disagree by a second or two and the very first reads bounce. Nothing is
 * actually wrong with the token: a moment later it is accepted. The app used
 * to show the raw "JWT issued at future" above an empty shelf instead.
 *
 * So when that specific refusal comes back, wait a little and send the same
 * request again. Any other response, including other 401s, passes straight
 * through untouched.
 */

/** How long to wait before each retry, in milliseconds. */
export const CLOCK_SKEW_RETRY_DELAYS = [1000, 2000, 4000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Whether a response is PostgREST's "token issued in the future" refusal. */
export async function isIssuedAtFuture(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body = (await response.clone().json()) as { code?: unknown; message?: unknown };
    return (
      body.code === "PGRST303" ||
      (typeof body.message === "string" && /issued at future/i.test(body.message))
    );
  } catch {
    return false;
  }
}

export function clockSkewFetch(
  baseFetch: typeof fetch = (...args) => fetch(...args),
  delays: number[] = CLOCK_SKEW_RETRY_DELAYS,
  wait: (ms: number) => Promise<void> = sleep,
): typeof fetch {
  return async (input, init) => {
    let response = await baseFetch(input, init);
    for (const delay of delays) {
      if (!(await isIssuedAtFuture(response))) return response;
      await wait(delay);
      // A Request object's body can only be read once, so send a fresh copy.
      response = await baseFetch(input instanceof Request ? input.clone() : input, init);
    }
    return response;
  };
}
