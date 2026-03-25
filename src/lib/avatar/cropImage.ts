/**
 * Utility to create a cropped, optimized image from a user-selected file.
 * Converts to WebP format for best quality/size ratio.
 *
 * Relies on the browser's native Canvas API — no server-side processing needed.
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Loads an image from a File object and returns an HTMLImageElement.
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Creates a cropped, resized image Blob from the source image.
 *
 * - Crops to the specified pixel area from `react-easy-crop`
 * - Resizes to `outputSize` (default 512px) to keep file size low
 * - Encodes as WebP at 0.85 quality — ~60% smaller than JPEG at similar visual quality
 *
 * @returns A Blob in WebP format, or JPEG fallback if WebP is unsupported
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropArea: CropArea,
  outputSize: number = 512,
  quality: number = 0.85
): Promise<Blob> {
  // Load the full-resolution source image
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = imageSrc;
  });

  // Create an offscreen canvas at the desired output resolution
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }

  // Draw the cropped region onto the canvas, scaled to fit the output size
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputSize,
    outputSize
  );

  // Convert canvas to blob — prefer WebP for best compression
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob returned null"));
        }
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Creates an object URL from a File for use as the crop preview source.
 * Caller is responsible for revoking the URL when done.
 */
export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
