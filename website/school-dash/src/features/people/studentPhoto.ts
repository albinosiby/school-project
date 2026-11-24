/**
 * Thumbnail of a student photograph for the apps: a `data:image/jpeg;base64,…` URL (longest side 192 px) stored on
 * `students/{id}.photo` (DATA_CONTRACT section 3) so the teacher and parent apps draw it in avatars without Storage access.
 */
export const STUDENT_PHOTO_SIDE = 192;
export const STUDENT_PHOTO_MAX_CHARS = 60_000;

export async function studentPhotoThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, STUDENT_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/jpeg", 0.78);
    if (!photo.startsWith("data:image/jpeg;") || photo.length > STUDENT_PHOTO_MAX_CHARS) throw new Error("The photo thumbnail is too large.");
    return photo;
  } finally {
    bitmap.close();
  }
}
