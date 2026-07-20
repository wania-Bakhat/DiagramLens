import type { VisionAdapter, VisionExtractionResult } from "./types";

const MAX_ANALYSIS_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_ANALYSIS_DIMENSION = 1_400;

type AnalyzeResponse = {
  result?: VisionExtractionResult;
  error?: string;
};

async function optimizeImageForVision(file: File) {
  if (file.size <= MAX_ANALYSIS_IMAGE_BYTES) {
    return file;
  }

  if (typeof createImageBitmap !== "function") {
    throw new Error("This image is too large to analyze in this browser. Use an image under 3 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_ANALYSIS_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the image for anatomy analysis.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.78)
  );

  if (!compressed || compressed.size > MAX_ANALYSIS_IMAGE_BYTES) {
    throw new Error("This image is too large to analyze. Try a clearer image under 3 MB.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "anatomy-image";
  return new File([compressed], `${baseName}.jpg`, { type: "image/jpeg" });
}

/**
 * Sends the source image to the server-side vision route. Keeping this call on
 * the server prevents API credentials from ever reaching the browser.
 */
export const apiVisionAdapter: VisionAdapter = {
  async extract({ file }) {
    const optimizedFile = await optimizeImageForVision(file);
    const formData = new FormData();
    formData.set("image", optimizedFile, optimizedFile.name);

    let response: Response;
    try {
      response = await fetch("/api/diagram-analyze", {
        method: "POST",
        body: formData
      });
    } catch {
      throw new Error("Could not reach the anatomy analysis service. Please try again.");
    }

    const payload = (await response.json().catch(() => null)) as AnalyzeResponse | null;

    if (!response.ok || !payload?.result) {
      throw new Error(
        payload?.error || "This image could not be matched to a DiagramLens 3D study."
      );
    }

    return payload.result;
  }
};
