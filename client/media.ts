export async function readMediaDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("video/")) {
    if (file.size > 45000) {
      throw new Error("Use a smaller video.");
    }
    return readFile(file);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload an image or supported video.");
  }
  const original = await readFile(file);
  const image = await loadImage(original);
  const canvas = document.createElement("canvas");
  let maxSide = 640;
  let quality = 0.68;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    return original;
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let compressed = canvas.toDataURL("image/jpeg", quality);

  while (compressed.length > 60000 && maxSide > 240) {
    maxSide = Math.round(maxSide * 0.78);
    quality = Math.max(0.44, quality - 0.08);
    const nextScale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * nextScale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * nextScale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    compressed = canvas.toDataURL("image/jpeg", quality);
  }

  if (compressed.length > 60000) {
    throw new Error("Use a smaller image.");
  }
  return compressed;
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process the image."));
    image.src = src;
  });
}

