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
 * Not every browser implements the half of the Web Share API that carries
 * files. Firefox for Android and the older Samsung Internet share text
 * happily and refuse documents, and desktop Firefox has neither. So the
 * capability is asked about before a share button is offered at all, rather
 * than discovered at the moment of the tap.
 */

/**
 * True when this browser will carry a file, not merely text.
 *
 * The question can only be asked with a file in hand, so a nought-byte PDF
 * stands in for the real one: `canShare` looks at the type and the count, not
 * at the bytes. The `try` is not decoration — Safari has answered this call
 * by throwing rather than returning false.
 */
export function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.share !== "function") return false;
    if (typeof navigator.canShare !== "function") return false;
    return navigator.canShare({
      files: [new File([], "recipe.pdf", { type: "application/pdf" })],
    });
  } catch {
    return false;
  }
}

/**
 * Opens the device's share sheet carrying the file.
 *
 * Must be called inside a live tap: the browser gives a gesture about five
 * seconds of authority and refuses the sheet after that, so nothing may be
 * awaited between the tap and this call. Building the file is the caller's
 * job, and has to have happened already.
 *
 * Backing out of the sheet resolves rather than rejects. The browser reports
 * a dismissal as an AbortError, but choosing not to send is a decision, and
 * answering it with a red error would be telling the user off for changing
 * their mind.
 */
export async function shareFile(file: File, title: string): Promise<void> {
  try {
    await navigator.share({ files: [file], title });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    throw e;
  }
}
