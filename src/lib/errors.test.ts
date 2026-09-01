import { describe, expect, it } from "vitest";

import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("reads a real Error", () => {
    expect(errorMessage(new Error("אין חיבור"), "נכשל")).toBe("אין חיבור");
  });

  it("reads a Supabase error, which is a plain object and not an Error", () => {
    const postgrest = {
      message: 'permission denied for table "recipes"',
      details: null,
      hint: null,
      code: "42501",
    };
    expect(postgrest instanceof Error).toBe(false);
    expect(errorMessage(postgrest, "טעינת המתכונים נכשלה")).toBe(
      'permission denied for table "recipes"',
    );
  });

  it("falls back only when there is genuinely nothing to say", () => {
    expect(errorMessage(null, "נכשל")).toBe("נכשל");
    expect(errorMessage(undefined, "נכשל")).toBe("נכשל");
    expect(errorMessage({}, "נכשל")).toBe("נכשל");
    expect(errorMessage({ message: "   " }, "נכשל")).toBe("נכשל");
    expect(errorMessage(new Error(""), "נכשל")).toBe("נכשל");
  });

  it("passes a thrown string through", () => {
    expect(errorMessage("משהו השתבש", "נכשל")).toBe("משהו השתבש");
  });
});
