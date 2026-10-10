import { describe, expect, it, vi } from "vitest";

/*
 * Only the URL check is under test here, and it has nothing to ask Supabase.
 * The client module refuses to load without the project's environment
 * variables, so it is stood in for.
 */
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { isUploadedRecipeImage } = await import("./images");

/**
 * The same rule the database function applies before it lets one person change
 * another person's recipe photo. It is written twice on purpose — once where it
 * can be enforced and once where it can be explained — so these cases describe
 * the server's rule as much as this function's.
 */
describe("isUploadedRecipeImage", () => {
  it("accepts a photo in the app's own bucket", () => {
    expect(
      isUploadedRecipeImage(
        "https://abc.supabase.co/storage/v1/object/public/recipe-images/user-1/photo.jpg",
      ),
    ).toBe(true);
  });

  it("rejects an address somewhere else on the web", () => {
    expect(isUploadedRecipeImage("https://example.com/recipe-images/photo.jpg")).toBe(false);
  });

  it("rejects another bucket in the same project", () => {
    expect(
      isUploadedRecipeImage(
        "https://abc.supabase.co/storage/v1/object/public/recipe-avatars/user-1/avatar.jpg",
      ),
    ).toBe(false);
  });

  it("rejects a recipe with no photo at all", () => {
    expect(isUploadedRecipeImage(null)).toBe(false);
  });
});
