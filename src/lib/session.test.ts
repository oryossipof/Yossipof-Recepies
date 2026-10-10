import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

/*
 * The Supabase client is stood in for: what matters here is which token a
 * request would travel with and what happens when the server refuses it, not
 * that there is a project at the other end. `getSession` and `refreshSession`
 * are the only two calls the module makes.
 */
const getSession = vi.fn();
const refreshSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, refreshSession } },
}));

/**
 * A fresh copy of the module for each case. It deliberately remembers when it
 * last renewed a token — a device with a wrong clock would otherwise renew for
 * ever — and that memory would carry from one case into the next.
 */
async function freshModule() {
  vi.resetModules();
  return import("./session");
}

const HOUR = 3600;

/** A session whose token runs out in `secondsLeft`. Negative means it is gone. */
function session(secondsLeft: number): Session {
  return {
    access_token: `token-${secondsLeft}`,
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: Math.max(secondsLeft, 0),
    expires_at: Math.round(Date.now() / 1000 + secondsLeft),
    // Only the expiry is read here; the user is the one field Session insists on.
    user: { id: "user-1" } as Session["user"],
  };
}

/** What PostgREST says when the token it was handed had expired. */
const expired = { message: "JWT expired", code: "PGRST301", details: null, hint: null };

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: session(HOUR) } });
  refreshSession.mockResolvedValue({ data: { session: session(HOUR) }, error: null });
});

describe("isSessionStale", () => {
  it("accepts a token with most of its hour left", async () => {
    const { isSessionStale } = await freshModule();
    expect(isSessionStale(session(HOUR))).toBe(false);
  });

  it("rejects a token that has already run out", async () => {
    const { isSessionStale } = await freshModule();
    expect(isSessionStale(session(-120))).toBe(true);
  });

  it("rejects a token about to run out, so a slow request still arrives in time", async () => {
    const { isSessionStale } = await freshModule();
    expect(isSessionStale(session(10))).toBe(true);
  });
});

describe("ensureFreshSession", () => {
  it("renews a token that expired while the app was away", async () => {
    const { ensureFreshSession } = await freshModule();
    getSession.mockResolvedValue({ data: { session: session(-HOUR) } });

    await ensureFreshSession();

    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("leaves a good token alone", async () => {
    const { ensureFreshSession } = await freshModule();

    await ensureFreshSession();

    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("has nothing to renew when nobody is signed in", async () => {
    const { ensureFreshSession } = await freshModule();
    getSession.mockResolvedValue({ data: { session: null } });

    await ensureFreshSession();

    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("renews once for the several loads that start together", async () => {
    const { ensureFreshSession } = await freshModule();
    getSession.mockResolvedValue({ data: { session: session(-HOUR) } });

    let release = () => {};
    refreshSession.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ data: { session: session(HOUR) }, error: null });
      }),
    );

    const all = Promise.all([ensureFreshSession(), ensureFreshSession(), ensureFreshSession()]);
    release();
    await all;

    expect(refreshSession).toHaveBeenCalledOnce();
  });
});

describe("withFreshSession", () => {
  it("hands back what the read found", async () => {
    const { withFreshSession } = await freshModule();

    await expect(withFreshSession(async () => "עוגת שוקולד")).resolves.toBe("עוגת שוקולד");
  });

  it("renews and tries again when the server refuses the token anyway", async () => {
    const { withFreshSession } = await freshModule();
    const read = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce(["recipe"]);

    await expect(withFreshSession(read)).resolves.toEqual(["recipe"]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("does not retry a failure that has nothing to do with the token", async () => {
    const { withFreshSession } = await freshModule();
    const denied = { message: 'permission denied for table "recipes"', code: "42501" };
    const read = vi.fn().mockRejectedValue(denied);

    await expect(withFreshSession(read)).rejects.toBe(denied);
    expect(read).toHaveBeenCalledOnce();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("gives up after one retry rather than asking for ever", async () => {
    const { withFreshSession } = await freshModule();
    const read = vi.fn().mockRejectedValue(expired);

    await expect(withFreshSession(read)).rejects.toBe(expired);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
