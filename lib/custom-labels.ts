import type { VisionExtractionResult } from "./vision";

export type CustomLabel = {
  id: string;
  name: string;
  position: [number, number, number];
};

export type ProjectCustomLabelFile = {
  version: 1;
  models: Record<string, CustomLabel[]>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCustomLabelModelKey(result: VisionExtractionResult) {
  const asset = result.atlasMetadata?.referenceAssetUrl;
  const assetIdentity = Array.isArray(asset) ? asset.join("-") : asset;
  const modelIdentity = assetIdentity || result.sourceFileName || result.organName;

  return `${slugify(result.organSlug ?? result.organName)}:${slugify(modelIdentity)}`;
}

export function normaliseCustomLabels(value: unknown): CustomLabel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): CustomLabel[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<CustomLabel>;
    const position = candidate.position;
    const hasValidPosition =
      Array.isArray(position) &&
      position.length === 3 &&
      position.every(
        (coordinate) =>
          typeof coordinate === "number" && Number.isFinite(coordinate)
      );
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";

    if (
      typeof candidate.id !== "string" ||
      !candidate.id ||
      !name ||
      name.length > 80 ||
      !hasValidPosition
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        name,
        position: [position[0], position[1], position[2]]
      }
    ];
  });
}

export function isCustomLabelModelKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 240 &&
    /^[a-z0-9:-]+$/.test(value)
  );
}
