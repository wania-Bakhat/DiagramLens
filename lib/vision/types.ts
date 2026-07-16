export type VisionPart = {
  id: string;
  name: string;
  description: string;
  function: string;
};

export type VisionRelationship = {
  sourcePartId: string;
  targetPartId: string;
  relation: string;
};

export type VisionAtlasMetadata = {
  diagramTitle: string;
  diagramSubtitle: string;
  assetLabel: string;
  assetFileName: string;
  referenceAssetUrl: string;
  referenceAttribution: string;
  loaderHint: string;
  scaleHint: string;
  statusLabel: string;
  accent: string;
  surface: string;
};

export type VisionExtractionInput = {
  file: File;
  imageUrl: string;
};

export type VisionExtractionResult = {
  organSlug?: string;
  organName: string;
  summary: string;
  confidence: number;
  sourceFileName: string;
  parts: VisionPart[];
  relationships: VisionRelationship[];
  atlasMetadata?: VisionAtlasMetadata;
};

export interface VisionAdapter {
  extract(input: VisionExtractionInput): Promise<VisionExtractionResult>;
}
