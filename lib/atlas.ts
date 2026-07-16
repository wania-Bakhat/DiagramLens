import type {
  VisionAtlasMetadata,
  VisionExtractionResult,
  VisionPart,
  VisionRelationship
} from "./vision/types";

export type AtlasCategory =
  | "circulatory"
  | "respiratory"
  | "nervous"
  | "urinary"
  | "metabolic"
  | "visual";

export type AtlasModelMetadata = {
  assetLabel: string;
  assetFileName: string;
  referenceAssetUrl: string;
  referenceAttribution: string;
  loaderHint: string;
  scaleHint: string;
  statusLabel: string;
};

export type AtlasTheme = {
  accent: string;
  glow: string;
  surface: string;
};

export type AtlasOrgan = {
  slug: string;
  organName: string;
  category: AtlasCategory;
  aliases: string[];
  summary: string;
  studyFocus: string;
  confidence: number;
  diagramTitle: string;
  diagramSubtitle: string;
  theme: AtlasTheme;
  model: AtlasModelMetadata;
  parts: VisionPart[];
  relationships: VisionRelationship[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function atlasMetadataFromOrgan(organ: AtlasOrgan): VisionAtlasMetadata {
  return {
    diagramTitle: organ.diagramTitle,
    diagramSubtitle: organ.diagramSubtitle,
    assetLabel: organ.model.assetLabel,
    assetFileName: organ.model.assetFileName,
    referenceAssetUrl: organ.model.referenceAssetUrl,
    referenceAttribution: organ.model.referenceAttribution,
    loaderHint: organ.model.loaderHint,
    scaleHint: organ.model.scaleHint,
    statusLabel: organ.model.statusLabel,
    accent: organ.theme.accent,
    surface: organ.theme.surface
  };
}

const humanReferenceAtlasAssetBase =
  "https://cdn.humanatlas.io/digital-objects/ref-organ";
const humanReferenceAtlasAttribution =
  "Human Reference Atlas (HuBMAP) · CC BY 4.0";

export const atlasLibrary: AtlasOrgan[] = [
  {
    slug: "heart",
    organName: "Heart",
    category: "circulatory",
    aliases: ["cardiac", "cardio", "blood flow", "aorta", "ventricle"],
    summary:
      "Cross-section of the heart showing how chambers and valves keep blood moving in one direction.",
    studyFocus: "Trace blood from the atrium into the ventricle and out through the aorta.",
    confidence: 0.97,
    diagramTitle: "Cardiac blood flow",
    diagramSubtitle: "Chambers, valves, and the muscular wall",
    theme: {
      accent: "#fb7185",
      glow: "rgba(251,113,133,0.28)",
      surface: "rgba(251,113,133,0.1)"
    },
    model: {
      assetLabel: "Cardiac cross-section",
      assetFileName: "3d-vh-m-heart.glb",
      referenceAssetUrl: `${humanReferenceAtlasAssetBase}/heart-male/v1.2/assets/3d-vh-m-heart.glb`,
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the Human Reference Atlas heart GLB; the local study mesh only appears while it loads or if you are offline.",
      scaleHint: "Compact organ scale with a slight left-facing tilt.",
      statusLabel: "Interactive 3D model"
    },
    parts: [
      {
        id: "left_atrium",
        name: "Left atrium",
        description: "Receives oxygenated blood from the lungs.",
        function: "Collects incoming blood before it moves into the left ventricle."
      },
      {
        id: "left_ventricle",
        name: "Left ventricle",
        description: "The strongest pumping chamber in the heart.",
        function: "Sends blood into the aorta for circulation."
      },
      {
        id: "aortic_valve",
        name: "Aortic valve",
        description: "One-way valve between the left ventricle and the aorta.",
        function: "Prevents backflow into the ventricle after contraction."
      },
      {
        id: "aorta",
        name: "Aorta",
        description: "Largest artery leaving the heart.",
        function: "Distributes oxygen-rich blood to the body."
      },
      {
        id: "myocardium",
        name: "Myocardium",
        description: "Thick muscular wall of the heart.",
        function: "Contracts to create the pressure that drives blood flow."
      }
    ],
    relationships: [
      {
        sourcePartId: "left_atrium",
        targetPartId: "left_ventricle",
        relation: "passes blood into"
      },
      {
        sourcePartId: "left_ventricle",
        targetPartId: "aortic_valve",
        relation: "pushes blood through"
      },
      {
        sourcePartId: "aortic_valve",
        targetPartId: "aorta",
        relation: "opens to allow flow into"
      },
      {
        sourcePartId: "myocardium",
        targetPartId: "left_ventricle",
        relation: "contracts to drive"
      }
    ]
  },
  {
    slug: "lungs",
    organName: "Lungs",
    category: "respiratory",
    aliases: ["respiratory", "airway", "alveoli", "bronchi", "breathing"],
    summary:
      "Pair of lungs with the airway and diaphragm highlighted to show how air reaches the gas-exchange surfaces.",
    studyFocus: "Follow air from the trachea into the bronchi and down to the alveoli.",
    confidence: 0.95,
    diagramTitle: "Airflow and gas exchange",
    diagramSubtitle: "Airway branches, lung lobes, and breathing muscle",
    theme: {
      accent: "#38bdf8",
      glow: "rgba(56,189,248,0.26)",
      surface: "rgba(56,189,248,0.1)"
    },
    model: {
      assetLabel: "Respiratory pair",
      assetFileName: "3d-vh-m-lung.glb",
      referenceAssetUrl: `${humanReferenceAtlasAssetBase}/lung-male/v1.3/assets/3d-vh-m-lung.glb`,
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the Human Reference Atlas lung GLB; the local study mesh only appears while it loads or if you are offline.",
      scaleHint: "Tall bilateral arrangement that fills the chest cavity.",
      statusLabel: "Interactive 3D model"
    },
    parts: [
      {
        id: "trachea",
        name: "Trachea",
        description: "Main airway that carries air down from the throat.",
        function: "Delivers inhaled air toward the bronchial tree."
      },
      {
        id: "bronchi",
        name: "Bronchi",
        description: "Primary branches that enter each lung.",
        function: "Split airflow into left and right pathways."
      },
      {
        id: "left_lung",
        name: "Left lung",
        description: "Lung tissue on the left side of the chest.",
        function: "Supports oxygen uptake through its smaller paired surface."
      },
      {
        id: "right_lung",
        name: "Right lung",
        description: "Lung tissue on the right side of the chest.",
        function: "Supports oxygen uptake through its larger paired surface."
      },
      {
        id: "alveoli",
        name: "Alveoli",
        description: "Tiny air sacs where gas exchange happens.",
        function: "Move oxygen into the blood and carbon dioxide out."
      },
      {
        id: "diaphragm",
        name: "Diaphragm",
        description: "Domed muscle underneath the lungs.",
        function: "Changes chest volume to drive inhalation and exhalation."
      }
    ],
    relationships: [
      {
        sourcePartId: "trachea",
        targetPartId: "bronchi",
        relation: "splits into"
      },
      {
        sourcePartId: "bronchi",
        targetPartId: "left_lung",
        relation: "supplies air to"
      },
      {
        sourcePartId: "bronchi",
        targetPartId: "right_lung",
        relation: "supplies air to"
      },
      {
        sourcePartId: "left_lung",
        targetPartId: "alveoli",
        relation: "contains"
      },
      {
        sourcePartId: "right_lung",
        targetPartId: "alveoli",
        relation: "contains"
      },
      {
        sourcePartId: "diaphragm",
        targetPartId: "left_lung",
        relation: "creates pressure changes for"
      },
      {
        sourcePartId: "diaphragm",
        targetPartId: "right_lung",
        relation: "creates pressure changes for"
      }
    ]
  },
  {
    slug: "brain",
    organName: "Brain",
    category: "nervous",
    aliases: ["cerebrum", "cerebellum", "neurons", "brainstem", "nervous system"],
    summary:
      "Sagittal brain view showing the major control centers and the pathway down into the spinal cord.",
    studyFocus: "Link the thinking centers to the relay structures and the spinal cord.",
    confidence: 0.96,
    diagramTitle: "Central control map",
    diagramSubtitle: "Control centers, relay pathways, and coordination",
    theme: {
      accent: "#c084fc",
      glow: "rgba(192,132,252,0.26)",
      surface: "rgba(192,132,252,0.1)"
    },
    model: {
      assetLabel: "Sagittal brain",
      assetFileName: "3d-f-brain.glb",
      referenceAssetUrl: `${humanReferenceAtlasAssetBase}/brain-female/v1.3/assets/3d-f-brain.glb`,
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the Human Reference Atlas brain GLB; the local study mesh only appears while it loads or if you are offline.",
      scaleHint: "Side profile with stacked regions and a narrow stem.",
      statusLabel: "Interactive 3D model"
    },
    parts: [
      {
        id: "cerebrum",
        name: "Cerebrum",
        description: "Largest part of the brain responsible for higher thinking.",
        function: "Handles conscious thought, memory, language, and voluntary movement."
      },
      {
        id: "corpus_callosum",
        name: "Corpus callosum",
        description: "Dense band of fibers connecting the two hemispheres.",
        function: "Lets the left and right sides of the cerebrum communicate."
      },
      {
        id: "cerebellum",
        name: "Cerebellum",
        description: "Small rounded region near the back of the brain.",
        function: "Coordinates balance, posture, and fine motor control."
      },
      {
        id: "brainstem",
        name: "Brainstem",
        description: "Lower stalk-like region linking brain to spinal cord.",
        function: "Supports breathing, heartbeat, and other basic life functions."
      },
      {
        id: "spinal_cord",
        name: "Spinal cord",
        description: "Main communication cable extending from the brainstem.",
        function: "Carries signals between the brain and the rest of the body."
      }
    ],
    relationships: [
      {
        sourcePartId: "cerebrum",
        targetPartId: "corpus_callosum",
        relation: "communicates across"
      },
      {
        sourcePartId: "cerebrum",
        targetPartId: "brainstem",
        relation: "sends motor signals through"
      },
      {
        sourcePartId: "cerebellum",
        targetPartId: "brainstem",
        relation: "coordinates with"
      },
      {
        sourcePartId: "brainstem",
        targetPartId: "spinal_cord",
        relation: "continues into"
      }
    ]
  },
  {
    slug: "kidneys",
    organName: "Kidneys",
    category: "urinary",
    aliases: ["renal", "nephron", "urine", "filtration", "bladder"],
    summary:
      "Kidney cross-section highlighting filtration layers, the pelvis, and the ureter that carries urine away.",
    studyFocus: "Follow blood into the cortex, through the medulla, and out through the ureter.",
    confidence: 0.94,
    diagramTitle: "Filtration pathway",
    diagramSubtitle: "Cortex, medulla, and urine drainage",
    theme: {
      accent: "#34d399",
      glow: "rgba(52,211,153,0.24)",
      surface: "rgba(52,211,153,0.1)"
    },
    model: {
      assetLabel: "Kidney section",
      assetFileName: "3d-vh-m-kidney-r.glb",
      referenceAssetUrl: `${humanReferenceAtlasAssetBase}/kidney-male-right/v1.2/assets/3d-vh-m-kidney-r.glb`,
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the Human Reference Atlas kidney GLB; the local study mesh only appears while it loads or if you are offline.",
      scaleHint: "Vertical bean-like volume with a central funnel.",
      statusLabel: "Interactive 3D model"
    },
    parts: [
      {
        id: "renal_artery",
        name: "Renal artery",
        description: "Blood vessel that brings blood into the kidney.",
        function: "Supplies the kidney with blood to be filtered."
      },
      {
        id: "renal_cortex",
        name: "Renal cortex",
        description: "Outer filtering zone of the kidney.",
        function: "Starts blood filtration and forms the first layer of urine production."
      },
      {
        id: "renal_medulla",
        name: "Renal medulla",
        description: "Inner region with the pyramids that concentrate urine.",
        function: "Moves filtered fluid deeper into the drainage system."
      },
      {
        id: "renal_pelvis",
        name: "Renal pelvis",
        description: "Funnel-like space that collects urine before it leaves.",
        function: "Channels urine into the ureter."
      },
      {
        id: "ureter",
        name: "Ureter",
        description: "Tube that carries urine to the bladder.",
        function: "Moves urine away from the kidney."
      }
    ],
    relationships: [
      {
        sourcePartId: "renal_artery",
        targetPartId: "renal_cortex",
        relation: "delivers blood to"
      },
      {
        sourcePartId: "renal_cortex",
        targetPartId: "renal_medulla",
        relation: "funnels filtered fluid into"
      },
      {
        sourcePartId: "renal_medulla",
        targetPartId: "renal_pelvis",
        relation: "drains toward"
      },
      {
        sourcePartId: "renal_pelvis",
        targetPartId: "ureter",
        relation: "funnels urine into"
      },
      {
        sourcePartId: "renal_cortex",
        targetPartId: "ureter",
        relation: "returns filtered fluid through"
      }
    ]
  },
  {
    slug: "liver",
    organName: "Liver",
    category: "metabolic",
    aliases: ["hepatic", "gallbladder", "bile", "portal vein", "metabolism"],
    summary:
      "Liver diagram showing the lobes and bile pathway alongside the major blood vessel entering the organ.",
    studyFocus: "Track blood through the lobes and bile out through the duct system.",
    confidence: 0.95,
    diagramTitle: "Metabolic hub",
    diagramSubtitle: "Lobes, bile, and blood supply",
    theme: {
      accent: "#f97316",
      glow: "rgba(249,115,22,0.24)",
      surface: "rgba(249,115,22,0.1)"
    },
    model: {
      assetLabel: "Hepatic lobes",
      assetFileName: "3d-vh-m-liver.glb",
      referenceAssetUrl: `${humanReferenceAtlasAssetBase}/liver-male/v1.2/assets/3d-vh-m-liver.glb`,
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the Human Reference Atlas liver GLB; the local study mesh only appears while it loads or if you are offline.",
      scaleHint: "Wide asymmetric organ with a smooth, low profile.",
      statusLabel: "Interactive 3D model"
    },
    parts: [
      {
        id: "portal_vein",
        name: "Portal vein",
        description: "Large vessel bringing nutrient-rich blood into the liver.",
        function: "Delivers blood that the liver processes and regulates."
      },
      {
        id: "right_lobe",
        name: "Right lobe",
        description: "Larger right-side portion of the liver.",
        function: "Performs the majority of the liver's metabolic work."
      },
      {
        id: "left_lobe",
        name: "Left lobe",
        description: "Smaller left-side portion of the liver.",
        function: "Supports metabolism, storage, and detoxification."
      },
      {
        id: "gallbladder",
        name: "Gallbladder",
        description: "Small sac tucked under the liver.",
        function: "Stores bile and releases it when digestion needs it."
      },
      {
        id: "hepatic_duct",
        name: "Hepatic duct",
        description: "Duct that carries bile away from the liver.",
        function: "Moves bile toward the digestive tract."
      }
    ],
    relationships: [
      {
        sourcePartId: "portal_vein",
        targetPartId: "right_lobe",
        relation: "brings nutrient-rich blood to"
      },
      {
        sourcePartId: "portal_vein",
        targetPartId: "left_lobe",
        relation: "brings nutrient-rich blood to"
      },
      {
        sourcePartId: "gallbladder",
        targetPartId: "hepatic_duct",
        relation: "releases bile into"
      },
      {
        sourcePartId: "right_lobe",
        targetPartId: "hepatic_duct",
        relation: "channels bile toward"
      },
      {
        sourcePartId: "left_lobe",
        targetPartId: "hepatic_duct",
        relation: "channels bile toward"
      }
    ]
  },
  {
    slug: "eye",
    organName: "Eye",
    category: "visual",
    aliases: ["ocular", "vision", "retina", "lens", "iris"],
    summary:
      "Eye cross-section showing the structures that focus light and pass visual signals to the brain.",
    studyFocus: "Trace light from the cornea through the lens to the retina and optic nerve.",
    confidence: 0.96,
    diagramTitle: "Visual pathway",
    diagramSubtitle: "Focusing surfaces, sensory layers, and the optic nerve",
    theme: {
      accent: "#facc15",
      glow: "rgba(250,204,21,0.24)",
      surface: "rgba(250,204,21,0.1)"
    },
    model: {
      assetLabel: "Ocular globe",
      assetFileName: "3d-vh-m-eye-r.glb",
      referenceAssetUrl: `${humanReferenceAtlasAssetBase}/eye-male-right/v1.2/assets/3d-vh-m-eye-r.glb`,
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the Human Reference Atlas eye GLB; the local study mesh only appears while it loads or if you are offline.",
      scaleHint: "Small spherical profile with a forward-facing corneal dome.",
      statusLabel: "Interactive 3D model"
    },
    parts: [
      {
        id: "cornea",
        name: "Cornea",
        description: "Clear curved front surface of the eye.",
        function: "Bends incoming light and protects the inner structures."
      },
      {
        id: "iris",
        name: "Iris",
        description: "Colored ring that surrounds the pupil.",
        function: "Controls how much light enters the eye."
      },
      {
        id: "lens",
        name: "Lens",
        description: "Transparent structure behind the iris.",
        function: "Focuses light onto the retina."
      },
      {
        id: "retina",
        name: "Retina",
        description: "Light-sensitive layer lining the back of the eye.",
        function: "Converts light into nerve signals."
      },
      {
        id: "optic_nerve",
        name: "Optic nerve",
        description: "Nerve bundle carrying visual information to the brain.",
        function: "Transmits signals from the retina for visual processing."
      }
    ],
    relationships: [
      {
        sourcePartId: "cornea",
        targetPartId: "lens",
        relation: "focuses light toward"
      },
      {
        sourcePartId: "iris",
        targetPartId: "lens",
        relation: "controls light entering before"
      },
      {
        sourcePartId: "lens",
        targetPartId: "retina",
        relation: "projects the image onto"
      },
      {
        sourcePartId: "retina",
        targetPartId: "optic_nerve",
        relation: "converts signals for"
      }
    ]
  }
];

export function findAtlasOrgan(identifier: string | null | undefined) {
  if (!identifier) {
    return atlasLibrary[0];
  }

  const normalized = slugify(identifier);

  return (
    atlasLibrary.find((organ) =>
      [organ.slug, organ.organName, ...organ.aliases].some((term) =>
        slugify(term).includes(normalized) || normalized.includes(slugify(term))
      )
    ) ?? atlasLibrary[0]
  );
}

export function pickAtlasOrgan(fileName: string) {
  return findAtlasOrgan(fileName);
}

export function buildAtlasResult(
  organ: AtlasOrgan,
  sourceFileName: string
): VisionExtractionResult {
  return {
    organSlug: organ.slug,
    organName: organ.organName,
    summary: organ.summary,
    confidence: organ.confidence,
    sourceFileName,
    parts: organ.parts,
    relationships: organ.relationships,
    atlasMetadata: atlasMetadataFromOrgan(organ)
  };
}

export function getAtlasMetadata(organ: AtlasOrgan) {
  return atlasMetadataFromOrgan(organ);
}

export const defaultAtlasOrgan = atlasLibrary[0];
