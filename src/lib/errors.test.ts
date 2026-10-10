import { describe, expect, it } from "vitest";

import { EXPIRED_SESSION_MESSAGE, errorMessage, isExpiredSessionError } from "./errors";

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

  it("says what to do about an expired token instead of repeating the server", () => {
    expect(errorMessage({ message: "JWT expired", code: "PGRST301" }, "נכשל")).toBe(
      EXPIRED_SESSION_MESSAGE,
    );
  });
});

describe("isExpiredSessionError", () => {
  it("knows the database's answer", () => {
    expect(isExpiredSessionError({ message: "JWT expired", code: "PGRST301" })).toBe(true);
  });

  it("knows the storage and function answers, whatever their wording", () => {
    expect(isExpiredSessionError({ message: "Invalid JWT" })).toBe(true);
    expect(isExpiredSessionError(new Error("jwt is expired"))).toBe(true);
    expect(isExpiredSessionError({ message: "Token has expired" })).toBe(true);
  });

  it("does not mistake another refusal for an expired token", () => {
    expect(isExpiredSessionError({ message: "permission denied", code: "42501" })).toBe(false);
    expect(isExpiredSessionError(new Error("Failed to fetch"))).toBe(false);
    expect(isExpiredSessionError("jwt expired")).toBe(false);
    expect(isExpiredSessionError(null)).toBe(false);
  });
});
