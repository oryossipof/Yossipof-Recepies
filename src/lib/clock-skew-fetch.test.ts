import { describe, expect, it, vi } from "vitest";

import { clockSkewFetch } from "./clock-skew-fetch";

const future = () =>
  new Response(JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }), {
    status: 401,
  });
const ok = () => new Response("[]", { status: 200 });
const noWait = () => Promise.resolve();

describe("clockSkewFetch", () => {
  it("retries a request refused as issued in the future until it succeeds", async () => {
    const base = vi.fn().mockResolvedValueOnce(future()).mockResolvedValueOnce(ok());
    const res = await clockSkewFetch(base, [1, 1, 1], noWait)("https://x/rest/v1/recipes");
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last delay and returns the refusal", async () => {
    const base = vi.fn().mockImplementation(() => Promise.resolve(future()));
    const res = await clockSkewFetch(base, [1, 1], noWait)("https://x");
    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("leaves other failures alone", async () => {
    const base = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: "PGRST301", message: "JWT expired" }), { status: 401 }),
      );
    const res = await clockSkewFetch(base, [1], noWait)("https://x");
    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not retry successes", async () => {
    const base = vi.fn().mockResolvedValue(ok());
    await clockSkewFetch(base, [1], noWait)("https://x");
    expect(base).toHaveBeenCalledTimes(1);
  });
});
