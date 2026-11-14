export async function readProfilePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error("Choose a JPEG, PNG or WebP image under 8 MB.");
  }
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This image could not be opened."); });
  try {
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/jpeg", 0.8);
    if (!photo.startsWith("data:image/jpeg;") || photo.length > 160_000) throw new Error("Choose a smaller photo.");
    return photo;
  } finally {
    bitmap.close();
  }
}
