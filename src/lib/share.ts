/*
 * Handing a file to the device.
 *
 * There is exactly one way a web page can put a document into a WhatsApp
 * message or an email: navigator.share with a file in it, which opens the
 * phone's own share sheet. A `wa.me` or `mailto:` link cannot do it — those
 * schemes carry text and nothing else — so the chooser has to be the operating
 * system's, and the list of apps in it is the phone's business rather than
 * ours.
 *
 * Everything here is synchronous and answers a question. Nothing here calls
 * navigator.share, and that is deliberate: the browser will only open the
 * sheet while the tap that asked for it is still live, and it has proved
 * unwilling to grant that through a helper. The call itself belongs inline in
 * the click handler, as the first thing it does.
 */

/** A stand-in document, for asking whether files can be carried at all. */
function probeFile(): File {
  return new File([], "recipe.pdf", { type: "application/pdf" });
}

/**
 * True when this browser will carry a file, not merely text.
 *
 * Asked with a nought-byte stand-in, because the question has to be answered
 * before there is a real document — it decides whether a share button is
 * offered at all. The `try` is not decoration: Safari has answered this call
 * by throwing rather than returning false.
 */
export function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.share !== "function") return false;
    if (typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [probeFile()] });
  } catch {
    return false;
  }
}

/**
 * True when this browser will carry *this* document.
 *
 * Worth asking separately, because a browser can wave through the empty
 * stand-in above and still refuse the real thing. Asked while the page is
 * being drawn rather than on the sending tap, so that nothing stands between
 * that tap and the share sheet.
 */
export function canCarry(file: File): boolean {
  try {
    if (typeof navigator.canShare !== "function") return true;
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * True when the share failed only because the person backed out of the sheet.
 *
 * Choosing not to send is a decision rather than a fault, and answering it
 * with a red notice would be telling someone off for changing their mind.
 */
export function isDismissal(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** The browser's own account of a refusal, for a notice that can be acted on. */
export function refusalDetail(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
