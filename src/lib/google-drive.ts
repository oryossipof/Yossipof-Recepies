/*
 * Google Drive file picker.
 *
 * Instead of asking for a share link — which only works when the file is
 * published to "anyone with the link" — the app opens Google's own picker on
 * the user's Drive, gets a short-lived access token for it, and downloads the
 * file straight from the browser. The token never leaves the device: only the
 * text (or the image bytes) reaches the parsing function.
 *
 * Three build-time values are needed, all from the same Google Cloud project:
 *   VITE_GOOGLE_CLIENT_ID  — OAuth 2.0 Web client ID, with this app's origin
 *                            listed under "Authorized JavaScript origins".
 *   VITE_GOOGLE_API_KEY    — API key, used as the picker's developer key.
 *   VITE_GOOGLE_APP_ID     — the project number, which the picker needs before
 *                            it can hand a file to a drive.file app.
 * Without them the picker is unavailable and the importer falls back to the
 * old share-link field.
 */

import { docxToHtml, isDocx, isLegacyDoc } from "./docx";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;

/**
 * Access to the picked file only — not to the rest of the Drive. Every user
 * signs in with their own Google account and opens their own Drive, and the
 * app is handed exactly the one file they chose. This is also the scope that
 * keeps the app out of Google's restricted-scope verification, which is what
 * lets anyone in the family use it and not only accounts on a test list.
 */
const SCOPE = "https://www.googleapis.com/auth/drive.file";

export const drivePickerConfigured = Boolean(CLIENT_ID && API_KEY && APP_ID);

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

export type DrivePick = {
  file: DriveFile;
  token: string;
};

/** What came back from Drive, in the shape the parser wants. */
export type DriveContent =
  | { kind: "text"; text: string }
  | { kind: "binary"; data: string; mimeType: string };

// ------------------------------------------------------------------
// Google's scripts, loaded on demand
// ------------------------------------------------------------------

// Minimal shapes for the two globals Google's scripts install. Typing only
// what is actually called keeps this honest without pulling in @types/gapi.
type TokenResponse = { access_token?: string; expires_in?: number; error?: string };

type TokenClient = { requestAccessToken: (overrides?: { prompt?: string }) => void };

type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
    };
  };
  // The picker builder is a fluent, untyped API; see the Google Picker docs.
  picker?: Record<string, any>;
};

type GapiGlobal = { load: (name: string, callback: () => void) => void };

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: GapiGlobal;
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const pending = scripts.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scripts.delete(src);
      reject(new Error("טעינת Google Drive נכשלה. בדקו את החיבור לאינטרנט."));
    };
    document.head.appendChild(el);
  });

  scripts.set(src, promise);
  return promise;
}

let pickerReady: Promise<void> | null = null;

/** `gapi.load` is callback-based and must finish before `google.picker` exists. */
function loadPicker(): Promise<void> {
  pickerReady ??= loadScript("https://apis.google.com/js/api.js").then(
    () =>
      new Promise<void>((resolve, reject) => {
        const gapi = window.gapi;
        if (!gapi) return reject(new Error("טעינת Google Drive נכשלה"));
        gapi.load("picker", () => resolve());
      }),
  );
  return pickerReady;
}

// ------------------------------------------------------------------
// Access token
// ------------------------------------------------------------------

// Kept for the lifetime of the page so picking a second file does not send the
// user through the consent popup again. A minute of slack covers the round
// trip to Drive after the picker closes.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  await loadScript("https://accounts.google.com/gsi/client");
  const google = window.google;
  if (!google) throw new Error("טעינת Google Drive נכשלה");

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID as string,
      scope: SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          return reject(new Error("ההרשאה ל-Google Drive לא הושלמה"));
        }
        cachedToken = {
          value: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "חלון ההרשאה של Google נסגר"
              : "ההרשאה ל-Google Drive נכשלה. ודאו שחלונות קופצים אינם חסומים.",
          ),
        );
      },
    });

    client.requestAccessToken();
  });
}

// ------------------------------------------------------------------
// The picker
// ------------------------------------------------------------------

/**
 * Opens the Drive picker. Resolves with the chosen file, or with `null` when
 * the user closed the picker without choosing anything.
 */
export async function pickDriveFile(): Promise<DrivePick | null> {
  if (!drivePickerConfigured) {
    throw new Error("בחירת קובץ מ-Google Drive לא הוגדרה באפליקציה");
  }

  const token = await accessToken();
  await loadPicker();

  const picker = window.google?.picker;
  if (!picker) throw new Error("טעינת Google Drive נכשלה");

  return new Promise<DrivePick | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const dialog = new picker.PickerBuilder()
      .setTitle("בחרו קובץ מתכון")
      .setLocale("he")
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY as string)
      // With the drive.file scope the app only gets the file once the picker
      // hands it over, and it can only do that when it knows the project.
      .setAppId(APP_ID as string)
      .addView(view)
      .setCallback((data: { action: string; docs?: DriveFile[] }) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          dialog.dispose();
          resolve(doc ? { file: doc, token } : null);
        } else if (data.action === picker.Action.CANCEL) {
          dialog.dispose();
          resolve(null);
        }
      })
      .build();

    dialog.setVisible(true);
  });
}

// ------------------------------------------------------------------
// Downloading what was picked
// ------------------------------------------------------------------

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDES = "application/vnd.google-apps.presentation";

/** Google's own formats have no bytes to download — they are exported instead. */
const EXPORT_AS: Record<string, string> = {
  [GOOGLE_DOC]: "text/plain",
  [GOOGLE_SHEET]: "text/csv",
  [GOOGLE_SLIDES]: "text/plain",
};

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json|html?|rtf)$/i;

function isTextual({ name, mimeType }: DriveFile): boolean {
  return mimeType.startsWith("text/") || TEXT_EXTENSIONS.test(name);
}

async function driveFetch(url: string, token: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) return res;

  if (res.status === 401 || res.status === 403) {
    // The token is either expired or was refused; force a fresh one next time.
    cachedToken = null;
    throw new Error("אין הרשאה לקרוא את הקובץ מ-Google Drive. נסו לבחור אותו שוב.");
  }
  throw new Error(`קריאת הקובץ מ-Google Drive נכשלה (${res.status})`);
}

/** Reads the picked file with the token the picker was opened with. */
export async function readDriveFile({ file, token }: DrivePick): Promise<DriveContent> {
  const exportAs = EXPORT_AS[file.mimeType];

  if (exportAs) {
    const url =
      `https://www.googleapis.com/drive/v3/files/${file.id}/export` +
      `?mimeType=${encodeURIComponent(exportAs)}`;
    const text = (await (await driveFetch(url, token)).text()).trim();
    if (!text) throw new Error("הקובץ ריק");
    return { kind: "text", text };
  }

  if (file.mimeType.startsWith("application/vnd.google-apps")) {
    throw new Error("סוג הקובץ ב-Google Drive אינו נתמך. בחרו מסמך, PDF, תמונה או קובץ טקסט.");
  }

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    token,
  );

  // A Word file uploaded to Drive is still a Word file: Drive will not export
  // it, so it is unzipped here exactly like one picked off the disk.
  if (isDocx(file.name, file.mimeType)) {
    return { kind: "text", text: docxToHtml(await res.arrayBuffer()) };
  }

  if (isLegacyDoc(file.name, file.mimeType)) {
    throw new Error(
      "הקובץ שמור בפורמט Word הישן (doc.). שמרו אותו מחדש כ-docx, " +
        "או פתחו אותו ב-Google Docs ובחרו אותו משם.",
    );
  }

  if (isTextual(file)) {
    const text = (await res.text()).trim();
    if (!text) throw new Error("הקובץ ריק");
    return { kind: "text", text };
  }

  if (file.mimeType === "application/pdf" || file.mimeType.startsWith("image/")) {
    return { kind: "binary", data: base64(await res.arrayBuffer()), mimeType: file.mimeType };
  }

  throw new Error(
    "סוג הקובץ אינו נתמך. אפשר לבחור מסמך Google, קובץ טקסט, PDF או תמונה — " +
      "או פשוט להדביק את המתכון כטקסט.",
  );
}

/** Base64 in chunks, so a large PDF does not blow the argument limit. */
function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
