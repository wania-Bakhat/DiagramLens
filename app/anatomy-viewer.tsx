"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import projectCustomLabelFile from "@/data/custom-labels.json";
import {
  findAtlasOrgan,
  getAtlasMetadata,
  type AtlasOrgan
} from "@/lib/atlas";
import {
  getCustomLabelModelKey,
  normaliseCustomLabels,
  type CustomLabel,
  type ProjectCustomLabelFile
} from "@/lib/custom-labels";
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
  markerX: number;
  markerY: number;
  visible: boolean;
};

type CustomLabelState = {
  storageKey: string;
  labels: CustomLabel[];
};

type ReferenceModelState = "loading" | "reference" | "fallback";
type ProjectLabelSaveState = "idle" | "saving" | "saved" | "local-only";

type TutorChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ReferenceMesh = {
  mesh: InstanceType<typeof THREE.Mesh>;
  partId: string | null;
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
  "#f472b6",
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

const projectCustomLabels = projectCustomLabelFile as unknown as ProjectCustomLabelFile;

function getCustomLabelStorageKey(modelKey: string) {
  return `diagramlens-custom-labels-v1:${modelKey}`;
}

function readCustomLabels(storageKey: string): CustomLabel[] {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return [];
    }

    return normaliseCustomLabels(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

function getProjectCustomLabels(modelKey: string) {
  return normaliseCustomLabels(projectCustomLabels.models[modelKey]);
}

// A learner's wording can be more specific than the atlas's internal part
// name. Keep these medically equivalent terms explicit so custom markers open
// the same grounded description panel as built-in labels.
const customLabelPartAliases: Record<string, Record<string, string>> = {
  heart: {
    "pulmonary-trunk": "pulmonary_artery"
  },
  lungs: {
    "left-superior-lobe": "left_upper_lobe",
    "left-inferior-lobe": "left_lower_lobe",
    "right-superior-lobe": "right_upper_lobe",
    "right-inferior-lobe": "right_lower_lobe",
    apex: "lung_apex"
  },
  kidneys: {
    cortex: "renal_cortex"
  },
  liver: {
    "hepatic-vein": "hepatic_veins"
  },
  eye: {
    // The saved marker text is preserved exactly; the study notes open the
    // medically intended retinal-artery entry from the supplied reference.
    "renal-arteries": "retinal_arteries"
  },
  pancreas: {
    head: "pancreatic_head",
    body: "pancreatic_body",
    tail: "pancreatic_tail"
  },
  spleen: {
    capsule: "splenic_capsule",
    "follicels": "lymphoid_follicles"
  },
  "vascular-system": {
    "pulmonary-artery": "pulmonary_arteries",
    "lliac-vein": "common_iliac_vein"
  },
  skeleton: {
    spine: "vertebral_column"
  }
};

function getCustomLabelPartId(
  label: CustomLabel,
  result: VisionExtractionResult
) {
  const labelName = slugify(label.name);
  const exactMatch = result.parts.find(
    (part) => slugify(part.name) === labelName || slugify(part.id) === labelName
  );

  if (exactMatch) {
    return exactMatch.id;
  }

  const organKey = slugify(result.organSlug ?? result.organName);
  const aliasPartId = customLabelPartAliases[organKey]?.[labelName];
  return result.parts.some((part) => part.id === aliasPartId)
    ? aliasPartId
    : null;
}

function createCustomLabelId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `label-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Source GLBs use different anatomy vocabularies. Keep the bridge explicit so
// study labels highlight a matching real mesh whenever that structure exists.
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
  renal_hilum: ["hilum-of-kidney"],
  renal_cortex: ["cortex-of-kidney", "maya-2018-cortex", "cortex"],
  renal_medulla: ["renal-medulla", "medulla"],
  renal_pyramids: ["maya-2018-medulla-pyramid", "medulla-pyramid", "renal-pyramid"],
  renal_capsule: ["kidney-capsule", "maya-2018-capsule", "capsule"],
  renal_artery: ["maya-2018-red", "renal-artery"],
  renal_vein: ["maya-2018-blue", "renal-vein"],
  ureter: ["maya-2018-ureter", "ureter"],
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

  let bestMatch: VisionPart | null = null;
  let bestScore = 0;

  for (const part of parts) {
    const identifiers = [
      slugify(part.id),
      slugify(part.name),
      ...(referencePartAliases[part.id] ?? [])
    ];

    for (const nodeName of nodeNames) {
      for (const identifier of identifiers) {
        let score = 0;

        if (nodeName === identifier) {
          score = 10_000 + identifier.length;
        } else if (nodeName.includes(identifier)) {
          score = 1_000 + identifier.length;
        } else if (nodeName.length > 6 && identifier.includes(nodeName)) {
          score = nodeName.length;
        }

        if (score > bestScore) {
          bestMatch = part;
          bestScore = score;
        }
      }
    }
  }

  return bestMatch;
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
      Math.abs(before.x - after.x) > 1.5 ||
      Math.abs(before.y - after.y) > 1.5 ||
      Math.abs(before.markerX - after.markerX) > 1.5 ||
      Math.abs(before.markerY - after.markerY) > 1.5
    );
  });
}

type MarkerCandidate = {
  id: string;
  x: number;
  y: number;
};

// Normalized anatomical targets for models whose GLB nodes do not retain a
// separate mesh name for every structure. The ray is cast through each target
// and snaps to the actual model surface, so the dot remains attached as the
// model turns while still pointing to the correct anatomical region.
const referenceAnchorHints: Record<string, Record<string, [number, number, number]>> = {
  heart: {
    left_atrium: [0.34, 0.34, 0.7],
    right_atrium: [-0.38, 0.3, 0.7],
    left_ventricle: [0.28, -0.34, 0.82],
    right_ventricle: [-0.24, -0.26, 0.86],
    mitral_valve: [0.13, 0.08, 0.9],
    tricuspid_valve: [-0.14, 0.04, 0.9],
    pulmonary_valve: [-0.05, 0.5, 0.86],
    aortic_valve: [0.14, 0.58, 0.8],
    aorta: [0.14, 0.86, 0.58],
    myocardium: [0, -0.08, 0.94],
    superior_vena_cava: [-0.42, 0.72, 0.6],
    inferior_vena_cava: [-0.38, -0.32, 0.48],
    pulmonary_artery: [0.05, 0.62, 0.84],
    pulmonary_veins: [0.5, 0.34, 0.62],
    interventricular_septum: [0.02, -0.22, 0.9],
    coronary_arteries: [0.1, -0.02, 0.98]
  },
  lungs: {
    trachea: [0, 0.9, 0.56],
    bronchi: [0, 0.28, 0.78],
    carina: [0, 0.38, 0.82],
    right_lung: [-0.48, -0.02, 0.76],
    left_lung: [0.48, -0.02, 0.76],
    right_upper_lobe: [-0.48, 0.32, 0.82],
    right_middle_lobe: [-0.52, -0.04, 0.9],
    right_lower_lobe: [-0.45, -0.42, 0.8],
    left_upper_lobe: [0.46, 0.28, 0.82],
    left_lower_lobe: [0.45, -0.36, 0.82],
    alveoli: [0.42, -0.16, 0.96],
    diaphragm: [0, -0.72, 0.62]
  },
  brain: {
    cerebrum: [0, 0.3, 0.76],
    frontal_lobe: [0.62, 0.28, 0.72],
    parietal_lobe: [0.02, 0.76, 0.68],
    temporal_lobe: [0.28, -0.12, 0.86],
    occipital_lobe: [-0.66, 0.22, 0.64],
    cerebellum: [-0.58, -0.36, 0.68],
    brainstem: [-0.1, -0.54, 0.48],
    spinal_cord: [-0.08, -0.9, 0.3],
    corpus_callosum: [0.02, 0.18, 0.94],
    thalamus: [-0.02, 0.02, 0.96],
    hypothalamus: [0.02, -0.18, 0.96],
    hippocampus: [0.3, -0.18, 0.9],
    pituitary_gland: [0.06, -0.4, 0.86]
  },
  kidneys: {
    renal_artery: [-0.16, 0.02, 0.82],
    renal_vein: [0.14, 0.02, 0.82],
    renal_capsule: [-0.58, 0.18, 0.76],
    renal_cortex: [0.52, 0.18, 0.86],
    renal_medulla: [0.44, 0.02, 0.94],
    renal_pyramids: [0.42, -0.18, 0.94],
    ureter: [0.38, -0.58, 0.65]
  },
  liver: {
    right_lobe: [-0.48, 0.08, 0.8],
    left_lobe: [0.52, 0.1, 0.8],
    falciform_ligament: [0.02, 0.18, 0.98],
    gallbladder: [-0.16, -0.46, 0.74],
    portal_vein: [-0.12, -0.3, 0.86],
    hepatic_duct: [-0.04, -0.5, 0.86],
    common_bile_duct: [-0.02, -0.68, 0.82],
    hepatic_artery: [-0.22, -0.3, 0.9],
    hepatic_veins: [0.06, 0.32, 0.76],
    caudate_lobe: [-0.22, 0.18, -0.7],
    quadrate_lobe: [-0.12, -0.28, 0.82]
  },
  eye: {
    cornea: [0.94, 0.04, 0.2],
    iris: [0.7, 0.02, 0.36],
    pupil: [0.76, 0.02, 0.42],
    lens: [0.38, 0.02, 0.4],
    aqueous_humor: [0.54, 0.12, 0.46],
    vitreous_body: [-0.14, 0.08, 0.56],
    retina: [-0.64, 0.04, 0.34],
    choroid: [-0.7, 0.08, 0.3],
    sclera: [-0.1, 0.42, 0.82],
    optic_nerve: [-0.96, 0.04, 0.08]
  },
  pancreas: {
    pancreatic_head: [-0.76, -0.1, 0.72],
    pancreatic_neck: [-0.36, -0.02, 0.8],
    pancreatic_body: [0.1, 0.04, 0.84],
    pancreatic_tail: [0.76, 0.12, 0.76],
    pancreatic_duct: [0.08, -0.02, 0.98],
    islets_of_langerhans: [0.3, 0.16, 0.92],
    duodenum: [-0.9, -0.28, 0.58]
  },
  "digestive-system": {
    // The supplied digestive GLB is a single mesh. These targets deliberately
    // distinguish the upper liver, pancreatic bed, central small-bowel coils,
    // outer colonic frame, and duct area rather than aiming every label at the
    // same front-facing abdominal surface.
    liver: [-0.24, 0.12, 0.88],
    pancreas: [0.18, -0.12, 0.72],
    small_intestine: [0.06, -0.56, 0.26],
    large_intestine: [-0.68, -0.46, 0.92],
    bile_pathway: [-0.3, 0.02, 0.94]
  },
  spleen: {
    spleen: [0, 0.04, 0.88],
    splenic_capsule: [0.18, 0.34, 0.92],
    white_pulp: [0.22, 0.02, 0.96],
    red_pulp: [-0.16, -0.16, 0.94],
    splenic_hilum: [-0.78, 0.02, 0.76]
  },
  "vascular-system": {
    aorta: [0.04, 0.18, 0.8],
    superior_vena_cava: [-0.1, 0.42, 0.74],
    inferior_vena_cava: [-0.1, -0.22, 0.7],
    pulmonary_arteries: [-0.22, 0.22, 0.88],
    pulmonary_veins: [0.22, 0.2, 0.86]
  },
  skeleton: {
    skull: [0, 0.9, 0.66],
    vertebral_column: [0, 0.12, 0.34],
    rib_cage: [0, 0.42, 0.76],
    pelvis: [0, -0.14, 0.72],
    femur: [0.24, -0.54, 0.62],
    humerus: [0.5, 0.38, 0.62]
  },
  "human-body": {
    skeletal_system: [-0.26, 0.14, 0.86],
    circulatory_system: [0, 0.2, 0.9],
    digestive_system: [0, -0.04, 0.92],
    respiratory_system: [0, 0.36, 0.92],
    urinary_system: [0, -0.18, 0.88]
  }
};

// These reference assets contain a single combined mesh. Casting a ray from
// the camera-facing side always hits the oesophagus or colon first, even when
// the intended target is the liver or the central small-bowel loops.
const nearestSurfaceAnchorParts: Record<string, Set<string>> = {
  "digestive-system": new Set([
    "liver",
    "pancreas",
    "small_intestine",
    "large_intestine",
    "bile_pathway"
  ])
};

function shouldUseNearestSurfaceAnchor(
  result: VisionExtractionResult,
  partId: string
) {
  return Boolean(
    nearestSurfaceAnchorParts[slugify(result.organSlug ?? result.organName)]?.has(partId)
  );
}

function getReferenceAnchorTarget(
  result: VisionExtractionResult,
  partId: string,
  modelLocalBounds: InstanceType<typeof THREE.Box3>,
  modelCenter: InstanceType<typeof THREE.Vector3>,
  fallbackDirection: InstanceType<typeof THREE.Vector3>
) {
  const organKey = slugify(result.organSlug ?? result.organName);
  const hint = referenceAnchorHints[organKey]?.[partId];

  if (!hint) {
    const modelSize = modelLocalBounds.getSize(new THREE.Vector3());
    return modelCenter
      .clone()
      .addScaledVector(
        fallbackDirection,
        Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.5
      );
  }

  const localCenter = modelLocalBounds.getCenter(new THREE.Vector3());
  const localSize = modelLocalBounds.getSize(new THREE.Vector3());
  const targetPoint = localCenter
    .add(
      new THREE.Vector3(
        hint[0] * localSize.x * 0.5,
        hint[1] * localSize.y * 0.5,
        hint[2] * localSize.z * 0.5
      )
    );

  // setFromObject returns world-space bounds here. Applying model.localToWorld
  // a second time collapsed every digestive target into the same direction.
  return targetPoint;
}

function findNearestReferenceSurfacePoint(
  model: InstanceType<typeof THREE.Object3D>,
  targetPoint: InstanceType<typeof THREE.Vector3>
) {
  let nearestPoint: InstanceType<typeof THREE.Vector3> | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const candidatePoint = new THREE.Vector3();

  model.traverse((object: InstanceType<typeof THREE.Object3D>) => {
    const mesh = object as InstanceType<typeof THREE.Mesh>;
    const position = mesh.isMesh ? mesh.geometry.attributes.position : undefined;

    if (!position) {
      return;
    }

    // Keep this bounded for very dense reference models while retaining every
    // vertex on compact single-mesh organs such as the digestive system.
    const stride = Math.max(1, Math.floor(position.count / 30_000));
    for (let index = 0; index < position.count; index += stride) {
      candidatePoint.fromBufferAttribute(position, index);
      mesh.localToWorld(candidatePoint);
      const distance = candidatePoint.distanceToSquared(targetPoint);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = candidatePoint.clone();
      }
    }
  });

  return nearestPoint;
}

// Markers stay on their anatomical surface targets. When two points project
// onto the same screen position, only those nearby number badges are offset;
// a thin connector retains the exact target location without covering it.
function arrangeNumberMarkers(
  candidates: MarkerCandidate[],
  viewportWidth: number,
  viewportHeight: number,
  spreadLabels = false
) {
  const layouts = new Map<string, Pick<LabelLayout, "markerX" | "markerY">>();
  const placed: Array<{ x: number; y: number }> = [];
  const edgePadding = 18;
  const minimumDistance = 27;

  for (const candidate of candidates) {
    const deltaX = candidate.x - viewportWidth / 2;
    const deltaY = candidate.y - viewportHeight / 2;
    const distanceFromCenter = Math.hypot(deltaX, deltaY) || 1;
    const labelOffset = spreadLabels ? 58 : 0;
    const preferredX = THREE.MathUtils.clamp(
      candidate.x + (deltaX / distanceFromCenter) * labelOffset,
      edgePadding,
      viewportWidth - edgePadding
    );
    const preferredY = THREE.MathUtils.clamp(
      candidate.y + (deltaY / distanceFromCenter) * labelOffset,
      edgePadding,
      viewportHeight - edgePadding
    );
    let markerX = preferredX;
    let markerY = preferredY;
    let placedMarker = false;
    let clearestPosition = { x: markerX, y: markerY };
    let greatestClearance = placed.length === 0 ? Number.POSITIVE_INFINITY : -1;

    for (let ring = 0; ring <= 10 && !placedMarker; ring += 1) {
      const radius = ring * 24;
      const steps = ring === 0 ? 1 : Math.max(12, ring * 4);

      for (let step = 0; step < steps; step += 1) {
        const angle = ring === 0 ? 0 : (step / steps) * Math.PI * 2 - Math.PI / 2;
        const nextX = THREE.MathUtils.clamp(
          preferredX + Math.cos(angle) * radius,
          edgePadding,
          viewportWidth - edgePadding
        );
        const nextY = THREE.MathUtils.clamp(
          preferredY + Math.sin(angle) * radius,
          edgePadding,
          viewportHeight - edgePadding
        );
        const clearance = placed.length
          ? Math.min(
              ...placed.map((marker) => Math.hypot(marker.x - nextX, marker.y - nextY))
            )
          : Number.POSITIVE_INFINITY;

        if (clearance > greatestClearance) {
          clearestPosition = { x: nextX, y: nextY };
          greatestClearance = clearance;
        }

        if (clearance >= minimumDistance) {
          markerX = nextX;
          markerY = nextY;
          placedMarker = true;
          break;
        }
      }
    }

    // A very dense projection (for example, vessels seen end-on) can fill
    // the local spiral. Use its clearest point rather than reusing a visible
    // number position.
    if (!placedMarker) {
      markerX = clearestPosition.x;
      markerY = clearestPosition.y;
    }

    placed.push({ x: markerX, y: markerY });
    layouts.set(candidate.id, { markerX, markerY });
  }

  return layouts;
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
      `${part.name} is a labelled structure in the ${organ.organName.toLowerCase()} diagram. ` +
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
    renal_vein: makePlacement(
      new THREE.Vector3(0.16, 0.72, -0.02),
      new THREE.Vector3(0.34, 1.14, -0.08),
      new THREE.Vector3(0.3, 0.36, -0.1),
      new THREE.Vector3(0.32, 0.32, 0.32),
      "vessel",
      new THREE.Euler(-0.12, 0.04, 1.1)
    ),
    renal_capsule: makePlacement(
      new THREE.Vector3(-0.48, 0.12, -0.08),
      new THREE.Vector3(-0.92, 0.22, -0.18),
      new THREE.Vector3(-0.42, -0.12, -0.2),
      new THREE.Vector3(0.88, 1.08, 0.76),
      "kidney-shell",
      new THREE.Euler(0.04, -0.1, 0.06)
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
    renal_pyramids: makePlacement(
      new THREE.Vector3(0.34, -0.04, 0.1),
      new THREE.Vector3(0.66, -0.1, 0.22),
      new THREE.Vector3(0.48, 0.14, 0.2),
      new THREE.Vector3(0.38, 0.6, 0.34),
      "renal-pyramid",
      new THREE.Euler(0.16, 0.24, 0.04)
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

function createTutorChatMessage(
  role: TutorChatMessage["role"],
  content: string
): TutorChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content
  };
}

function renderTutorInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g)
    .filter(Boolean)
    .map((segment, index) => {
      if (
        (segment.startsWith("**") && segment.endsWith("**")) ||
        (segment.startsWith("__") && segment.endsWith("__"))
      ) {
        return (
          <strong key={index} className="font-semibold text-pink-50">
            {segment.slice(2, -2)}
          </strong>
        );
      }

      if (segment.startsWith("`") && segment.endsWith("`")) {
        return (
          <code
            key={index}
            className="rounded bg-slate-950/75 px-1.5 py-0.5 font-mono text-[0.86em] text-pink-100"
          >
            {segment.slice(1, -1)}
          </code>
        );
      }

      return segment;
    });
}

function isTutorHeading(line: string) {
  return /^(#{1,3})\s+(.+)$/.test(line);
}

function isTutorBullet(line: string) {
  return /^\s*[-*+]\s+(.+)$/.test(line);
}

function isTutorOrderedItem(line: string) {
  return /^\s*\d+[.)]\s+(.+)$/.test(line);
}

function TutorMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim();

    if (!line) {
      lineIndex += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const className =
        level === 1
          ? "pt-1 text-lg font-semibold tracking-[-0.02em] text-white"
          : level === 2
            ? "pt-2 text-base font-semibold text-white"
            : "pt-2 text-sm font-semibold text-pink-50";
      const Heading = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as
        | "h2"
        | "h3"
        | "h4";

      blocks.push(
        <Heading key={`heading-${lineIndex}`} className={className}>
          {renderTutorInline(heading[2])}
        </Heading>
      );
      lineIndex += 1;
      continue;
    }

    if (isTutorBullet(line) || isTutorOrderedItem(line)) {
      const ordered = isTutorOrderedItem(line);
      const itemMatcher = ordered
        ? /^\s*\d+[.)]\s+(.+)$/
        : /^\s*[-*+]\s+(.+)$/;
      const items: string[] = [];

      while (lineIndex < lines.length) {
        const nextLine = lines[lineIndex].trim();
        const item = nextLine.match(itemMatcher);

        if (item) {
          items.push(item[1]);
          lineIndex += 1;
          continue;
        }

        if (!nextLine || isTutorHeading(nextLine) || (ordered ? isTutorBullet(nextLine) : isTutorOrderedItem(nextLine))) {
          break;
        }

        if (items.length) {
          items[items.length - 1] = `${items[items.length - 1]} ${nextLine}`;
          lineIndex += 1;
          continue;
        }

        break;
      }

      const List = (ordered ? "ol" : "ul") as "ol" | "ul";
      blocks.push(
        <List
          key={`list-${lineIndex}-${ordered ? "ordered" : "bullet"}`}
          className={`space-y-1.5 pl-5 leading-7 text-white/80 marker:text-pink-200/75 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${item}`}>{renderTutorInline(item)}</li>
          ))}
        </List>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (lineIndex < lines.length) {
      const nextLine = lines[lineIndex].trim();
      if (!nextLine) {
        lineIndex += 1;
        break;
      }

      if (isTutorHeading(nextLine) || isTutorBullet(nextLine) || isTutorOrderedItem(nextLine)) {
        break;
      }

      paragraph.push(nextLine);
      lineIndex += 1;
    }

    if (paragraph.length) {
      blocks.push(
        <p key={`paragraph-${lineIndex}`} className="leading-7 text-white/80">
          {renderTutorInline(paragraph.join(" "))}
        </p>
      );
    }
  }

  return <div className="space-y-3">{blocks}</div>;
}

type TutorChatPanelProps = {
  fullscreen: boolean;
  organName: string;
  selectedPartName: string | null;
  messages: TutorChatMessage[];
  suggestedQuestions: string[];
  input: string;
  loading: boolean;
  error: string | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAskQuestion: (question: string) => void;
  onClear: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
};

function TutorChatPanel({
  fullscreen,
  organName,
  selectedPartName,
  messages,
  suggestedQuestions,
  input,
  loading,
  error,
  scrollContainerRef,
  onInputChange,
  onSubmit,
  onAskQuestion,
  onClear,
  onToggleFullscreen,
  onClose
}: TutorChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputId = fullscreen
    ? "diagram-tutor-question-fullscreen"
    : "diagram-tutor-question";

  useEffect(() => {
    inputRef.current?.focus();
  }, [fullscreen]);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="BioLens AI Tutor"
      className={
        fullscreen
          ? "fixed inset-0 z-[80] flex min-h-[100dvh] bg-[#02050b]/98 p-3 text-white backdrop-blur-2xl sm:p-6"
          : "absolute inset-0 z-20 flex min-h-0 flex-col bg-[#09111f] p-4 text-white shadow-[20px_0_60px_rgba(0,0,0,0.34)]"
      }
    >
      <div
        className={
          fullscreen
            ? "mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#09111f] p-4 shadow-[0_28px_100px_rgba(0,0,0,0.48)] sm:p-6"
            : "flex min-h-0 flex-1 flex-col"
        }
      >
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-pink-100/65">
                Groq AI Tutor
              </p>
              <span className="rounded-full border border-pink-300/20 bg-pink-500/[0.08] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-pink-100/75">
                Diagram-aware
              </span>
            </div>
            <h2 className="mt-2 truncate text-xl font-semibold tracking-[-0.02em] text-white">
              {selectedPartName ?? organName}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {selectedPartName
                ? `Answers are focused on ${selectedPartName} in this diagram.`
                : `Ask about the labelled structures in this ${organName.toLowerCase()} diagram.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {messages.length ? (
              <button
                type="button"
                onClick={onClear}
                className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]"
              >
                New chat
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="rounded-full border border-pink-300/25 bg-pink-500/[0.08] px-3 py-2 text-xs font-semibold text-pink-50 transition hover:bg-pink-500/[0.16]"
            >
              {fullscreen ? "Minimize" : "Full screen"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07]"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollContainerRef}
            data-lenis-prevent
            className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain py-5 pr-1 ${
              fullscreen ? "sm:px-2" : ""
            }`}
          >
            <div className={`mx-auto w-full space-y-4 ${fullscreen ? "max-w-3xl" : ""}`}>
              {messages.length ? (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`rounded-2xl border px-4 py-3.5 text-[0.95rem] leading-7 shadow-[0_12px_30px_rgba(2,6,23,0.16)] ${
                      message.role === "user"
                        ? "ml-auto max-w-[88%] border-pink-300/30 bg-pink-500/10 text-pink-50"
                        : "mr-auto max-w-[96%] border-white/10 bg-white/[0.045] text-white/85"
                    }`}
                  >
                    <p className="mb-2 text-[0.63rem] font-semibold uppercase tracking-[0.22em] text-white/40">
                      {message.role === "user" ? "You" : "Tutor"}
                    </p>
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <TutorMarkdown content={message.content} />
                    )}
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                  <p className="text-sm leading-7 text-white/70">
                    Ask a question and get a clear, study-friendly explanation of the current anatomy diagram.
                  </p>
                  <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                    Try a question
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => onAskQuestion(question)}
                        disabled={loading}
                        className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-left text-sm leading-6 text-white/80 transition hover:border-pink-300/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error ? (
                <div role="alert" className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3.5 py-3 text-sm leading-6 text-amber-50">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="mr-auto max-w-[96%] rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5" aria-live="polite">
                  <p className="text-[0.63rem] font-semibold uppercase tracking-[0.22em] text-white/40">Tutor</p>
                  <div className="mt-3 flex gap-1.5" aria-label="Tutor is thinking">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-100/70 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-100/70 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-100/70" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className={`shrink-0 border-t border-white/10 pt-3 ${
              fullscreen ? "pb-[env(safe-area-inset-bottom)] sm:px-2" : ""
            }`}
          >
            <div className={`mx-auto w-full ${fullscreen ? "max-w-3xl" : ""}`}>
              <label className="sr-only" htmlFor={inputId}>
                Ask the AI tutor a question
              </label>
              <textarea
                ref={inputRef}
                id={inputId}
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onAskQuestion(input);
                  }
                }}
                disabled={loading}
                maxLength={1_200}
                rows={fullscreen ? 3 : 2}
                placeholder={`Ask about ${selectedPartName ?? organName}...`}
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/55 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/50 focus:ring-2 focus:ring-pink-300/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[0.65rem] leading-4 text-white/35">
                  For learning only—not personal medical advice.
                </p>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Thinking…" : "Send"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
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
  const [isTutorFullscreen, setIsTutorFullscreen] = useState(false);
  const [viewReset, setViewReset] = useState(0);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<TutorChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatRequestRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatRequestRef.current?.abort();
    chatRequestRef.current = null;
    setSearchTerm("");
    setSelectedPartId(null);
    setHiddenPartIds(new Set());
    setExplode(false);
    setIsInfoOpen(false);
    setIsTutorOpen(false);
    setIsTutorFullscreen(false);
    setChatMessages([]);
    setChatInput("");
    setChatLoading(false);
    setChatError(null);
  }, [result.organName, result.sourceFileName, result.parts.length]);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    return () => {
      chatRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isTutorFullscreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTutorFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTutorFullscreen]);

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

  useEffect(() => {
    if (isTutorOpen) {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chatLoading, chatMessages.length, isTutorFullscreen, isTutorOpen]);

  async function sendTutorQuestion(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || chatLoading) {
      return;
    }

    const userMessage = createTutorChatMessage("user", question);
    const nextMessages = [...chatMessages, userMessage].slice(-8);
    const controller = new AbortController();

    chatRequestRef.current?.abort();
    chatRequestRef.current = controller;
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch("/api/diagram-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organSlug: activeOrgan.slug,
          selectedPartId: selectedPart?.id ?? null,
          messages: nextMessages.map(({ role, content }) => ({ role, content }))
        }),
        signal: controller.signal
      });
      const data = (await response.json().catch(() => null)) as {
        reply?: unknown;
        error?: unknown;
      } | null;
      const reply = data?.reply;

      if (!response.ok || typeof reply !== "string") {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "The AI tutor could not answer that right now."
        );
      }

      setChatMessages((previous) => [
        ...previous,
        createTutorChatMessage("assistant", reply.trim())
      ].slice(-10));
    } catch (error) {
      if (!controller.signal.aborted) {
        setChatError(
          error instanceof Error
            ? error.message
            : "The AI tutor could not answer that right now."
        );
      }
    } finally {
      if (chatRequestRef.current === controller) {
        chatRequestRef.current = null;
        setChatLoading(false);
      }
    }
  }

  function submitTutorQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendTutorQuestion(chatInput);
  }

  const suggestedTutorQuestions = tutorContent?.quizQuestions ?? [
    `What should I notice first in the ${result.organName.toLowerCase()}?`,
    `How do the major structures of the ${result.organName.toLowerCase()} work together?`
  ];

  function clearTutorChat() {
    chatRequestRef.current?.abort();
    chatRequestRef.current = null;
    setChatMessages([]);
    setChatInput("");
    setChatLoading(false);
    setChatError(null);
  }

  function closeTutorChat() {
    setIsTutorOpen(false);
    setIsTutorFullscreen(false);
  }

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

  const handleSelectPart = useCallback((partId: string | null) => {
    setSelectedPartId(partId);
    setIsInfoOpen(partId !== null);
  }, []);

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
                <section className="rounded-2xl border border-pink-300/20 bg-pink-500/[0.07] p-4">
                  <p className="text-xs font-medium text-pink-100/65">Selected structure</p>
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
                          className="w-full rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-left transition hover:border-pink-300/25 hover:bg-white/[0.06]"
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
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-300/20 bg-pink-500/10 text-lg text-pink-100">
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
              onClick={() => {
                setIsTutorFullscreen(false);
                setIsTutorOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-pink-50"
            >
              Ask AI Tutor
            </button>
          </div>

          {isTutorOpen && !isTutorFullscreen ? (
            <TutorChatPanel
              fullscreen={false}
              organName={result.organName}
              selectedPartName={selectedPart?.name ?? null}
              messages={chatMessages}
              suggestedQuestions={suggestedTutorQuestions}
              input={chatInput}
              loading={chatLoading}
              error={chatError}
              scrollContainerRef={chatScrollRef}
              onInputChange={setChatInput}
              onSubmit={submitTutorQuestion}
              onAskQuestion={(question) => void sendTutorQuestion(question)}
              onClear={clearTutorChat}
              onToggleFullscreen={() => setIsTutorFullscreen(true)}
              onClose={closeTutorChat}
            />
          ) : null}
        </aside>

        <main className="flex h-[58dvh] min-h-0 min-w-0 flex-col bg-[#050816] p-3 md:p-4 lg:h-auto">
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
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/45"
              />
            </label>
            <button
              type="button"
              onClick={() => setExplode((current) => !current)}
              aria-pressed={explode}
              title="Moves numbered markers outward while keeping their connector on the exact anatomy point."
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                explode ? "border-pink-300/35 bg-pink-500/15 text-pink-50" : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
              }`}
            >
              Spread labels
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

  const fullScreenTutorTree = isTutorOpen && isTutorFullscreen ? (
    <TutorChatPanel
      fullscreen
      organName={result.organName}
      selectedPartName={selectedPart?.name ?? null}
      messages={chatMessages}
      suggestedQuestions={suggestedTutorQuestions}
      input={chatInput}
      loading={chatLoading}
      error={chatError}
      scrollContainerRef={chatScrollRef}
      onInputChange={setChatInput}
      onSubmit={submitTutorQuestion}
      onAskQuestion={(question) => void sendTutorQuestion(question)}
      onClear={clearTutorChat}
      onToggleFullscreen={() => setIsTutorFullscreen(false)}
      onClose={closeTutorChat}
    />
  ) : null;

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
              <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-pink-100">
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
                className="w-full rounded-full border border-white/10 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/40 focus:bg-slate-950/80"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExplode((current) => !current)}
                aria-pressed={explode}
                title="Moves numbered markers outward while keeping their connector on the exact anatomy point."
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  explode
                    ? "border-pink-300/40 bg-pink-500/15 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
                }`}
              >
                Spread labels
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

          <div className="relative mt-5 min-h-0 flex-1">
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

            <AnimatePresence initial={false}>
            {isInfoOpen && selectedPart ? (
            <motion.aside
              initial={{ opacity: 0, x: 28, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 20, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
              className={`relative z-20 mt-4 min-h-0 space-y-4 overflow-y-auto pr-1 xl:absolute xl:bottom-0 xl:right-0 xl:top-0 xl:mt-0 xl:rounded-[1.8rem] xl:border xl:border-white/10 xl:bg-[#070b17]/92 xl:p-4 xl:shadow-[-28px_18px_70px_rgba(0,0,0,0.32)] xl:backdrop-blur-xl ${fullscreen ? "xl:w-[380px]" : "xl:w-[340px]"}`}
            >
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
                      Study notes
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
                    {tutorLoading ? "Loading" : "Atlas notes"}
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
                              ? "border-pink-300/30 bg-pink-500/12"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <button
                            type="button"
                          onClick={() => handleSelectPart(part.id)}
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
            </motion.aside>
            ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );

  if (fullscreen && portalTarget) {
    return createPortal(
      <>
        {immersiveTree}
        {fullScreenTutorTree}
      </>,
      portalTarget
    );
  }

  return (
    <>
      {viewerTree}
      {fullScreenTutorTree}
    </>
  );
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
  const [customLabelLayouts, setCustomLabelLayouts] = useState<
    Record<string, LabelLayout>
  >({});
  const customLabelLayoutsRef = useRef<Record<string, LabelLayout>>({});
  const [showStructureList, setShowStructureList] = useState(false);
  const [isLabelEditorOpen, setIsLabelEditorOpen] = useState(false);
  const [isAddingCustomLabel, setIsAddingCustomLabel] = useState(false);
  const [draftLabelPosition, setDraftLabelPosition] = useState<
    [number, number, number] | null
  >(null);
  const [draftLabelName, setDraftLabelName] = useState("");
  const [labelEditorError, setLabelEditorError] = useState<string | null>(null);
  const [customLabelState, setCustomLabelState] = useState<CustomLabelState>({
    storageKey: "",
    labels: []
  });
  const [projectLabelSaveState, setProjectLabelSaveState] =
    useState<ProjectLabelSaveState>("idle");
  const [referenceModelState, setReferenceModelState] =
    useState<ReferenceModelState>(() =>
      result.atlasMetadata?.referenceAssetUrl ? "loading" : "fallback"
    );
  const customLabelModelKey = getCustomLabelModelKey(result);
  const customLabelStorageKey = getCustomLabelStorageKey(customLabelModelKey);
  const customLabels =
    customLabelState.storageKey === customLabelStorageKey
      ? customLabelState.labels
      : [];
  const draftLabel = draftLabelPosition
    ? {
        id: "draft-custom-label",
        name: draftLabelName.trim() || "New label",
        position: draftLabelPosition
      }
    : null;
  const displayCustomLabels = draftLabel
    ? [...customLabels, draftLabel]
    : customLabels;
  const customLabelsRef = useRef<CustomLabel[]>(displayCustomLabels);
  const projectSaveRequestRef = useRef(0);
  const labelEditorRef = useRef({ isAddingCustomLabel });
  const interactionRef = useRef({
    searchTerm,
    selectedPartId,
    hiddenPartIds,
    explode,
    isAddingCustomLabel
  });

  useEffect(() => {
    customLabelsRef.current = displayCustomLabels;
  }, [displayCustomLabels]);

  useEffect(() => {
    labelEditorRef.current = { isAddingCustomLabel };
  }, [isAddingCustomLabel]);

  useEffect(() => {
    interactionRef.current = {
      searchTerm,
      selectedPartId,
      hiddenPartIds,
      explode,
      isAddingCustomLabel
    };
  }, [searchTerm, selectedPartId, hiddenPartIds, explode, isAddingCustomLabel]);

  useEffect(() => {
    projectSaveRequestRef.current += 1;
    const projectLabels = getProjectCustomLabels(customLabelModelKey);
    const localLabels = readCustomLabels(customLabelStorageKey);
    setCustomLabelState({
      storageKey: customLabelStorageKey,
      // The committed project file is the source of truth for everyone who
      // downloads the repository. Local storage only carries labels when a
      // model has not been published into that file yet.
      labels: projectLabels.length ? projectLabels : localLabels
    });
    setProjectLabelSaveState(projectLabels.length ? "saved" : "idle");
    setIsLabelEditorOpen(false);
    setIsAddingCustomLabel(false);
    setDraftLabelPosition(null);
    setDraftLabelName("");
    setLabelEditorError(null);
    customLabelLayoutsRef.current = {};
    setCustomLabelLayouts({});
  }, [customLabelModelKey, customLabelStorageKey]);

  useEffect(() => {
    if (customLabelState.storageKey !== customLabelStorageKey) {
      return;
    }

    try {
      window.localStorage.setItem(
        customLabelStorageKey,
        JSON.stringify(customLabelState.labels)
      );
    } catch {
      // The editor continues for the current visit even if browser storage is
      // unavailable (for example, in a private or storage-restricted tab).
    }
  }, [customLabelState, customLabelStorageKey]);

  useEffect(() => {
    setReferenceModelState(
      result.atlasMetadata?.referenceAssetUrl ? "loading" : "fallback"
    );
    setShowStructureList(false);
  }, [result.atlasMetadata?.referenceAssetUrl, result.sourceFileName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const viewport = container;

    labelLayoutsRef.current = {};
    setLabelLayouts({});
    customLabelLayoutsRef.current = {};
    setCustomLabelLayouts({});

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050816");

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
    // Preserve the source GLB's authored albedo rather than applying a
    // cinematic remap that can desaturate or pink-wash medical textures.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
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
    const referenceModelRoot = new THREE.Group();
    root.add(referenceModelRoot);
    const modelWillLoad = Boolean(result.atlasMetadata?.referenceAssetUrl);

    // Keep the environment dark while lighting the authored PBR materials with
    // neutral white light. There is deliberately no coloured wash, bloom mesh,
    // or post-processing tint applied to the supplied anatomy assets.
    const ambient = new THREE.AmbientLight(0xffffff, modelWillLoad ? 0.01 : 0.46);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, modelWillLoad ? 0.01 : 1.6);
    keyLight.position.set(4.4, 6, 8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, modelWillLoad ? 0.01 : 0.38);
    fillLight.position.set(-5, 2.4, 3.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, modelWillLoad ? 0.01 : 0.2);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    const visuals = buildPartVisuals(result);

    for (const visual of visuals) {
      root.add(visual.object);
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
    const hasReferenceAssets = referenceAssetUrls.length > 0;
    const referenceAnchors = new Map<
      string,
      InstanceType<typeof THREE.Object3D>
    >();
    const referencePartMeshes = new Map<
      string,
      InstanceType<typeof THREE.Mesh>[]
    >();
    const referenceMeshes: ReferenceMesh[] = [];
    let referenceModelLoaded = false;
    let referenceModelPending = referenceAssetUrls.length > 0;
    let modelReveal = modelWillLoad ? 0 : 1;
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
          const modelLocalBounds = new THREE.Box3().setFromObject(assembledReferenceModel);
          referenceModelRoot.add(assembledReferenceModel);
          root.updateMatrixWorld(true);

          assembledReferenceModel.traverse((object: InstanceType<typeof THREE.Object3D>) => {
            const candidate = object as InstanceType<typeof THREE.Mesh>;
            if (!candidate.isMesh) {
              return;
            }

            const part = findPartForReferenceObject(object, result.parts);
            candidate.userData.partId = part?.id;

            if (part) {
              const meshes = referencePartMeshes.get(part.id) ?? [];
              meshes.push(candidate);
              referencePartMeshes.set(part.id, meshes);
            }

            // Leave every authored material and texture exactly as supplied by
            // the GLB. The renderer may toggle whole meshes for an explicit
            // hide action, but it never recolours, fades, or clones the model.
            referenceMeshes.push({
              mesh: candidate,
              partId: part?.id ?? null
            });
          });

          // Raycast every study structure to an exposed surface. Matched GLB
          // meshes get their own surface point; generic meshes use the full
          // model. This avoids labels being anchored at a mesh origin hidden
          // inside the organ.
          root.updateMatrixWorld(true);
          const modelBounds = new THREE.Box3().setFromObject(assembledReferenceModel);
          const modelCenter = modelBounds.getCenter(new THREE.Vector3());
          const modelSize = modelBounds.getSize(new THREE.Vector3());
          const modelRadius = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.01);
          const anchorRaycaster = new THREE.Raycaster();

          for (const visual of visuals) {
            const fallbackDirection = visual.placement.basePosition
              .clone()
              .sub(center)
              .normalize();
            if (fallbackDirection.lengthSq() < 0.001) {
              fallbackDirection.set(0, 0.2, 1).normalize();
            }

            const targetPoint = getReferenceAnchorTarget(
              result,
              visual.part.id,
              modelLocalBounds,
              modelCenter,
              fallbackDirection
            );
            const direction = targetPoint.clone().sub(modelCenter).normalize();

            const origin = modelCenter.clone().addScaledVector(direction, modelRadius * 2.2);
            anchorRaycaster.set(origin, direction.clone().negate());
            const anchorTargets = referencePartMeshes.get(visual.part.id);
            const useNearestSurface = shouldUseNearestSurfaceAnchor(
              result,
              visual.part.id
            );
            const hit = useNearestSurface
              ? undefined
              : (anchorTargets
                  ? anchorRaycaster.intersectObjects(anchorTargets, true)[0]
                  : undefined) ??
                anchorRaycaster.intersectObject(assembledReferenceModel, true)[0];
            const anchorPoint = useNearestSurface
              ? findNearestReferenceSurfacePoint(assembledReferenceModel, targetPoint)
              : hit?.point ??
                findNearestReferenceSurfacePoint(assembledReferenceModel, targetPoint);
            if (!anchorPoint) {
              continue;
            }

            const anchor = new THREE.Object3D();
            // Raycaster hit points are world-space coordinates. Convert them
            // before parenting so the marker remains glued to the surface as
            // the root rotates, instead of drifting in space.
            anchor.position.copy(referenceModelRoot.worldToLocal(anchorPoint.clone()));
            anchor.userData.partId = visual.part.id;
            referenceModelRoot.add(anchor);
            referenceAnchors.set(visual.part.id, anchor);
          }

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

    let labelPlacementPointer:
      | { pointerId: number; x: number; y: number }
      | null = null;

    const setPointerFromEvent = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (labelEditorRef.current.isAddingCustomLabel) {
        labelPlacementPointer = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY
        };
        return;
      }

      setPointerFromEvent(event);

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

    const handlePointerUp = (event: PointerEvent) => {
      const start = labelPlacementPointer;
      labelPlacementPointer = null;

      if (
        !start ||
        start.pointerId !== event.pointerId ||
        !labelEditorRef.current.isAddingCustomLabel
      ) {
        return;
      }

      // Keep an orbit/drag from accidentally becoming a label placement.
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) {
        return;
      }

      if (!referenceModelLoaded) {
        return;
      }

      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(referenceModelRoot, true)[0];

      if (!hit) {
        return;
      }

      // Persist a position in the model's local coordinate system. This is
      // what makes a custom label follow the model, rather than stay in the
      // air after the user orbits the camera.
      const localPosition = referenceModelRoot.worldToLocal(hit.point.clone());
      setDraftLabelPosition([localPosition.x, localPosition.y, localPosition.z]);
      setDraftLabelName("");
      setLabelEditorError(null);
      setIsAddingCustomLabel(false);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    let explodeFactor = explode ? 1 : 0;
    let animationFrame = 0;
    let lastLabelUpdate = 0;
    const surfaceRaycaster = new THREE.Raycaster();
    const tempAnchorPosition = new THREE.Vector3();
    const tempCustomAnchorPosition = new THREE.Vector3();
    const tempProjectedPosition = new THREE.Vector3();
    const tempLabelOffset = new THREE.Vector3();

    function updateLabels() {
      if (performance.now() - lastLabelUpdate < 32) {
        return;
      }

      const nextLayouts: Record<string, LabelLayout> = {};
      const candidates: MarkerCandidate[] = [];
      const nextCustomLayouts: Record<string, LabelLayout> = {};
      const customCandidates: MarkerCandidate[] = [];
      const currentCustomLabels = customLabelsRef.current;
      const state = interactionRef.current;
      const currentSearchTerm = state.searchTerm.toLowerCase().trim();
      const hiddenLayout = (): LabelLayout => ({
        x: 0,
        y: 0,
        markerX: 0,
        markerY: 0,
        visible: false
      });

      // Atlas labels belong to the real model only. If its GLB is still
      // loading or cannot load, keep markers hidden rather than showing
      // anchors from the synthetic study-map fallback.
      if (hasReferenceAssets && !referenceModelLoaded) {
        for (const visual of visuals) {
          nextLayouts[visual.part.id] = hiddenLayout();
        }
        for (const label of currentCustomLabels) {
          nextCustomLayouts[label.id] = hiddenLayout();
        }
        if (labelLayoutsChanged(labelLayoutsRef.current, nextLayouts)) {
          labelLayoutsRef.current = nextLayouts;
          setLabelLayouts(nextLayouts);
        }
        if (labelLayoutsChanged(customLabelLayoutsRef.current, nextCustomLayouts)) {
          customLabelLayoutsRef.current = nextCustomLayouts;
          setCustomLabelLayouts(nextCustomLayouts);
        }
        lastLabelUpdate = performance.now();
        return;
      }

      for (const visual of visuals) {
        const hidden = state.hiddenPartIds.has(visual.part.id);
        const matches =
          !currentSearchTerm || matchesSearch(visual.part, currentSearchTerm);

        if (hidden || !matches) {
          nextLayouts[visual.part.id] = hiddenLayout();
          continue;
        }

        const referenceAnchor = referenceAnchors.get(visual.part.id);
        (referenceAnchor ?? visual.object).getWorldPosition(tempAnchorPosition);
        if (referenceAnchor) {
          tempLabelOffset.set(0, 0, 0);
        } else {
          tempLabelOffset.copy(visual.placement.labelOffset).applyQuaternion(root.quaternion);
        }
        tempAnchorPosition.add(tempLabelOffset);
        tempProjectedPosition.copy(tempAnchorPosition).project(camera);

        const visible =
          tempProjectedPosition.z > -1 &&
          tempProjectedPosition.z < 1 &&
          tempProjectedPosition.x >= -1.05 &&
          tempProjectedPosition.x <= 1.05 &&
          tempProjectedPosition.y >= -1.05 &&
          tempProjectedPosition.y <= 1.05;

        if (!visible) {
          nextLayouts[visual.part.id] = hiddenLayout();
          continue;
        }

        // A numbered marker belongs to the visible model surface. Hide it after the
        // surface rotates behind the organ rather than projecting it through
        // the mesh onto an unrelated front-facing point.
        let obscured = false;
        if (referenceModelLoaded) {
          const cameraToAnchor = tempAnchorPosition.clone().sub(camera.position);
          const anchorDistance = cameraToAnchor.length();
          surfaceRaycaster.set(camera.position, cameraToAnchor.normalize());
          const nearestHit = surfaceRaycaster.intersectObject(referenceModelRoot, true)[0];
          obscured = Boolean(
            nearestHit && nearestHit.distance < anchorDistance - 0.035
          );
        }

        if (obscured) {
          nextLayouts[visual.part.id] = hiddenLayout();
          continue;
        }

        candidates.push({
          id: visual.part.id,
          x: ((tempProjectedPosition.x + 1) * 0.5) * viewport.clientWidth,
          y: ((1 - tempProjectedPosition.y) * 0.5) * viewport.clientHeight
        });
      }

      const arrangedMarkers = arrangeNumberMarkers(
        candidates,
        viewport.clientWidth,
        viewport.clientHeight,
        state.explode
      );

      for (const candidate of candidates) {
        const placement = arrangedMarkers.get(candidate.id);

        if (!placement) {
          nextLayouts[candidate.id] = hiddenLayout();
          continue;
        }

        nextLayouts[candidate.id] = {
          x: candidate.x,
          y: candidate.y,
          ...placement,
          visible: true
        };
      }

      if (labelLayoutsChanged(labelLayoutsRef.current, nextLayouts)) {
        labelLayoutsRef.current = nextLayouts;
        setLabelLayouts(nextLayouts);
      }

      for (const label of currentCustomLabels) {
        tempCustomAnchorPosition.set(...label.position);
        (referenceModelLoaded ? referenceModelRoot : root).localToWorld(
          tempCustomAnchorPosition
        );
        tempProjectedPosition.copy(tempCustomAnchorPosition).project(camera);

        const visible =
          tempProjectedPosition.z > -1 &&
          tempProjectedPosition.z < 1 &&
          tempProjectedPosition.x >= -1.05 &&
          tempProjectedPosition.x <= 1.05 &&
          tempProjectedPosition.y >= -1.05 &&
          tempProjectedPosition.y <= 1.05;

        if (!visible) {
          nextCustomLayouts[label.id] = hiddenLayout();
          continue;
        }

        let obscured = false;
        if (referenceModelLoaded) {
          const cameraToAnchor = tempCustomAnchorPosition
            .clone()
            .sub(camera.position);
          const anchorDistance = cameraToAnchor.length();
          surfaceRaycaster.set(camera.position, cameraToAnchor.normalize());
          const nearestHit = surfaceRaycaster.intersectObject(referenceModelRoot, true)[0];
          obscured = Boolean(
            nearestHit && nearestHit.distance < anchorDistance - 0.035
          );
        }

        if (obscured) {
          nextCustomLayouts[label.id] = hiddenLayout();
          continue;
        }

        customCandidates.push({
          id: label.id,
          x: ((tempProjectedPosition.x + 1) * 0.5) * viewport.clientWidth,
          y: ((1 - tempProjectedPosition.y) * 0.5) * viewport.clientHeight
        });
      }

      const arrangedCustomMarkers = arrangeNumberMarkers(
        customCandidates,
        viewport.clientWidth,
        viewport.clientHeight,
        state.explode
      );

      for (const candidate of customCandidates) {
        const placement = arrangedCustomMarkers.get(candidate.id);

        nextCustomLayouts[candidate.id] = placement
          ? {
              x: candidate.x,
              y: candidate.y,
              ...placement,
              visible: true
            }
          : hiddenLayout();
      }

      if (labelLayoutsChanged(customLabelLayoutsRef.current, nextCustomLayouts)) {
        customLabelLayoutsRef.current = nextCustomLayouts;
        setCustomLabelLayouts(nextCustomLayouts);
      }
      lastLabelUpdate = performance.now();
    }

    function animate() {
      const state = interactionRef.current;
      renderer.domElement.style.cursor = state.isAddingCustomLabel ? "crosshair" : "grab";
      explodeFactor = THREE.MathUtils.lerp(explodeFactor, state.explode ? 1 : 0, 0.08);
      const revealTarget = referenceModelLoaded || !modelWillLoad ? 1 : 0;
      modelReveal = THREE.MathUtils.lerp(modelReveal, revealTarget, 0.065);
      referenceModelRoot.scale.setScalar(0.96 + modelReveal * 0.04);
      ambient.intensity = 0.46 * modelReveal;
      keyLight.intensity = 1.6 * modelReveal;
      fillLight.intensity = 0.38 * modelReveal;
      rimLight.intensity = 0.2 * modelReveal;

      for (const visual of visuals) {
        const hidden = state.hiddenPartIds.has(visual.part.id);
        const selected = state.selectedPartId === visual.part.id;
        const searchMatch = matchesSearch(visual.part, state.searchTerm);
        const targetOpacity = hidden ? 0.06 : searchMatch ? 0.96 : 0.26;

        visual.object.visible =
          !hasReferenceAssets && !referenceModelPending && !hidden;
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
          referenceMesh.mesh.visible = !hidden;
        }
      }

      controls.update();
      updateLabels();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    }

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      controls.dispose();
      renderer.dispose();
      disposeObject3D(scene);
      viewport.removeChild(renderer.domElement);
    };
  }, [result, onSelectPart, resetToken]);

  const visibleLabels = result.parts.filter(
    (part) => !hiddenPartIds.has(part.id) && matchesSearch(part, searchTerm)
  );
  const selectedPart = result.parts.find((part) => part.id === selectedPartId) ?? null;
  const visibleMarkerCount = visibleLabels.filter(
    (part) => labelLayouts[part.id]?.visible
  ).length;
  const selectedLabelIsBehind = Boolean(
    selectedPartId && !labelLayouts[selectedPartId]?.visible
  );
  const isUsingCustomLabels =
    isLabelEditorOpen || customLabels.length > 0 || Boolean(draftLabel);
  const showGeneratedLabels = !isUsingCustomLabels;
  const visibleCustomLabelCount = displayCustomLabels.filter(
    (label) => customLabelLayouts[label.id]?.visible
  ).length;

  async function publishCustomLabels(labels: CustomLabel[]) {
    const requestId = projectSaveRequestRef.current + 1;
    projectSaveRequestRef.current = requestId;
    setProjectLabelSaveState("saving");

    try {
      const response = await fetch("/api/project-labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelKey: customLabelModelKey, labels })
      });

      if (!response.ok) {
        throw new Error("Project labels could not be saved.");
      }

      if (projectSaveRequestRef.current === requestId) {
        setProjectLabelSaveState("saved");
      }
    } catch {
      if (projectSaveRequestRef.current === requestId) {
        setProjectLabelSaveState("local-only");
      }
    }
  }

  function startAddingCustomLabel() {
    if (referenceModelState !== "reference") {
      setLabelEditorError(
        referenceModelState === "loading"
          ? "Wait for the anatomy model to finish loading, then place your label."
          : "This anatomy model is unavailable, so it cannot accept a saved surface label."
      );
      return;
    }

    setDraftLabelPosition(null);
    setDraftLabelName("");
    setLabelEditorError(null);
    setIsAddingCustomLabel(true);
  }

  function cancelCustomLabelDraft() {
    setIsAddingCustomLabel(false);
    setDraftLabelPosition(null);
    setDraftLabelName("");
    setLabelEditorError(null);
  }

  function saveCustomLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftLabelName.trim();

    if (!draftLabelPosition) {
      setLabelEditorError("Click a point on the model before saving the label.");
      return;
    }

    if (!name) {
      setLabelEditorError("Enter a label name before saving.");
      return;
    }

    const nextLabels = [
      ...customLabels,
      {
        id: createCustomLabelId(),
        name,
        position: draftLabelPosition
      }
    ];
    setCustomLabelState({ storageKey: customLabelStorageKey, labels: nextLabels });
    void publishCustomLabels(nextLabels);
    setDraftLabelPosition(null);
    setDraftLabelName("");
    setLabelEditorError(null);
    setIsAddingCustomLabel(false);
  }

  function removeCustomLabel(labelId: string) {
    const nextLabels = customLabels.filter((label) => label.id !== labelId);
    setCustomLabelState({ storageKey: customLabelStorageKey, labels: nextLabels });
    void publishCustomLabels(nextLabels);
  }

  return (
    <div
      data-lenis-prevent
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
        Hover a number
      </div>

      <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/60 backdrop-blur">
        {isLoading
          ? "Analyzing upload"
          : referenceModelState === "reference"
            ? "Anatomy model ready"
          : referenceModelState === "loading"
              ? "Loading anatomy model"
              : "Anatomy model unavailable"}
      </div>

      <div ref={containerRef} className="absolute inset-0" />

      <button
        type="button"
        aria-expanded={isLabelEditorOpen}
        onClick={() => {
          if (isLabelEditorOpen) {
            cancelCustomLabelDraft();
            setIsLabelEditorOpen(false);
          } else {
            setIsLabelEditorOpen(true);
            setLabelEditorError(null);
          }
        }}
        className={`absolute right-4 top-16 z-20 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] backdrop-blur transition ${
          isLabelEditorOpen
            ? "border-pink-200/60 bg-pink-400/16 text-pink-50"
            : "border-pink-300/25 bg-slate-950/78 text-pink-50 hover:border-pink-200/55 hover:bg-slate-900"
        }`}
      >
        {isLabelEditorOpen ? "Done editing" : "Edit labels"}
      </button>

      {isLabelEditorOpen ? (
        <section className="absolute right-4 top-28 z-20 w-[min(19rem,90vw)] overflow-hidden rounded-2xl border border-pink-300/20 bg-slate-950/95 p-3 shadow-[0_20px_54px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3 px-1 py-1">
            <div>
              <p className="text-[0.63rem] font-semibold uppercase tracking-[0.2em] text-pink-100/60">
                Edit labels
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                Place your own anatomical markers
              </p>
            </div>
            <span className="rounded-full border border-pink-300/20 bg-pink-400/10 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-pink-100/80">
              {customLabels.length} saved
            </span>
          </div>

          <p className="mt-3 px-1 text-xs leading-5 text-white/50">
            Each label uses the exact point you click on the real 3D model and replaces the suggested markers for this diagram.
          </p>

          <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${
            projectLabelSaveState === "local-only"
              ? "border-amber-300/20 bg-amber-500/[0.1] text-amber-50"
              : "border-emerald-300/15 bg-emerald-500/[0.08] text-emerald-50/85"
          }`}>
            {projectLabelSaveState === "saving"
              ? "Saving labels into the project file…"
              : projectLabelSaveState === "saved"
                ? "Saved to data/custom-labels.json. Commit and push this file to share the labels with everyone."
                : projectLabelSaveState === "local-only"
                  ? "Saved only in this browser. Run the project locally with npm run dev to publish labels into the repository."
                  : "New labels saved while running locally will be added to the project file for GitHub."}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={startAddingCustomLabel}
              disabled={isAddingCustomLabel}
              className="rounded-xl bg-pink-200 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-pink-100 disabled:cursor-default disabled:opacity-70"
            >
              {isAddingCustomLabel ? "Click model…" : "Add label"}
            </button>
            <button
              type="button"
              onClick={cancelCustomLabelDraft}
              disabled={!isAddingCustomLabel}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-default disabled:opacity-35"
            >
              Cancel
            </button>
          </div>

          {isAddingCustomLabel ? (
            <div className="mt-3 rounded-xl border border-pink-300/20 bg-pink-500/[0.08] px-3 py-2.5 text-xs leading-5 text-pink-50/85">
              Click the exact anatomical point you want to label. Dragging still orbits the model and will not place a marker.
            </div>
          ) : null}

          {labelEditorError ? (
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/[0.1] px-3 py-2.5 text-xs leading-5 text-amber-50">
              {labelEditorError}
            </div>
          ) : null}

          {customLabels.length ? (
            <div className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
              {customLabels.map((label, index) => (
                <div
                  key={label.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-2"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-pink-300/35 text-[0.58rem] font-bold text-pink-50">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">
                    {label.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustomLabel(label.id)}
                    className="rounded-lg px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/45 transition hover:bg-rose-500/15 hover:text-rose-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs leading-5 text-white/45">
              No custom labels yet. Choose Add label, click the model, then give the point a name.
            </p>
          )}
        </section>
      ) : null}

      {draftLabelPosition ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={saveCustomLabel}
            className="w-full max-w-sm rounded-[1.5rem] border border-pink-300/30 bg-slate-950/95 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.64)]"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-pink-100/65">
              New custom label
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Name this point</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Saving locally also writes this point into the project label file, ready to commit and share with everyone who downloads the repository.
            </p>
            <label className="mt-4 block">
              <span className="sr-only">Label name</span>
              <input
                autoFocus
                value={draftLabelName}
                onChange={(event) => {
                  setDraftLabelName(event.target.value);
                  setLabelEditorError(null);
                }}
                placeholder="e.g. Aorta"
                maxLength={80}
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/55"
              />
            </label>
            {labelEditorError ? (
              <p className="mt-3 text-xs leading-5 text-amber-100">{labelEditorError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelCustomLabelDraft}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-pink-200 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-pink-100"
              >
                Save label
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={showStructureList}
        onClick={() => setShowStructureList((current) => !current)}
        className="absolute left-4 top-16 z-20 inline-flex items-center gap-2 rounded-full border border-pink-300/25 bg-slate-950/78 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-pink-50 backdrop-blur transition hover:border-pink-200/55 hover:bg-slate-900"
      >
        {isUsingCustomLabels ? "My labels" : "Structures"}
        <span className="rounded-full bg-pink-300/12 px-1.5 py-0.5 text-[0.58rem] text-pink-100/80">
          {isUsingCustomLabels ? customLabels.length : visibleLabels.length}
        </span>
      </button>

      {showStructureList ? (
        <section className="absolute left-4 top-28 z-20 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/94 p-2 shadow-[0_20px_54px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-[0.63rem] font-semibold uppercase tracking-[0.2em] text-white/45">
                {isUsingCustomLabels ? "Your labels" : "Numbered labels"}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {isUsingCustomLabels
                  ? "Saved on this 3D model"
                  : "Hover a number to identify it"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close structure list"
              onClick={() => setShowStructureList(false)}
              className="rounded-lg px-2 py-1 text-lg leading-none text-white/45 transition hover:bg-white/[0.07] hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="max-h-[min(22rem,calc(100dvh-14rem))] space-y-1 overflow-y-auto pr-1">
            {isUsingCustomLabels ? customLabels.map((label, index) => {
              const linkedPartId = getCustomLabelPartId(label, result);
              const selected = Boolean(
                linkedPartId && linkedPartId === selectedPartId
              );

              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    if (linkedPartId) {
                      onSelectPart(linkedPartId);
                    } else {
                      setIsLabelEditorOpen(true);
                    }
                    setShowStructureList(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? "bg-pink-400/14 text-white"
                      : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-pink-300/35 text-[0.58rem] font-bold text-pink-50">
                    {index + 1}
                  </span>
                  <span className="truncate">{label.name}</span>
                </button>
              );
            }) : visibleLabels.map((part) => {
              const selected = selectedPartId === part.id;
              const number = getPartNumber(part.id, result);

              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => {
                    onSelectPart(part.id);
                    setShowStructureList(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? "bg-pink-400/14 text-white"
                      : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/25 text-[0.58rem] font-bold text-white/80">
                    {number}
                  </span>
                  <span className="truncate">{part.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {referenceModelState === "loading" && !isLoading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-[1.6rem] border border-pink-300/20 bg-slate-950/75 px-6 py-5 text-center shadow-[0_18px_54px_rgba(2,6,23,0.44)] backdrop-blur-xl">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-pink-200/20 border-t-pink-200" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.26em] text-pink-50">
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
          {showGeneratedLabels ? visibleLabels.map((part) => {
            const layout = labelLayouts[part.id];

            if (
              !layout?.visible ||
              Math.hypot(layout.markerX - layout.x, layout.markerY - layout.y) < 1
            ) {
              return null;
            }

            return (
              <g key={`marker-leader-${part.id}`}>
                <line
                  x1={layout.x}
                  y1={layout.y}
                  x2={layout.markerX}
                  y2={layout.markerY}
                  stroke={partColor(part.id, result)}
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.8"
                />
                <circle
                  cx={layout.x}
                  cy={layout.y}
                  r="2"
                  fill={partColor(part.id, result)}
                />
              </g>
            );
          }) : null}

          {isUsingCustomLabels ? displayCustomLabels.map((label) => {
            const layout = customLabelLayouts[label.id];

            if (
              !layout?.visible ||
              Math.hypot(layout.markerX - layout.x, layout.markerY - layout.y) < 1
            ) {
              return null;
            }

            return (
              <g key={`custom-marker-leader-${label.id}`}>
                <line
                  x1={layout.x}
                  y1={layout.y}
                  x2={layout.markerX}
                  y2={layout.markerY}
                  stroke="#f9a8d4"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <circle cx={layout.x} cy={layout.y} r="2" fill="#f9a8d4" />
              </g>
            );
          }) : null}
        </svg>

        {showGeneratedLabels ? visibleLabels.map((part) => {
          const layout = labelLayouts[part.id];
          const selected = selectedPartId === part.id;
          const number = getPartNumber(part.id, result);

          if (!layout?.visible) {
            return null;
          }

          return (
            <div
              key={part.id}
              className="absolute inset-0"
            >
              <button
                type="button"
                onClick={() => onSelectPart(part.id)}
                aria-label={`${number}. ${part.name}`}
                className={`group motion-label pointer-events-auto absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-slate-950/92 text-[0.58rem] font-bold tabular-nums text-white shadow-[0_4px_12px_rgba(2,6,23,0.46)] backdrop-blur transition hover:scale-110 hover:bg-slate-900 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  selected
                    ? "border-pink-100 bg-pink-400/20"
                    : "border-white/60"
                }`}
                style={{
                  left: layout.markerX,
                  top: layout.markerY,
                  borderColor: selected ? undefined : partColor(part.id, result)
                }}
              >
                {number}
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[min(15rem,calc(100vw_-_2rem))] -translate-x-1/2 rounded-lg border border-white/15 bg-slate-950/95 px-2.5 py-1.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white opacity-0 shadow-[0_10px_24px_rgba(2,6,23,0.46)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="mr-1.5 text-white/45">{number}.</span>
                  {part.name}
                </span>
              </button>
            </div>
          );
        }) : null}

        {isUsingCustomLabels ? displayCustomLabels.map((label, index) => {
          const layout = customLabelLayouts[label.id];
          const isDraft = label.id === "draft-custom-label";
          const linkedPartId = isDraft ? null : getCustomLabelPartId(label, result);
          const selected = Boolean(
            linkedPartId && linkedPartId === selectedPartId
          );
          const number = index + 1;

          if (!layout?.visible) {
            return null;
          }

          return (
            <div key={label.id} className="absolute inset-0">
              <button
                type="button"
                onClick={() => {
                  if (linkedPartId) {
                    onSelectPart(linkedPartId);
                  } else {
                    setIsLabelEditorOpen(true);
                  }
                }}
                aria-label={`Custom label ${number}. ${label.name}`}
                className={`group motion-label pointer-events-auto absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-slate-950/95 text-[0.58rem] font-bold tabular-nums text-pink-50 shadow-[0_4px_12px_rgba(2,6,23,0.46)] backdrop-blur transition hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  isDraft
                    ? "border-amber-200 border-dashed text-amber-50"
                    : selected
                      ? "border-pink-100 bg-pink-400/25"
                      : "border-pink-300/90"
                }`}
                style={{ left: layout.markerX, top: layout.markerY }}
              >
                {number}
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[min(15rem,calc(100vw_-_2rem))] -translate-x-1/2 rounded-lg border border-pink-300/20 bg-slate-950/95 px-2.5 py-1.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-pink-50 opacity-0 shadow-[0_10px_24px_rgba(2,6,23,0.46)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="mr-1.5 text-pink-100/45">{number}.</span>
                  {isDraft ? "Name this point" : label.name}
                </span>
              </button>
            </div>
          );
        }) : null}
      </div>

      {showGeneratedLabels && selectedLabelIsBehind && selectedPart ? (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full border border-pink-300/20 bg-slate-950/80 px-4 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-pink-50/80 backdrop-blur">
          Rotate to reveal {selectedPart.name}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex items-center justify-between gap-3">
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/55 backdrop-blur">
          {isUsingCustomLabels
            ? `${visibleCustomLabelCount} custom markers`
            : `${visibleMarkerCount} visible markers`}
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/55 backdrop-blur">
          {referenceModelState === "reference"
            ? result.atlasMetadata?.referenceAttribution ?? "Reference anatomy"
            : referenceModelState === "loading"
              ? "Loading real anatomy model"
              : "The supplied anatomy model could not be loaded"}
        </div>
      </div>
    </div>
  );
}

function partColor(partId: string, result: VisionExtractionResult) {
  const index = result.parts.findIndex((part) => part.id === partId);
  return palette[(index < 0 ? 0 : index) % palette.length];
}

function getPartNumber(partId: string, result: VisionExtractionResult) {
  const index = result.parts.findIndex((part) => part.id === partId);
  return index < 0 ? 0 : index + 1;
}

export { AnatomyViewer };
