import { afterEach, describe, expect, it, vi } from "vitest";

import { canCarry, canShareFiles, isDismissal, refusalDetail } from "./share";

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

describe("canCarry", () => {
  const file = new File(["x"], "עוגה.pdf", { type: "application/pdf" });

  it("asks about the real document, not a stand-in", () => {
    const canShare = vi.fn((_data: ShareData) => true);
    browser({ share: vi.fn(), canShare });

    expect(canCarry(file)).toBe(true);
    expect(canShare.mock.calls[0][0].files?.[0]).toBe(file);
  });

  it("says no when the browser turns this document down", () => {
    // The interesting case: the empty stand-in was waved through and the real
    // file is not, which is why the two questions are asked separately.
    browser({ share: vi.fn(), canShare: () => false });
    expect(canCarry(file)).toBe(false);
  });

  it("says no when asking throws", () => {
    browser({
      share: vi.fn(),
      canShare: () => {
        throw new Error("nope");
      },
    });
    expect(canCarry(file)).toBe(false);
  });

  it("gives the benefit of the doubt where canShare is missing", () => {
    // Nothing to ask, so the share itself is left to answer.
    browser({ share: vi.fn(), canShare: undefined });
    expect(canCarry(file)).toBe(true);
  });
});

describe("isDismissal", () => {
  it("recognises backing out of the sheet", () => {
    expect(isDismissal(new DOMException("cancelled", "AbortError"))).toBe(true);
  });

  it("does not mistake a refusal for a dismissal", () => {
    expect(isDismissal(new DOMException("denied", "NotAllowedError"))).toBe(false);
    expect(isDismissal(new Error("boom"))).toBe(false);
    expect(isDismissal("boom")).toBe(false);
  });
});

describe("refusalDetail", () => {
  it("quotes the browser's own name and message", () => {
    const e = new DOMException("Permission denied", "NotAllowedError");
    expect(refusalDetail(e)).toBe("NotAllowedError: Permission denied");
  });

  it("copes with something that is not an error at all", () => {
    expect(refusalDetail("odd")).toBe("odd");
  });
});
