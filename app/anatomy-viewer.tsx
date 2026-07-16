"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  findAtlasOrgan,
  getAtlasMetadata,
  type AtlasOrgan
} from "@/lib/atlas";
import {
  tutorAdapter,
  type TutorRelatedStructure,
  type TutorResponse
} from "@/lib/tutor";
import type {
  VisionExtractionResult,
  VisionPart
} from "@/lib/vision";

type AnatomyViewerProps = {
  result: VisionExtractionResult;
  isLoading?: boolean;
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
};

type RelatedStructure = {
  id: string;
  name: string;
  relation: string;
  direction: "incoming" | "outgoing";
};

type PartInsight = VisionPart & {
  accent: string;
  related: RelatedStructure[];
};

type PartPlacement = {
  basePosition: InstanceType<typeof THREE.Vector3>;
  explodedPosition: InstanceType<typeof THREE.Vector3>;
  labelOffset: InstanceType<typeof THREE.Vector3>;
  scale: InstanceType<typeof THREE.Vector3>;
  shape: string;
  rotation: InstanceType<typeof THREE.Euler>;
};

type PartVisual = {
  part: VisionPart;
  object: InstanceType<typeof THREE.Object3D>;
  materials: InstanceType<typeof THREE.MeshPhysicalMaterial>[];
  placement: PartPlacement;
};

type LabelLayout = {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  side: "left" | "right";
  visible: boolean;
};

type ReferenceModelState = "loading" | "reference" | "fallback";

type ReferenceMesh = {
  mesh: InstanceType<typeof THREE.Mesh>;
  partId: string | null;
  material: any;
  baseOpacity: number;
  baseEmissiveIntensity: number;
};

type ViewerCanvasProps = {
  result: VisionExtractionResult;
  searchTerm: string;
  selectedPartId: string | null;
  hiddenPartIds: Set<string>;
  explode: boolean;
  isLoading?: boolean;
  fullscreen?: boolean;
  resetToken: number;
  onSelectPart: (partId: string | null) => void;
};

const palette = [
  "#fb7185",
  "#f97316",
  "#38bdf8",
  "#34d399",
  "#c084fc",
  "#facc15"
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The HuBMAP GLBs use their anatomical-source names (for example,
// "left cardiac atrium") rather than the concise ids used by DiagramLens.
// Keep that vocabulary bridge explicit so selected study labels highlight the
// correct, real GLB mesh instead of a generic fallback shape.
const referencePartAliases: Record<string, string[]> = {
  left_atrium: ["left-cardiac-atrium"],
  right_atrium: ["right-cardiac-atrium"],
  left_ventricle: ["heart-left-ventricle"],
  right_ventricle: ["heart-right-ventricle"],
  superior_vena_cava: ["superior-vena-cava"],
  inferior_vena_cava: ["inferior-vena-cava"],
  pulmonary_artery: ["pulmonary-artery", "pulmonary-trunk"],
  pulmonary_veins: ["pulmonary-vein"],
  interventricular_septum: ["interventricular-septum"],
  coronary_arteries: ["coronary-artery"],
  cerebrum: ["brain-hemisphere"],
  frontal_lobe: ["frontal-lobe"],
  parietal_lobe: ["parietal-lobe"],
  temporal_lobe: ["temporal-lobe"],
  occipital_lobe: ["occipital-lobe"],
  brainstem: ["pons", "medulla-oblongata", "midbrain"],
  thalamus: ["thalamus"],
  hypothalamus: ["hypothalamus"],
  hippocampus: ["hippocampus"],
  pituitary_gland: ["pituitary-gland"],
  amygdala: ["amygdaloid-complex"],
  medulla: ["medulla-oblongata"],
  left_lung: ["lungs-l"],
  right_lung: ["lungs-r"],
  trachea: ["trachea"],
  bronchi: ["main-bronchus", "bronchus"],
  carina: ["carina"],
  left_upper_lobe: ["lungs-l-upper-lobe"],
  left_lower_lobe: ["lungs-l-lower-lobe"],
  right_upper_lobe: ["lungs-r-upper-lobe"],
  right_middle_lobe: ["lungs-r-middle-lobe"],
  right_lower_lobe: ["lungs-r-lower-lobe"],
  left_kidney: ["left-kidney"],
  right_kidney: ["right-kidney"],
  renal_cortex: ["cortex-of-kidney"],
  renal_medulla: ["renal-medulla"],
  renal_capsule: ["kidney-capsule"],
  renal_hilum: ["hilum-of-kidney"],
  optic_disc: ["optic-disc"]
};

function findPartForReferenceObject(
  object: InstanceType<typeof THREE.Object3D>,
  parts: VisionPart[]
) {
  const nodeNames: string[] = [];
  let current: InstanceType<typeof THREE.Object3D> | null = object;

  while (current) {
    if (current.name) {
      nodeNames.push(slugify(current.name));
    }
    current = current.parent;
  }

  return (
    parts.find((part) => {
      const identifiers = [
        slugify(part.id),
        slugify(part.name),
        ...(referencePartAliases[part.id] ?? [])
      ];
      return nodeNames.some((nodeName) =>
        identifiers.some(
          (identifier) =>
            nodeName === identifier ||
            nodeName.includes(identifier) ||
            (nodeName.length > 6 && identifier.includes(nodeName))
        )
      );
    }) ?? null
  );
}

function centerReferenceModel(model: InstanceType<typeof THREE.Object3D>) {
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.01);
  const scale = 3.2 / maxDimension;

  model.scale.setScalar(scale);
  model.position.copy(center.multiplyScalar(-scale));
  model.updateMatrixWorld(true);
}

function matchesSearch(part: VisionPart, searchTerm: string) {
  if (!searchTerm) {
    return true;
  }

  const normalized = searchTerm.toLowerCase();
  return [
    part.name,
    part.description,
    part.function,
    part.id
  ].some((field) => field.toLowerCase().includes(normalized));
}

function labelLayoutsChanged(
  previous: Record<string, LabelLayout>,
  next: Record<string, LabelLayout>
) {
  const previousIds = Object.keys(previous);
  const nextIds = Object.keys(next);

  if (previousIds.length !== nextIds.length) {
    return true;
  }

  return nextIds.some((id) => {
    const before = previous[id];
    const after = next[id];

    return (
      !before ||
      before.visible !== after.visible ||
      before.side !== after.side ||
      Math.abs(before.x - after.x) > 1.5 ||
      Math.abs(before.y - after.y) > 1.5 ||
      Math.abs(before.anchorX - after.anchorX) > 1.5 ||
      Math.abs(before.anchorY - after.anchorY) > 1.5
    );
  });
}

function makePlacement(
  basePosition: InstanceType<typeof THREE.Vector3>,
  explodedPosition: InstanceType<typeof THREE.Vector3>,
  labelOffset: InstanceType<typeof THREE.Vector3>,
  scale: InstanceType<typeof THREE.Vector3>,
  shape: string,
  rotation: InstanceType<typeof THREE.Euler>
): PartPlacement {
  return {
    basePosition,
    explodedPosition,
    labelOffset,
    scale,
    shape,
    rotation
  };
}

function buildPartInsights(result: VisionExtractionResult): PartInsight[] {
  const partsById = new Map(result.parts.map((part) => [part.id, part]));

  return result.parts.map((part, index) => {
    const seen = new Set<string>();
    const related: RelatedStructure[] = [];

    for (const relationship of result.relationships) {
      if (relationship.sourcePartId === part.id) {
        const target = partsById.get(relationship.targetPartId);

        if (target) {
          const key = `${target.id}:outgoing:${relationship.relation}`;
          if (!seen.has(key)) {
            seen.add(key);
            related.push({
              id: target.id,
              name: target.name,
              relation: relationship.relation,
              direction: "outgoing"
            });
          }
        }
      }

      if (relationship.targetPartId === part.id) {
        const source = partsById.get(relationship.sourcePartId);

        if (source) {
          const key = `${source.id}:incoming:${relationship.relation}`;
          if (!seen.has(key)) {
            seen.add(key);
            related.push({
              id: source.id,
              name: source.name,
              relation: relationship.relation,
              direction: "incoming"
            });
          }
        }
      }
    }

    return {
      ...part,
      accent: palette[index % palette.length],
      related
    };
  });
}

function buildQuizQuestions(part: PartInsight) {
  const primaryRelation = part.related[0];

  return [
    `What is the main job of ${part.name} in this diagram?`,
    primaryRelation
      ? `How does ${part.name} work with ${primaryRelation.name}?`
      : `Which nearby structure would you compare with ${part.name}?`,
    `Can you point to ${part.name} and explain it in one sentence?`
  ];
}

function buildFallbackTutorResponse(
  organ: AtlasOrgan,
  part: PartInsight
): TutorResponse {
  const relatedStructures: TutorRelatedStructure[] = part.related.map((relation) => ({
    id: relation.id,
    name: relation.name,
    relation: relation.relation,
    direction: relation.direction,
    detail:
      relation.direction === "outgoing"
        ? `${part.name} ${relation.relation} ${relation.name.toLowerCase()}.`
        : `${relation.name} ${relation.relation} ${part.name.toLowerCase()}.`
  }));

  return {
    provider: "mock",
    explanation:
      `${part.name} is a landmark in the ${organ.organName.toLowerCase()} diagram. ` +
      `${part.description} Start here to orient the rest of the labels.`,
    function: part.function,
    relatedStructures,
    quizQuestions: buildQuizQuestions(part),
    studyTip: `${organ.diagramTitle}: trace ${part.name} first, then follow the connected structures one by one.`
  };
}

function buildPresetPlacements(
  parts: VisionPart[],
  presets: Record<string, PartPlacement>
) {
  const genericPlacements = buildGenericPlacements(parts);

  return parts.map((part, index) => presets[part.id] ?? genericPlacements[index]);
}

function buildHeartPlacements(parts: VisionPart[]) {
  const preset: Record<string, PartPlacement> = {
    left_atrium: makePlacement(
      new THREE.Vector3(-0.66, 0.48, 0.08),
      new THREE.Vector3(-1.2, 0.82, 0.16),
      new THREE.Vector3(-0.16, 0.35, 0.14),
      new THREE.Vector3(0.5, 0.42, 0.48),
      "chamber",
      new THREE.Euler(0, 0, 0)
    ),
    left_ventricle: makePlacement(
      new THREE.Vector3(-0.54, -0.38, 0.12),
      new THREE.Vector3(-1.1, -0.82, 0.2),
      new THREE.Vector3(-0.34, -0.28, 0.18),
      new THREE.Vector3(0.78, 0.92, 0.76),
      "chamber",
      new THREE.Euler(0.14, -0.22, 0.1)
    ),
    aortic_valve: makePlacement(
      new THREE.Vector3(0.06, 0.12, 0.28),
      new THREE.Vector3(0.12, 0.22, 0.56),
      new THREE.Vector3(0.2, 0.34, 0.3),
      new THREE.Vector3(0.3, 0.34, 0.3),
      "valve",
      new THREE.Euler(0.24, 0.16, 0.04)
    ),
    aorta: makePlacement(
      new THREE.Vector3(0.62, 0.5, 0.08),
      new THREE.Vector3(1.18, 0.98, 0.18),
      new THREE.Vector3(0.34, 0.34, 0.16),
      new THREE.Vector3(0.48, 0.24, 0.4),
      "vessel",
      new THREE.Euler(-0.08, 0.18, -0.14)
    ),
    myocardium: makePlacement(
      new THREE.Vector3(0, 0, -0.08),
      new THREE.Vector3(0, 0, -0.16),
      new THREE.Vector3(0, -0.88, 0.16),
      new THREE.Vector3(1.35, 1.2, 1.15),
      "heart-shell",
      new THREE.Euler(0.08, 0.12, -0.06)
    )
  };

  return buildPresetPlacements(parts, preset);
}

function buildLungsPlacements(parts: VisionPart[]) {
  const preset: Record<string, PartPlacement> = {
    trachea: makePlacement(
      new THREE.Vector3(0, 0.88, 0.12),
      new THREE.Vector3(0, 1.4, 0.2),
      new THREE.Vector3(0.14, 0.48, 0.16),
      new THREE.Vector3(0.34, 0.74, 0.34),
      "vessel",
      new THREE.Euler(-0.12, 0.02, 0.03)
    ),
    bronchi: makePlacement(
      new THREE.Vector3(0, 0.42, 0.15),
      new THREE.Vector3(0, 0.74, 0.34),
      new THREE.Vector3(0.18, 0.22, 0.18),
      new THREE.Vector3(0.44, 0.38, 0.44),
      "bronchial-branch",
      new THREE.Euler(0.2, 0.08, 0.08)
    ),
    left_lung: makePlacement(
      new THREE.Vector3(-0.74, 0.02, 0.02),
      new THREE.Vector3(-1.3, 0.08, 0.16),
      new THREE.Vector3(-0.4, 0.12, 0.12),
      new THREE.Vector3(0.92, 1.2, 0.84),
      "lung-left",
      new THREE.Euler(0.04, -0.28, 0.02)
    ),
    right_lung: makePlacement(
      new THREE.Vector3(0.74, 0.02, 0.02),
      new THREE.Vector3(1.3, 0.08, 0.16),
      new THREE.Vector3(0.4, 0.12, 0.12),
      new THREE.Vector3(1.02, 1.28, 0.9),
      "lung-right",
      new THREE.Euler(0.04, 0.28, -0.02)
    ),
    alveoli: makePlacement(
      new THREE.Vector3(0.08, -0.3, 0.42),
      new THREE.Vector3(0.12, -0.56, 0.92),
      new THREE.Vector3(0.24, -0.1, 0.3),
      new THREE.Vector3(0.26, 0.26, 0.26),
      "alveoli",
      new THREE.Euler(0.16, 0.1, -0.1)
    ),
    diaphragm: makePlacement(
      new THREE.Vector3(0, -0.86, 0),
      new THREE.Vector3(0, -1.42, 0),
      new THREE.Vector3(0.02, -0.38, 0),
      new THREE.Vector3(1.16, 0.18, 1.1),
      "diaphragm",
      new THREE.Euler(0.42, 0, 1.48)
    )
  };

  return buildPresetPlacements(parts, preset);
}

function buildBrainPlacements(parts: VisionPart[]) {
  const preset: Record<string, PartPlacement> = {
    cerebrum: makePlacement(
      new THREE.Vector3(0, 0.6, 0.1),
      new THREE.Vector3(0, 1.04, 0.18),
      new THREE.Vector3(0, 0.42, 0.18),
      new THREE.Vector3(1.12, 0.92, 0.98),
      "brain-surface",
      new THREE.Euler(0.12, 0.1, 0.04)
    ),
    corpus_callosum: makePlacement(
      new THREE.Vector3(0.02, 0.16, 0.1),
      new THREE.Vector3(0.08, 0.28, 0.22),
      new THREE.Vector3(0.2, 0.18, 0.14),
      new THREE.Vector3(0.56, 0.2, 0.5),
      "nerve-bridge",
      new THREE.Euler(0.06, 0.18, 0.16)
    ),
    cerebellum: makePlacement(
      new THREE.Vector3(-0.36, -0.22, -0.04),
      new THREE.Vector3(-0.78, -0.42, -0.1),
      new THREE.Vector3(-0.36, -0.12, -0.24),
      new THREE.Vector3(0.46, 0.34, 0.42),
      "brain-surface",
      new THREE.Euler(-0.04, -0.1, 0.08)
    ),
    brainstem: makePlacement(
      new THREE.Vector3(0.1, -0.48, 0.18),
      new THREE.Vector3(0.16, -0.95, 0.24),
      new THREE.Vector3(0.32, -0.38, 0.22),
      new THREE.Vector3(0.36, 0.7, 0.34),
      "brainstem",
      new THREE.Euler(0.34, 0.06, 0.1)
    ),
    spinal_cord: makePlacement(
      new THREE.Vector3(0.12, -1.02, 0.2),
      new THREE.Vector3(0.12, -1.72, 0.24),
      new THREE.Vector3(0.28, -0.9, 0.2),
      new THREE.Vector3(0.24, 0.88, 0.22),
      "nerve-bridge",
      new THREE.Euler(0.52, 0.04, 0.08)
    )
  };

  return buildPresetPlacements(parts, preset);
}

function buildKidneysPlacements(parts: VisionPart[]) {
  const preset: Record<string, PartPlacement> = {
    renal_artery: makePlacement(
      new THREE.Vector3(0, 0.72, 0.04),
      new THREE.Vector3(0, 1.2, 0.1),
      new THREE.Vector3(0.18, 0.4, 0.12),
      new THREE.Vector3(0.34, 0.34, 0.34),
      "vessel",
      new THREE.Euler(0.18, 0.02, 1.24)
    ),
    renal_cortex: makePlacement(
      new THREE.Vector3(-0.56, 0.16, 0.04),
      new THREE.Vector3(-1.04, 0.34, 0.08),
      new THREE.Vector3(-0.36, 0.1, 0.1),
      new THREE.Vector3(0.82, 1.02, 0.7),
      "kidney-shell",
      new THREE.Euler(0.08, -0.14, 0.08)
    ),
    renal_medulla: makePlacement(
      new THREE.Vector3(0.42, -0.06, 0),
      new THREE.Vector3(0.74, -0.12, 0.04),
      new THREE.Vector3(0.54, -0.02, 0.18),
      new THREE.Vector3(0.48, 0.72, 0.42),
      "renal-pyramid",
      new THREE.Euler(0.16, 0.24, 0.04)
    ),
    renal_pelvis: makePlacement(
      new THREE.Vector3(0.18, -0.42, 0.16),
      new THREE.Vector3(0.36, -0.8, 0.26),
      new THREE.Vector3(0.42, -0.24, 0.3),
      new THREE.Vector3(0.38, 0.42, 0.34),
      "renal-pelvis",
      new THREE.Euler(0.14, 0.08, -0.04)
    ),
    ureter: makePlacement(
      new THREE.Vector3(0.2, -0.92, 0.06),
      new THREE.Vector3(0.28, -1.56, 0.12),
      new THREE.Vector3(0.42, -0.78, 0.12),
      new THREE.Vector3(0.24, 0.72, 0.22),
      "vessel",
      new THREE.Euler(0.5, 0, 0.08)
    )
  };

  return buildPresetPlacements(parts, preset);
}

function buildLiverPlacements(parts: VisionPart[]) {
  const preset: Record<string, PartPlacement> = {
    portal_vein: makePlacement(
      new THREE.Vector3(-0.12, 0.72, 0.12),
      new THREE.Vector3(-0.2, 1.18, 0.18),
      new THREE.Vector3(-0.1, 0.46, 0.3),
      new THREE.Vector3(0.34, 0.32, 0.34),
      "vessel",
      new THREE.Euler(0.2, 0.1, 1.38)
    ),
    right_lobe: makePlacement(
      new THREE.Vector3(0.78, 0.08, 0.06),
      new THREE.Vector3(1.42, 0.14, 0.12),
      new THREE.Vector3(0.48, 0.08, 0.2),
      new THREE.Vector3(1.02, 0.72, 0.84),
      "liver-lobe",
      new THREE.Euler(-0.04, 0.22, 0.08)
    ),
    left_lobe: makePlacement(
      new THREE.Vector3(-0.56, 0.02, 0.04),
      new THREE.Vector3(-1.04, 0.04, 0.1),
      new THREE.Vector3(-0.42, 0.04, 0.18),
      new THREE.Vector3(0.72, 0.52, 0.58),
      "liver-lobe",
      new THREE.Euler(0.02, -0.18, -0.04)
    ),
    gallbladder: makePlacement(
      new THREE.Vector3(0.18, -0.46, 0.18),
      new THREE.Vector3(0.38, -0.84, 0.3),
      new THREE.Vector3(0.44, -0.3, 0.26),
      new THREE.Vector3(0.24, 0.34, 0.24),
      "gallbladder",
      new THREE.Euler(0.08, 0.06, 0.04)
    ),
    hepatic_duct: makePlacement(
      new THREE.Vector3(0.08, -0.76, 0.06),
      new THREE.Vector3(0.14, -1.24, 0.08),
      new THREE.Vector3(0.3, -0.58, 0.1),
      new THREE.Vector3(0.24, 0.68, 0.2),
      "vessel",
      new THREE.Euler(0.34, 0.02, 0.1)
    )
  };

  return buildPresetPlacements(parts, preset);
}

function buildEyePlacements(parts: VisionPart[]) {
  const preset: Record<string, PartPlacement> = {
    cornea: makePlacement(
      new THREE.Vector3(0.82, 0.12, 0.2),
      new THREE.Vector3(1.42, 0.18, 0.34),
      new THREE.Vector3(0.62, 0.32, 0.28),
      new THREE.Vector3(0.36, 0.36, 0.24),
      "cornea",
      new THREE.Euler(0.08, 0.1, 0.1)
    ),
    iris: makePlacement(
      new THREE.Vector3(0.35, 0.02, 0.12),
      new THREE.Vector3(0.68, 0.04, 0.22),
      new THREE.Vector3(0.26, 0.18, 0.22),
      new THREE.Vector3(0.42, 0.18, 0.42),
      "iris",
      new THREE.Euler(0, Math.PI / 2, 0.18)
    ),
    lens: makePlacement(
      new THREE.Vector3(0.02, 0, 0),
      new THREE.Vector3(0.02, 0, 0.12),
      new THREE.Vector3(0.12, 0.18, 0.12),
      new THREE.Vector3(0.36, 0.46, 0.32),
      "eye-lens",
      new THREE.Euler(0.04, 0.08, 0.04)
    ),
    retina: makePlacement(
      new THREE.Vector3(-0.42, 0.02, -0.08),
      new THREE.Vector3(-0.84, 0.06, -0.16),
      new THREE.Vector3(-0.36, -0.12, -0.16),
      new THREE.Vector3(0.52, 0.52, 0.5),
      "retina",
      new THREE.Euler(-0.02, -0.06, 0.04)
    ),
    optic_nerve: makePlacement(
      new THREE.Vector3(-0.84, 0.06, -0.2),
      new THREE.Vector3(-1.46, 0.12, -0.34),
      new THREE.Vector3(-0.62, 0.16, -0.26),
      new THREE.Vector3(0.24, 0.74, 0.24),
      "optic-nerve",
      new THREE.Euler(0.32, 0, 1.24)
    )
  };

  return buildPresetPlacements(parts, preset);
}

function buildGenericPlacements(parts: VisionPart[]) {
  return parts.map((part, index) => {
    const angle = index * 2.35;
    const radius = 0.58 + index * 0.17;
    const height = Math.sin(index * 0.88) * 0.3;
    const basePosition = new THREE.Vector3(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius * 0.6
    );
    const explodedPosition = basePosition.clone().multiplyScalar(1.42);
    const labelOffset = basePosition
      .clone()
      .normalize()
      .multiplyScalar(0.32)
      .add(new THREE.Vector3(0, 0.12, 0));

    return {
      basePosition,
      explodedPosition,
      labelOffset,
      scale: new THREE.Vector3(
        0.4 + (index % 3) * 0.07,
        0.36 + (index % 2) * 0.08,
        0.4 + (index % 4) * 0.04
      ),
      shape: index % 3 === 0 ? "sphere" : index % 3 === 1 ? "capsule" : "cylinder",
      rotation: new THREE.Euler(0.12 * index, 0.18 * index, 0.08 * index)
    };
  });
}

function resolvePlacements(result: VisionExtractionResult) {
  const organKey = slugify(result.organSlug ?? result.organName);
  let preset = buildGenericPlacements(result.parts);

  if (organKey === "heart") {
    preset = buildHeartPlacements(result.parts);
  } else if (organKey === "lungs") {
    preset = buildLungsPlacements(result.parts);
  } else if (organKey === "brain") {
    preset = buildBrainPlacements(result.parts);
  } else if (organKey === "kidneys") {
    preset = buildKidneysPlacements(result.parts);
  } else if (organKey === "liver") {
    preset = buildLiverPlacements(result.parts);
  } else if (organKey === "eye") {
    preset = buildEyePlacements(result.parts);
  }

  return result.parts.map((part, index) => ({
    part,
    placement: preset[index]
  }));
}

function centeredExtrusion(shape: InstanceType<typeof THREE.Shape>, depth: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    curveSegments: 24
  });
  geometry.center();
  return geometry;
}

function createHeartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.48);
  shape.bezierCurveTo(-0.5, -0.08, -0.62, 0.38, -0.3, 0.54);
  shape.bezierCurveTo(-0.12, 0.64, 0, 0.5, 0, 0.38);
  shape.bezierCurveTo(0.08, 0.56, 0.31, 0.65, 0.5, 0.45);
  shape.bezierCurveTo(0.76, 0.14, 0.48, -0.26, 0, -0.48);
  return centeredExtrusion(shape, 0.38);
}

function createLungGeometry(side: "left" | "right") {
  const direction = side === "left" ? -1 : 1;
  const shape = new THREE.Shape();
  shape.moveTo(direction * 0.04, 0.58);
  shape.bezierCurveTo(direction * 0.37, 0.48, direction * 0.49, 0.1, direction * 0.42, -0.32);
  shape.bezierCurveTo(direction * 0.34, -0.65, direction * 0.1, -0.72, direction * 0.02, -0.52);
  shape.bezierCurveTo(direction * -0.12, -0.17, direction * -0.12, 0.2, direction * 0.04, 0.58);
  return centeredExtrusion(shape, 0.34);
}

function createBrainGeometry() {
  const geometry = new THREE.SphereGeometry(0.46, 42, 30);
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const wave = 1 + 0.055 * Math.sin(x * 24) * Math.cos(y * 19) + 0.035 * Math.sin(z * 18);
    position.setXYZ(index, x * wave, y * wave * 0.96, z * wave);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createKidneyGeometry() {
  const geometry = new THREE.SphereGeometry(0.46, 38, 28);
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const notch = Math.max(0, x) * (1 - Math.min(1, Math.abs(y) * 1.9));
    position.setXYZ(index, x - notch * 0.34, y * (1 + 0.08 * Math.max(0, -y)), z * 0.9);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createLiverGeometry() {
  const geometry = new THREE.SphereGeometry(0.48, 38, 28);
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const lobeBias = x < 0 ? 0.82 : 1.12;
    position.setXYZ(index, x * lobeBias, y * 0.78 + 0.04 * Math.cos(x * 6), z * 1.04);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createPartGeometry(shape: string) {
  if (shape === "heart-shell") {
    return createHeartGeometry();
  }

  if (shape === "lung-left") {
    return createLungGeometry("left");
  }

  if (shape === "lung-right") {
    return createLungGeometry("right");
  }

  if (shape === "brain-surface") {
    return createBrainGeometry();
  }

  if (shape === "kidney-shell") {
    return createKidneyGeometry();
  }

  if (shape === "liver-lobe") {
    return createLiverGeometry();
  }

  if (shape === "valve" || shape === "iris") {
    return new THREE.TorusGeometry(0.27, 0.09, 14, 32);
  }

  if (shape === "retina") {
    return new THREE.SphereGeometry(0.44, 32, 24, Math.PI * 0.56, Math.PI * 0.88);
  }

  if (shape === "diaphragm") {
    return new THREE.SphereGeometry(0.48, 32, 18);
  }

  if (shape === "renal-pyramid") {
    return new THREE.ConeGeometry(0.32, 0.92, 6, 1);
  }

  if (shape === "bronchial-branch") {
    return new THREE.CylinderGeometry(0.25, 0.19, 0.9, 18, 1);
  }

  if (
    shape === "capsule" ||
    shape === "vessel" ||
    shape === "nerve-bridge" ||
    shape === "optic-nerve" ||
    shape === "brainstem"
  ) {
    return new THREE.CapsuleGeometry(0.27, 0.7, 10, 20);
  }

  if (shape === "alveoli") {
    return new THREE.IcosahedronGeometry(0.38, 2);
  }

  return new THREE.SphereGeometry(0.42, 32, 24);
}

function createMaterial(color: string, highlighted: boolean, isMuted: boolean) {
  const baseColor = new THREE.Color(color);

  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: 0.38,
    metalness: 0.08,
    clearcoat: 0.18,
    clearcoatRoughness: 0.24,
    transparent: true,
    opacity: isMuted ? 0.28 : 0.96,
    emissive: highlighted ? new THREE.Color("#ffffff") : baseColor.clone().multiplyScalar(0.18),
    emissiveIntensity: highlighted ? 0.6 : 0.18
  });
}

function createPartObject(shape: string, color: string) {
  const root = new THREE.Group();
  const materials: InstanceType<typeof THREE.MeshPhysicalMaterial>[] = [];

  const addMesh = (
    geometry: InstanceType<typeof THREE.BufferGeometry>,
    position = new THREE.Vector3(),
    rotation = new THREE.Euler(),
    scale = new THREE.Vector3(1, 1, 1),
    opacity = 0.96
  ) => {
    const material = createMaterial(color, false, false);
    material.opacity = opacity;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.scale.copy(scale);
    root.add(mesh);
    materials.push(material);
  };

  if (shape === "bronchial-branch") {
    addMesh(
      new THREE.CapsuleGeometry(0.18, 0.65, 8, 16),
      new THREE.Vector3(-0.18, -0.08, 0),
      new THREE.Euler(0, 0, Math.PI / 3.9)
    );
    addMesh(
      new THREE.CapsuleGeometry(0.18, 0.65, 8, 16),
      new THREE.Vector3(0.18, -0.08, 0),
      new THREE.Euler(0, 0, -Math.PI / 3.9)
    );
    addMesh(new THREE.SphereGeometry(0.22, 20, 14));
  } else if (shape === "alveoli") {
    const offsets = [
      [-0.2, 0.12, 0],
      [0.14, 0.15, 0.06],
      [0.02, -0.1, 0.1],
      [-0.16, -0.18, -0.06],
      [0.22, -0.16, -0.08]
    ];
    for (const [x, y, z] of offsets) {
      addMesh(
        new THREE.IcosahedronGeometry(0.18, 2),
        new THREE.Vector3(x, y, z),
        new THREE.Euler(),
        new THREE.Vector3(1, 1, 1),
        0.9
      );
    }
  } else if (shape === "eye-lens") {
    addMesh(new THREE.SphereGeometry(0.4, 28, 20), new THREE.Vector3(), new THREE.Euler(), new THREE.Vector3(0.72, 1, 0.72), 0.74);
  } else if (shape === "cornea") {
    addMesh(new THREE.SphereGeometry(0.4, 28, 20), new THREE.Vector3(), new THREE.Euler(), new THREE.Vector3(0.74, 1, 0.74), 0.64);
  } else if (shape === "gallbladder") {
    addMesh(new THREE.SphereGeometry(0.4, 28, 20), new THREE.Vector3(), new THREE.Euler(), new THREE.Vector3(0.72, 1.18, 0.72));
  } else {
    addMesh(createPartGeometry(shape));
  }

  return { root, materials };
}

function buildPartVisuals(result: VisionExtractionResult) {
  return resolvePlacements(result).map(({ part, placement }, index) => {
    const visual = createPartObject(placement.shape, palette[index % palette.length]);
    visual.root.position.copy(placement.basePosition);
    visual.root.rotation.copy(placement.rotation);
    visual.root.scale.copy(placement.scale);
    visual.root.traverse((child: InstanceType<typeof THREE.Object3D>) => {
      child.userData.partId = part.id;
    });

    return {
      part,
      object: visual.root,
      materials: visual.materials,
      placement
    };
  });
}

function buildRelationshipLines(
  result: VisionExtractionResult,
  visuals: PartVisual[]
) {
  const visualById = new Map(visuals.map((visual) => [visual.part.id, visual]));

  return result.relationships.flatMap((relationship) => {
    const source = visualById.get(relationship.sourcePartId);
    const target = visualById.get(relationship.targetPartId);

    if (!source || !target) {
      return [];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14
    });

    const line = new THREE.Line(geometry, material);
    line.userData.sourceId = relationship.sourcePartId;
    line.userData.targetId = relationship.targetPartId;
    line.userData.relation = relationship.relation;

    return [
      {
        line,
        source,
        target,
        material
      }
    ];
  });
}

function createBackdrop() {
  const group = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 40, 28),
    new THREE.MeshBasicMaterial({
      color: "#1a2336",
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      side: THREE.BackSide
    })
  );
  group.add(shell);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 28, 20),
    new THREE.MeshBasicMaterial({
      color: "#fb7185",
      transparent: true,
      opacity: 0.045,
      depthWrite: false
    })
  );
  glow.position.set(0, 0.05, -0.12);
  group.add(glow);

  return group;
}

function disposeObject3D(object: any) {
  object.traverse((child: any) => {
    const mesh = child as any;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function formatAccuracy(confidence: number) {
  return `${Math.round(confidence * 100)}% confidence`;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm4.8-1.8L20 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      {hidden ? (
        <>
          <path
            d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 4.5 19.5 19.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        </>
      )}
    </svg>
  );
}

function AnatomyViewer({
  result,
  isLoading = false,
  fullscreen = false,
  onExitFullscreen
}: AnatomyViewerProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [hiddenPartIds, setHiddenPartIds] = useState<Set<string>>(
    () => new Set()
  );
  const [explode, setExplode] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [viewReset, setViewReset] = useState(0);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  useEffect(() => {
    setSearchTerm("");
    setSelectedPartId(null);
    setHiddenPartIds(new Set());
    setExplode(false);
    setIsInfoOpen(false);
    setIsTutorOpen(false);
  }, [result.organName, result.sourceFileName, result.parts.length]);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const partInsights = buildPartInsights(result);
  const activeOrgan = findAtlasOrgan(result.organSlug ?? result.organName);
  const atlasMetadata = result.atlasMetadata ?? getAtlasMetadata(activeOrgan);
  const selectedPart =
    partInsights.find((part) => part.id === selectedPartId) ?? null;

  useEffect(() => {
    if (!selectedPart) {
      setTutorResponse(null);
      setTutorLoading(false);
      setTutorError(null);
      return;
    }

    let active = true;
    setTutorLoading(true);
    setTutorError(null);
    setTutorResponse(null);

    void tutorAdapter
      .explainPart({
        organ: activeOrgan,
        result,
        part: selectedPart
      })
      .then((response) => {
        if (!active) {
          return;
        }

        setTutorResponse(response);
        setTutorLoading(false);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setTutorError(
          error instanceof Error
            ? error.message
            : "Unable to load grounded study notes."
        );
        setTutorLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    activeOrgan,
    result.organName,
    result.organSlug,
    result.sourceFileName,
    result.parts.length,
    result.relationships.length,
    selectedPart?.id
  ]);

  const filteredParts = partInsights.filter((part) => matchesSearch(part, searchTerm));
  const visiblePartCount = partInsights.filter((part) => !hiddenPartIds.has(part.id)).length;
  const tutorContent = selectedPart
    ? tutorResponse ?? buildFallbackTutorResponse(activeOrgan, selectedPart)
    : null;

  function toggleVisibility(partId: string) {
    setHiddenPartIds((previous) => {
      const next = new Set(previous);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return next;
    });
  }

  function showAllParts() {
    setHiddenPartIds(new Set());
  }

  function hideAllParts() {
    setHiddenPartIds(new Set(partInsights.map((part) => part.id)));
  }

  function handleSelectPart(partId: string | null) {
    setSelectedPartId(partId);
    setIsInfoOpen(partId !== null);
  }

  function resetView() {
    setViewReset((current) => current + 1);
    handleSelectPart(null);
  }

  const viewerShellClassName = fullscreen
    ? "fixed inset-0 z-50 overflow-hidden bg-[#02050b]/96 backdrop-blur-2xl"
    : "h-full min-h-0";
  const viewerCardClassName = fullscreen
    ? "flex min-h-[100dvh] w-full flex-col gap-4 p-3 md:p-5"
    : "flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 shadow-soft backdrop-blur-xl";
  const viewerSurfaceClassName = fullscreen
    ? "flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur-xl"
    : "flex min-h-0 flex-1 flex-col";

  const immersiveTree = (
    <section className="fixed inset-0 z-50 h-[100dvh] overflow-y-auto bg-[#030611] text-white lg:overflow-hidden">
      <div className="grid min-h-full lg:h-full lg:min-h-0 lg:grid-cols-[minmax(280px,24vw)_minmax(0,1fr)]">
        <aside className="relative flex max-h-[42dvh] min-h-0 flex-col border-b border-white/10 bg-[#070b17]/92 backdrop-blur-xl lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-white/45">Study notes</p>
              <p className="mt-1 text-sm font-semibold text-white">{result.organName}</p>
            </div>
            <button
              type="button"
              onClick={onExitFullscreen}
              className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07]"
            >
              Back to home
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {selectedPart && tutorContent ? (
              <div className="space-y-4">
                <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-4">
                  <p className="text-xs font-medium text-cyan-100/65">Selected structure</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
                    {selectedPart.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/65">{selectedPart.description}</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-medium text-white/45">Explanation</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{tutorContent.explanation}</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-medium text-white/45">Function</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{tutorContent.function}</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-white/45">Related structures</p>
                    <span className="text-xs text-white/35">{tutorContent.relatedStructures.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tutorContent.relatedStructures.length ? (
                      tutorContent.relatedStructures.map((relation) => (
                        <button
                          key={`${relation.id}-${relation.relation}`}
                          type="button"
                          onClick={() => handleSelectPart(relation.id)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]"
                        >
                          <span className="block text-sm font-medium text-white">{relation.name}</span>
                          <span className="mt-1 block text-xs leading-5 text-white/45">{relation.relation}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-white/45">No related structures are mapped yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-medium text-white/45">Quick question</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{tutorContent.quizQuestions[0]}</p>
                </section>
              </div>
            ) : (
              <div className="flex min-h-full flex-col justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-lg text-cyan-100">
                  +
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Select a structure</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Click a label or a highlighted region to open its anatomy notes here.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() => setIsTutorOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
            >
              Ask AI Tutor
            </button>
          </div>

          {isTutorOpen ? (
            <div className="absolute inset-0 z-20 flex flex-col bg-[#09111f] p-4 shadow-[20px_0_60px_rgba(0,0,0,0.34)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-medium text-cyan-100/65">AI Tutor</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {selectedPart ? selectedPart.name : result.organName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTutorOpen(false)}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07]"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-5">
                <p className="text-sm leading-7 text-white/65">
                  Ask about the selected anatomy. The tutor is already using the current organ and structure as context.
                </p>
                <div className="mt-5 space-y-2">
                  {(tutorContent?.quizQuestions ?? [
                    `What should I notice first in the ${result.organName.toLowerCase()}?`,
                    `How do the major structures of the ${result.organName.toLowerCase()} work together?`
                  ]).map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm leading-6 text-white/80 transition hover:bg-white/[0.08]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <main className="flex h-[58dvh] min-h-0 min-w-0 flex-col bg-[radial-gradient(circle_at_75%_10%,rgba(56,189,248,0.12),transparent_24%),#040714] p-3 md:p-4 lg:h-auto">
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 p-2 backdrop-blur-xl">
            <h1 className="px-2 text-base font-semibold tracking-[-0.02em] text-white md:text-lg">{result.organName}</h1>
            <label className="relative min-w-[180px] flex-1">
              <span className="sr-only">Search structures</span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/40"><SearchIcon /></span>
              <input
                value={searchTerm}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setSearchTerm(nextSearch);
                  const match = partInsights.find((part) => matchesSearch(part, nextSearch));
                  if (nextSearch.trim() && match) {
                    handleSelectPart(match.id);
                  }
                }}
                placeholder="Search parts"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/45"
              />
            </label>
            <button
              type="button"
              onClick={() => setExplode((current) => !current)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                explode ? "border-cyan-300/35 bg-cyan-500/15 text-cyan-50" : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
              }`}
            >
              Explode
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08]"
            >
              Reset view
            </button>
            <button
              type="button"
              onClick={onExitFullscreen}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08]"
            >
              Exit
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <ViewerCanvas
              result={result}
              searchTerm={searchTerm}
              selectedPartId={selectedPartId}
              hiddenPartIds={hiddenPartIds}
              explode={explode}
              isLoading={isLoading}
              fullscreen
              resetToken={viewReset}
              onSelectPart={handleSelectPart}
            />
          </div>
        </main>
      </div>
    </section>
  );

  const viewerTree = (
    <section className={viewerShellClassName || undefined}>
      <div className={viewerCardClassName}>
        {fullscreen ? (
          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.32em] text-white/45">
                  Full-screen study mode
                </p>
                <p className="mt-1 text-sm text-white/75">
                  {result.organName} is open in an immersive anatomy study view.
                </p>
              </div>
              <button
                type="button"
                onClick={onExitFullscreen}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
              >
                Exit full screen
              </button>
            </div>
          </div>
        ) : null}

        <div className={viewerSurfaceClassName}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-white/[0.45]">
                3D anatomy viewer
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                {result.organName}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/[0.64]">
                {result.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/60">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  {atlasMetadata.diagramTitle}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  {atlasMetadata.assetLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  {atlasMetadata.statusLabel}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.58]">
                {atlasMetadata.loaderHint}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-white/65">
                {result.sourceFileName}
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-emerald-100">
                {formatAccuracy(result.confidence)}
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-cyan-100">
                {result.parts.length} parts
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-white/65">
                {result.relationships.length} links
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.28em] text-white/[0.42]">
              {fullscreen ? "Fullscreen mode active" : "Inline preview"}
            </p>
            <p className="text-xs uppercase tracking-[0.28em] text-white/[0.34]">
              {fullscreen ? "Press Escape to close" : "Use the upload panel to open study mode"}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative flex-1">
              <span className="sr-only">Search parts</span>
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
                <SearchIcon />
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search parts, functions, or relationships"
                className="w-full rounded-full border border-white/10 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40 focus:bg-slate-950/80"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExplode((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  explode
                    ? "border-cyan-300/40 bg-cyan-500/15 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
                }`}
              >
                Explode view
              </button>
              <button
                type="button"
                onClick={() => handleSelectPart(null)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80 transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
              >
                Reset selection
              </button>
            </div>
          </div>

          <div className={`mt-5 grid min-h-0 flex-1 gap-5 overflow-y-auto xl:overflow-hidden ${
            isInfoOpen && selectedPart
              ? fullscreen
                ? "xl:grid-cols-[minmax(0,1.18fr)_380px]"
                : "xl:grid-cols-[minmax(0,1.18fr)_340px]"
              : "grid-cols-1"
          }`}>
            <ViewerCanvas
              result={result}
              searchTerm={searchTerm}
              selectedPartId={selectedPartId}
              hiddenPartIds={hiddenPartIds}
              explode={explode}
              isLoading={isLoading}
              fullscreen={fullscreen}
              resetToken={viewReset}
              onSelectPart={handleSelectPart}
            />

            {isInfoOpen && selectedPart ? (
            <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="ml-auto block rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.08]"
              >
                Close details
              </button>
              <section className="rounded-[1.8rem] border border-white/10 bg-[#040714] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/[0.45]">
                      AI tutor
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {selectedPart?.name ?? "Select a part to begin"}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
                      {selectedPart
                        ? selectedPart.description
                        : "Click any label or region on the model and the tutor will explain it in a grounded, study-friendly way."}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em] text-white/60">
                    {tutorLoading ? "Loading" : "Mock fallback"}
                  </span>
                </div>

                {tutorError ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                    {tutorError}
                  </div>
                ) : null}

                {selectedPart ? (
                  tutorLoading && !tutorResponse ? (
                    <div className="mt-4 space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <div className="h-3 w-24 rounded-full bg-white/10" />
                          <div className="mt-3 h-4 w-4/5 rounded-full bg-white/10" />
                          <div className="mt-2 h-4 w-3/5 rounded-full bg-white/10" />
                        </div>
                      ))}
                    </div>
                  ) : tutorContent ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs uppercase tracking-[0.26em] text-white/[0.45]">
                          Explanation
                        </p>
                        <p className="mt-2 text-sm leading-7 text-white/[0.75]">
                          {tutorContent.explanation}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs uppercase tracking-[0.26em] text-white/[0.45]">
                          Function
                        </p>
                        <p className="mt-2 text-sm leading-7 text-white/[0.75]">
                          {tutorContent.function}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.26em] text-white/[0.45]">
                            Related structures
                          </p>
                          <span className="text-[0.65rem] uppercase tracking-[0.22em] text-white/45">
                            {selectedPart.related.length} linked
                          </span>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          {tutorContent.relatedStructures.length ? (
                            tutorContent.relatedStructures.map((relation) => (
                              <div
                                key={`${relation.id}-${relation.direction}-${relation.relation}`}
                                className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-white/75"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-white">
                                    {relation.name}
                                  </span>
                                  <span className="text-[0.65rem] uppercase tracking-[0.18em] text-white/45">
                                    {relation.direction === "outgoing"
                                      ? "Connected to"
                                      : "Connected from"}{" "}
                                    {relation.relation}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-white/55">
                                  {relation.detail}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-white/45">
                              No relationship data was returned for this part.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs uppercase tracking-[0.26em] text-white/[0.45]">
                          Quiz questions
                        </p>
                        <div className="mt-3 grid gap-2">
                          {tutorContent.quizQuestions.map((question, index) => (
                            <div
                              key={question}
                              className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-3"
                            >
                              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-white/45">
                                Question {index + 1}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-white/80">
                                {question}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs uppercase tracking-[0.26em] text-white/[0.45]">
                          Study tip
                        </p>
                        <p className="mt-2 text-sm leading-7 text-white/[0.72]">
                          {tutorContent.studyTip}
                        </p>
                      </div>
                    </div>
                  ) : null
                ) : (
                  <p className="mt-4 text-sm leading-7 text-white/55">
                    Select a label or click a region on the model to surface a tutor response.
                  </p>
                )}
              </section>

              <section className="rounded-[1.8rem] border border-white/10 bg-[#040714] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/[0.45]">
                      Layer controls
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      Show or hide parts
                    </h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em] text-white/60">
                    {visiblePartCount}/{partInsights.length} visible
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={showAllParts}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/[0.08]"
                  >
                    Show all
                  </button>
                  <button
                    type="button"
                    onClick={hideAllParts}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/[0.08]"
                  >
                    Hide all
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {filteredParts.length ? (
                    filteredParts.map((part) => {
                      const hidden = hiddenPartIds.has(part.id);
                      const active = selectedPartId === part.id;

                      return (
                        <div
                          key={part.id}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                            active
                              ? "border-cyan-300/30 bg-cyan-500/12"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedPartId(part.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: part.accent }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-white">
                                {part.name}
                              </span>
                              <span className="block truncate text-xs text-white/45">
                                {part.description}
                              </span>
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleVisibility(part.id)}
                            aria-pressed={!hidden}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                              hidden
                                ? "border-white/10 bg-white/[0.03] text-white/45"
                                : "border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/[0.1]"
                            }`}
                          >
                            <EyeIcon hidden={hidden} />
                            {hidden ? "Show" : "Hide"}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                      No parts match your search. Try a different term or clear the filter.
                    </div>
                  )}
                </div>
              </section>
            </aside>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );

  if (fullscreen && portalTarget) {
    return createPortal(immersiveTree, portalTarget);
  }

  return viewerTree;
}

function ViewerCanvas({
  result,
  searchTerm,
  selectedPartId,
  hiddenPartIds,
  explode,
  isLoading = false,
  fullscreen = false,
  resetToken,
  onSelectPart
}: ViewerCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [labelLayouts, setLabelLayouts] = useState<Record<string, LabelLayout>>({});
  const labelLayoutsRef = useRef<Record<string, LabelLayout>>({});
  const [referenceModelState, setReferenceModelState] =
    useState<ReferenceModelState>(() =>
      result.atlasMetadata?.referenceAssetUrl ? "loading" : "fallback"
    );
  const interactionRef = useRef({
    searchTerm,
    selectedPartId,
    hiddenPartIds,
    explode
  });

  useEffect(() => {
    interactionRef.current = {
      searchTerm,
      selectedPartId,
      hiddenPartIds,
      explode
    };
  }, [searchTerm, selectedPartId, hiddenPartIds, explode]);

  useEffect(() => {
    setReferenceModelState(
      result.atlasMetadata?.referenceAssetUrl ? "loading" : "fallback"
    );
  }, [result.atlasMetadata?.referenceAssetUrl, result.sourceFileName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const viewport = container;

    labelLayoutsRef.current = {};
    setLabelLayouts({});

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050816");
    scene.fog = new THREE.Fog("#050816", 8, 18);

    const camera = new THREE.PerspectiveCamera(
      46,
      viewport.clientWidth / viewport.clientHeight,
      0.1,
      100
    );
    camera.position.set(0.15, 0.2, 6.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.setClearColor("#050816");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    viewport.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.target.set(0, 0, 0);
    controls.update();

    const root = new THREE.Group();
    root.rotation.y = -0.42;
    scene.add(root);
    root.add(createBackdrop());
    const referenceModelRoot = new THREE.Group();
    root.add(referenceModelRoot);

    const ambient = new THREE.AmbientLight(0xffffff, 1.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(4.4, 6, 8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.05);
    fillLight.position.set(-5, 2.4, 3.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfb7185, 0.8);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    const visuals = buildPartVisuals(result);
    const lines = buildRelationshipLines(result, visuals);

    for (const visual of visuals) {
      root.add(visual.object);
    }

    for (const relation of lines) {
      root.add(relation.line);
    }

    const bounds = new THREE.Box3();
    for (const visual of visuals) {
      bounds.expandByPoint(visual.placement.basePosition.clone());
      bounds.expandByPoint(visual.placement.explodedPosition.clone());
    }

    const center = new THREE.Vector3();
    bounds.getCenter(center);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const radius = Math.max(size.x, size.y, size.z) * 0.82 + 1.6;

    controls.target.copy(center);
    camera.position.set(center.x + radius * 0.06, center.y + radius * 0.12, center.z + radius * 1.9);
    controls.minDistance = Math.max(2.8, radius * 0.68);
    controls.maxDistance = radius * 3.3;
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickableMeshes = visuals.map((visual) => visual.object);
    const referenceAssetUrls = result.atlasMetadata?.referenceAssetUrl
      ? Array.isArray(result.atlasMetadata.referenceAssetUrl)
        ? result.atlasMetadata.referenceAssetUrl
        : [result.atlasMetadata.referenceAssetUrl]
      : [];
    const referenceAnchors = new Map<
      string,
      InstanceType<typeof THREE.Object3D>
    >();
    const referenceMeshes: ReferenceMesh[] = [];
    let referenceModelLoaded = false;
    let referenceModelPending = referenceAssetUrls.length > 0;
    let disposed = false;
    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = viewport;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    });

    resizeObserver.observe(viewport);

    if (referenceAssetUrls.length > 0) {
      const loader = new GLTFLoader();
      loader.setCrossOrigin("anonymous");
      const loadReference = (url: string) =>
        (loader as GLTFLoader & { loadAsync: (assetUrl: string) => Promise<any> }).loadAsync(url);
      void Promise.all(referenceAssetUrls.map(loadReference))
        .then((gltfs) => {
          if (disposed) {
            for (const gltf of gltfs) {
              disposeObject3D(gltf.scene);
            }
            return;
          }

          const assembledReferenceModel = new THREE.Group();
          for (const gltf of gltfs) {
            assembledReferenceModel.add(gltf.scene);
          }

          centerReferenceModel(assembledReferenceModel);
          assembledReferenceModel.traverse((object: InstanceType<typeof THREE.Object3D>) => {
            const candidate = object as InstanceType<typeof THREE.Mesh>;
            if (!candidate.isMesh) {
              return;
            }

            const part = findPartForReferenceObject(object, result.parts);
            candidate.userData.partId = part?.id;

            if (part && !referenceAnchors.has(part.id)) {
              referenceAnchors.set(part.id, candidate);
            }

            const sourceMaterials = Array.isArray(candidate.material)
              ? candidate.material
              : [candidate.material];
            const clonedMaterials = sourceMaterials.map((material: any) =>
              material.clone()
            );
            candidate.material = Array.isArray(candidate.material)
              ? clonedMaterials
              : clonedMaterials[0];

            for (const material of clonedMaterials) {
              referenceMeshes.push({
                mesh: candidate,
                partId: part?.id ?? null,
                material,
                baseOpacity: material.opacity ?? 1,
                baseEmissiveIntensity: material.emissiveIntensity ?? 0
              });
            }
          });

          referenceModelRoot.add(assembledReferenceModel);
          clickableMeshes.push(assembledReferenceModel);
          referenceModelLoaded = true;
          referenceModelPending = false;
          setReferenceModelState("reference");
        })
        .catch(() => {
          if (!disposed) {
            referenceModelPending = false;
            setReferenceModelState("fallback");
          }
        });
    } else {
      referenceModelPending = false;
      setReferenceModelState("fallback");
    }

    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(clickableMeshes, true);
      const state = interactionRef.current;
      const hit = intersections.find(
        (intersection: any) => {
          const partId = intersection.object.userData.partId;
          return (
            typeof partId === "string" && !state.hiddenPartIds.has(partId)
          );
        }
      );

      if (hit) {
        const partId = String(hit.object.userData.partId);
        onSelectPart(partId);
      } else {
        onSelectPart(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    let explodeFactor = explode ? 1 : 0;
    let animationFrame = 0;
    let lastLabelUpdate = 0;
    const tempCameraSpace = new THREE.Vector3();
    const tempLabelOffset = new THREE.Vector3();

    function updateLines(selectedId: string | null) {
      const state = interactionRef.current;

      for (const relation of lines) {
        const sourceVisible = !state.hiddenPartIds.has(relation.source.part.id);
        const targetVisible = !state.hiddenPartIds.has(relation.target.part.id);
        relation.line.visible =
          !referenceModelLoaded && sourceVisible && targetVisible;

        const sourcePosition = relation.source.object.position;
        const targetPosition = relation.target.object.position;
        const attribute = relation.line.geometry.getAttribute("position") as any;
        attribute.setXYZ(0, sourcePosition.x, sourcePosition.y, sourcePosition.z);
        attribute.setXYZ(1, targetPosition.x, targetPosition.y, targetPosition.z);
        attribute.needsUpdate = true;

        const isActive =
          selectedId === relation.source.part.id || selectedId === relation.target.part.id;
        relation.material.opacity = isActive ? 0.35 : 0.14;
      }
    }

    function updateLabels() {
      if (performance.now() - lastLabelUpdate < 80) {
        return;
      }

      const nextLayouts: Record<string, LabelLayout> = {};
      const state = interactionRef.current;
      const currentSearchTerm = state.searchTerm.toLowerCase().trim();

      if (referenceModelPending) {
        for (const visual of visuals) {
          nextLayouts[visual.part.id] = {
            x: 0,
            y: 0,
            anchorX: 0,
            anchorY: 0,
            side: "left",
            visible: false
          };
        }
        if (labelLayoutsChanged(labelLayoutsRef.current, nextLayouts)) {
          labelLayoutsRef.current = nextLayouts;
          setLabelLayouts(nextLayouts);
        }
        lastLabelUpdate = performance.now();
        return;
      }

      const projectedLabels: Array<{
        partId: string;
        x: number;
        y: number;
        anchorX: number;
        anchorY: number;
        side: "left" | "right";
      }> = [];

      for (const visual of visuals) {
        const hidden = state.hiddenPartIds.has(visual.part.id);
        const matches =
          !currentSearchTerm || matchesSearch(visual.part, currentSearchTerm);

        if (hidden || !matches) {
          nextLayouts[visual.part.id] = {
            x: 0,
            y: 0,
            anchorX: 0,
            anchorY: 0,
            side: "left",
            visible: false
          };
          continue;
        }

        const referenceAnchor = referenceAnchors.get(visual.part.id);
        (referenceAnchor ?? visual.object).getWorldPosition(tempCameraSpace);
        tempLabelOffset
          .copy(referenceAnchor ? new THREE.Vector3(0, 0.28, 0) : visual.placement.labelOffset)
          .applyQuaternion(referenceAnchor ? new THREE.Quaternion() : root.quaternion);
        tempCameraSpace.add(tempLabelOffset);
        tempCameraSpace.project(camera);

        const visible =
          tempCameraSpace.z > -1 &&
          tempCameraSpace.z < 1 &&
          tempCameraSpace.x >= -1.05 &&
          tempCameraSpace.x <= 1.05 &&
          tempCameraSpace.y >= -1.05 &&
          tempCameraSpace.y <= 1.05;

        if (!visible) {
          nextLayouts[visual.part.id] = {
            x: 0,
            y: 0,
            anchorX: 0,
            anchorY: 0,
            side: "left",
            visible: false
          };
          continue;
        }

        const x = ((tempCameraSpace.x + 1) * 0.5) * viewport.clientWidth;
        const y = ((1 - tempCameraSpace.y) * 0.5) * viewport.clientHeight;
        projectedLabels.push({
          partId: visual.part.id,
          x,
          y,
          anchorX: x,
          anchorY: y,
          side: x < viewport.clientWidth / 2 ? "left" : "right"
        });
      }

      // Keep anatomy callouts in tidy, collision-free rails on either side of
      // the stage. The label stays associated with its mesh, but never sits on
      // top of the model where it would obscure the structure being studied.
      for (const side of ["left", "right"] as const) {
        const sideLabels = projectedLabels
          .filter((label) => label.side === side)
          .sort((a, b) => a.y - b.y);
        const top = 96;
        const bottom = Math.max(top, viewport.clientHeight - 70);
        const distance = camera.position.distanceTo(controls.target);
        const zoomLabelFactor = THREE.MathUtils.clamp(1.45 - distance / 9, 0.42, 1);
        const maxLabels = Math.max(
          3,
          Math.floor(((bottom - top) / 42 + 1) * zoomLabelFactor)
        );
        const displayLabels =
          sideLabels.length > maxLabels
            ? [...sideLabels]
                .sort((a, b) => {
                  const aPriority = a.partId === state.selectedPartId ? -1 : 0;
                  const bPriority = b.partId === state.selectedPartId ? -1 : 0;
                  return (
                    aPriority - bPriority ||
                    Math.abs(a.y - viewport.clientHeight / 2) -
                      Math.abs(b.y - viewport.clientHeight / 2)
                  );
                })
                .slice(0, maxLabels)
                .sort((a, b) => a.y - b.y)
            : sideLabels;
        const gap = Math.min(
          46,
          Math.max(25, (bottom - top) / Math.max(displayLabels.length - 1, 1))
        );
        const labelYs = displayLabels.map((label) =>
          Math.max(top, Math.min(bottom, label.y))
        );

        for (let index = 1; index < labelYs.length; index += 1) {
          labelYs[index] = Math.max(labelYs[index], labelYs[index - 1] + gap);
        }

        const overflow = Math.max(0, (labelYs.at(-1) ?? top) - bottom);
        if (overflow > 0) {
          for (let index = 0; index < labelYs.length; index += 1) {
            labelYs[index] -= overflow;
          }
        }

        const railX = side === "left" ? 100 : viewport.clientWidth - 100;
        for (const [index, label] of displayLabels.entries()) {
          nextLayouts[label.partId] = {
            x: railX,
            y: labelYs[index],
            anchorX: label.anchorX,
            anchorY: label.anchorY,
            side,
            visible: true
          };
        }
      }

      if (labelLayoutsChanged(labelLayoutsRef.current, nextLayouts)) {
        labelLayoutsRef.current = nextLayouts;
        setLabelLayouts(nextLayouts);
      }
      lastLabelUpdate = performance.now();
    }

    function animate() {
      const state = interactionRef.current;
      explodeFactor = THREE.MathUtils.lerp(explodeFactor, state.explode ? 1 : 0, 0.08);

      for (const visual of visuals) {
        const hidden = state.hiddenPartIds.has(visual.part.id);
        const selected = state.selectedPartId === visual.part.id;
        const searchMatch = matchesSearch(visual.part, state.searchTerm);
        const targetOpacity = hidden ? 0.06 : searchMatch ? 0.96 : 0.26;

        visual.object.visible =
          !referenceModelLoaded && !referenceModelPending && !hidden;
        visual.object.position.lerpVectors(
          visual.placement.basePosition,
          visual.placement.explodedPosition,
          explodeFactor
        );
        visual.object.rotation.copy(visual.placement.rotation);
        visual.object.scale.copy(visual.placement.scale).multiplyScalar(selected ? 1.08 : 1);

        for (const material of visual.materials) {
          material.opacity = targetOpacity;
          material.emissiveIntensity = selected ? 0.68 : searchMatch ? 0.2 : 0.08;
        }
      }

      if (referenceModelLoaded) {
        for (const referenceMesh of referenceMeshes) {
          const hidden =
            referenceMesh.partId !== null &&
            state.hiddenPartIds.has(referenceMesh.partId);
          const selected = referenceMesh.partId === state.selectedPartId;
          const searchMatch =
            referenceMesh.partId === null ||
            matchesSearch(
              result.parts.find((part) => part.id === referenceMesh.partId) ??
                result.parts[0],
              state.searchTerm
            );

          referenceMesh.mesh.visible = !hidden;
          referenceMesh.material.transparent =
            referenceMesh.baseOpacity < 1 || !searchMatch;
          referenceMesh.material.opacity = searchMatch
            ? referenceMesh.baseOpacity
            : Math.min(referenceMesh.baseOpacity, 0.28);

          if (referenceMesh.material.emissive) {
            referenceMesh.material.emissive.set(
              selected ? partColor(referenceMesh.partId ?? "", result) : "#000000"
            );
            referenceMesh.material.emissiveIntensity = selected
              ? Math.max(referenceMesh.baseEmissiveIntensity, 0.48)
              : referenceMesh.baseEmissiveIntensity;
          }
        }
      }

      updateLines(state.selectedPartId);
      controls.update();
      renderer.render(scene, camera);
      updateLabels();
      animationFrame = window.requestAnimationFrame(animate);
    }

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.dispose();
      renderer.dispose();
      disposeObject3D(scene);
      viewport.removeChild(renderer.domElement);
    };
  }, [result, onSelectPart, resetToken]);

  const visibleLabels = result.parts.filter(
    (part) => !hiddenPartIds.has(part.id) && matchesSearch(part, searchTerm)
  );

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#040714] ${
        fullscreen ? "min-h-0 h-full" : "min-h-[480px] xl:min-h-0 xl:h-full"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.15),transparent_36%),radial-gradient(circle_at_70%_20%,rgba(251,113,133,0.14),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.95),rgba(3,7,18,0.98))]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.92), rgba(0,0,0,0.4) 72%, transparent)",
          WebkitMaskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.92), rgba(0,0,0,0.4) 72%, transparent)"
        }}
      />

      <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/60 backdrop-blur">
        Drag to orbit
        <span className="text-white/30">·</span>
        Scroll to zoom
        <span className="text-white/30">·</span>
        Click parts
      </div>

      <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/60 backdrop-blur">
        {isLoading
          ? "Analyzing upload"
          : referenceModelState === "reference"
            ? "Reference GLB loaded"
            : referenceModelState === "loading"
              ? "Loading reference GLB"
              : "Offline study fallback"}
      </div>

      <div ref={containerRef} className="absolute inset-0" />

      {referenceModelState === "loading" && !isLoading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-[1.6rem] border border-cyan-300/20 bg-slate-950/75 px-6 py-5 text-center shadow-[0_18px_54px_rgba(2,6,23,0.44)] backdrop-blur-xl">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-50">
              Loading reference anatomy
            </p>
            <p className="mt-2 max-w-56 text-sm leading-6 text-white/55">
              Fetching the full 3D {result.organName.toLowerCase()} model.
            </p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {visibleLabels.map((part) => {
            const layout = labelLayouts[part.id];

            if (!layout?.visible) {
              return null;
            }

            return (
              <path
                key={`leader-${part.id}`}
                d={`M ${layout.anchorX} ${layout.anchorY} L ${
                  layout.side === "left" ? layout.x + 42 : layout.x - 42
                } ${layout.y}`}
                fill="none"
                stroke={partColor(part.id, result)}
                strokeOpacity="0.58"
                strokeWidth="1.2"
              />
            );
          })}
        </svg>
        {visibleLabels.map((part) => {
          const layout = labelLayouts[part.id];
          const selected = selectedPartId === part.id;

          if (!layout?.visible) {
            return null;
          }

          return (
            <button
              key={part.id}
              type="button"
              onClick={() => onSelectPart(part.id)}
              className={`pointer-events-auto absolute max-w-[calc(50%-7rem)] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] backdrop-blur transition-[left,top,transform,background-color,border-color] duration-200 ease-out hover:scale-[1.03] ${
                selected
                  ? "border-cyan-300/45 bg-cyan-500/18 text-white shadow-[0_0_24px_rgba(56,189,248,0.2)]"
                  : "border-white/10 bg-slate-950/66 text-white/80 hover:bg-white/[0.08]"
              }`}
              style={{
                left: layout.x,
                top: layout.y,
                boxShadow: `0 0 0 1px ${partInsightsColor(part.id, result)}`
              }}
            >
              <span
                className="mr-2 inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: partColor(part.id, result) }}
              />
              {part.name}
            </button>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex items-center justify-between gap-3">
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/55 backdrop-blur">
          {visibleLabels.length} labels visible
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/55 backdrop-blur">
          {referenceModelState === "reference"
            ? result.atlasMetadata?.referenceAttribution ?? "Reference anatomy"
            : referenceModelState === "loading"
              ? "Loading real anatomy model"
              : "Reference model unavailable · local fallback"}
        </div>
      </div>
    </div>
  );
}

function partColor(partId: string, result: VisionExtractionResult) {
  const index = result.parts.findIndex((part) => part.id === partId);
  return palette[(index < 0 ? 0 : index) % palette.length];
}

function partInsightsColor(partId: string, result: VisionExtractionResult) {
  const base = partColor(partId, result);
  return `${base}55`;
}

export { AnatomyViewer };
