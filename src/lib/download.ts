/**
 * Hands a generated file to the device.
 *
 * An anchor with a `download` attribute is the one way that behaves on every
 * phone in the family: Chrome on Android drops the file in Downloads, and
 * Safari on iOS offers it to the Files app. The object URL is released a moment
 * later rather than immediately, because Safari has not finished reading it by
 * the time the click returns.
 */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
