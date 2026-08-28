import { beforeEach, describe, expect, it } from "vitest";

import { goBack, navigate, returnTo } from "./router";

/**
 * A history traversal runs as its own task, so wait for it. Returning to a
 * screen that is not the one behind replaces instead and fires nothing, hence
 * the timeout as well as the event.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("popstate", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 100);
    window.addEventListener("popstate", done);
  });
}

beforeEach(() => {
  // Every case starts from a single-entry history on the list screen.
  window.history.replaceState(null, "", "/#/");
});

describe("returning from a screen", () => {
  it("steps back out of the editor rather than stacking a second copy of the recipe", async () => {
    navigate("/recipe/abc");
    navigate("/edit/abc");

    returnTo("/recipe/abc"); // what save() does
    await settle();
    expect(window.location.hash).toBe("#/recipe/abc");

    // One press, not two: the editor's entry left with it, and the recipe was
    // not laid down a second time on top of the one already behind.
    goBack();
    await settle();
    expect(window.location.hash).toBe("#/");
  });

  it("still reaches the list in one press after several rounds of editing", async () => {
    navigate("/recipe/abc");
    for (let round = 0; round < 3; round++) {
      navigate("/edit/abc");
      returnTo("/recipe/abc");
      await settle();
    }

    goBack();
    await settle();
    expect(window.location.hash).toBe("#/");
  });

  it("climbs to the recipe and then to the list when the editor was opened cold", async () => {
    // A link straight into the editor: there is no history to unwind at all.
    window.history.replaceState(null, "", "/#/edit/abc");

    goBack();
    await settle();
    expect(window.location.hash).toBe("#/recipe/abc");

    goBack();
    await settle();
    expect(window.location.hash).toBe("#/");
  });

  it("leaves a saved new recipe one press from the list", async () => {
    navigate("/new");
    returnTo("/recipe/fresh");
    await settle();
    expect(window.location.hash).toBe("#/recipe/fresh");

    goBack();
    await settle();
    expect(window.location.hash).toBe("#/");
  });

  it("closes the cooking screen onto the recipe it was started from", async () => {
    navigate("/recipe/abc");
    navigate("/cook/abc");

    goBack();
    await settle();
    expect(window.location.hash).toBe("#/recipe/abc");
  });
});
