import { useEffect, useState } from "react";

/**
 * Keeps the screen alight for as long as the component using it is mounted.
 *
 * A phone left alone on the counter locks itself in half a minute, and the
 * hands that would wake it are covered in dough. The lock is a request, not a
 * guarantee: it is refused on a browser that has no Wake Lock API, and the
 * system drops it whenever the tab goes to the background — a phone call, a
 * glance at a message — so it has to be asked for again on the way back.
 *
 * Returns whether it is currently held, which is worth saying on screen: a
 * cook should know whether to trust the phone to stay awake.
 */
export function useWakeLock(): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let done = false;

    async function hold() {
      if (done || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        // Unmounted while the request was in flight: let it go again.
        if (done) {
          void sentinel.release();
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        // A refusal — low battery, an unsupported browser — costs the cook
        // nothing but the promise of a lit screen, so it stays quiet.
        setHeld(false);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void hold();
    }

    void hold();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  return held;
}
