import { supabase } from "@/integrations/supabase/client";

// Photos come off phone cameras at several megabytes. They are resized and
// re-encoded in the browser before they ever reach Supabase Storage, which
// keeps uploads quick on mobile data and the bucket small.

const RECIPE_MAX_WIDTH = 1200;
const AVATAR_MAX_WIDTH = 400;
const QUALITY = 0.82;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("לא ניתן לפתוח את התמונה"));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("לא ניתן לקרוא את הקובץ"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** Resizes to fit `maxWidth` and re-encodes as JPEG. */
async function compress(file: File, maxWidth: number): Promise<Blob> {
  const img = await loadImage(await readAsDataUrl(file));

  let { width, height } = img;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("הדפדפן אינו תומך בעיבוד תמונות");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("לא ניתן לעבד את התמונה");
  return blob;
}

async function upload(bucket: string, path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Uploads a recipe photo and returns its public URL. */
export async function uploadRecipeImage(userId: string, file: File): Promise<string> {
  const blob = await compress(file, RECIPE_MAX_WIDTH);
  return upload("recipe-images", `${userId}/${crypto.randomUUID()}.jpg`, blob);
}

/**
 * Uploads the user's avatar and returns its public URL. The path is stable per
 * user, so a cache-busting query is appended — otherwise the browser keeps
 * showing the previous picture.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await compress(file, AVATAR_MAX_WIDTH);
  const url = await upload("recipe-avatars", `${userId}/avatar.jpg`, blob);
  return `${url}?v=${Date.now()}`;
}

/** Base64 payload for the AI parser, which reads recipe photos directly. */
export async function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  const dataUrl = await readAsDataUrl(file);
  return {
    data: dataUrl.replace(/^data:[^;]+;base64,/, ""),
    mimeType: file.type || "image/jpeg",
  };
}
