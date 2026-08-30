import { afterEach, describe, expect, it, vi } from "vitest";

import { canShareFiles, shareFile } from "./share";

/**
 * jsdom ships no Web Share API at all, so every case here installs the exact
 * browser being described. That is the point of the tests: the interesting
 * browsers are the ones that answer half the question — text yes, files no —
 * and there is no way to meet one of those except by building it.
 */
function browser(navigatorPatch: Record<string, unknown>): void {
  vi.stubGlobal("navigator", { ...navigator, ...navigatorPatch });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("canShareFiles", () => {
  it("says no when the browser has no Web Share API", () => {
    browser({ share: undefined, canShare: undefined });
    expect(canShareFiles()).toBe(false);
  });

  it("says no when the browser shares text but not files", () => {
    // Firefox for Android, and the older Samsung Internet: share() exists,
    // canShare() exists, and it turns a document down.
    browser({ share: vi.fn(), canShare: () => false });
    expect(canShareFiles()).toBe(false);
  });

  it("says no when share() exists without canShare()", () => {
    // Web Share Level 1 on its own cannot be asked about files, so the only
    // safe reading of it is that files are not on offer.
    browser({ share: vi.fn(), canShare: undefined });
    expect(canShareFiles()).toBe(false);
  });

  it("says no when asking throws", () => {
    browser({
      share: vi.fn(),
      canShare: () => {
        throw new Error("nope");
      },
    });
    expect(canShareFiles()).toBe(false);
  });

  it("says yes when the browser accepts a PDF", () => {
    const canShare = vi.fn((_data: ShareData) => true);
    browser({ share: vi.fn(), canShare });
    expect(canShareFiles()).toBe(true);

    // Asked about a file, and about a PDF specifically.
    expect(canShare.mock.calls[0][0].files?.[0].type).toBe("application/pdf");
  });
});

describe("shareFile", () => {
  const file = new File(["x"], "עוגה.pdf", { type: "application/pdf" });

  it("hands the file and the title to the share sheet", async () => {
    const share = vi.fn(() => Promise.resolve());
    browser({ share });

    await shareFile(file, "עוגה.pdf");

    expect(share).toHaveBeenCalledWith({ files: [file], title: "עוגה.pdf" });
  });

  it("treats backing out of the sheet as done, not as a failure", async () => {
    browser({
      share: () => Promise.reject(new DOMException("cancelled", "AbortError")),
    });

    await expect(shareFile(file, "עוגה.pdf")).resolves.toBeUndefined();
  });

  it("passes a real failure on", async () => {
    browser({
      share: () => Promise.reject(new DOMException("denied", "NotAllowedError")),
    });

    await expect(shareFile(file, "עוגה.pdf")).rejects.toThrow("denied");
  });
});
