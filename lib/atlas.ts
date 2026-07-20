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
  | "visual"
  | "digestive"
  | "immune"
  | "vascular"
  | "skeletal"
  | "integrated";

export type AtlasModelMetadata = {
  assetLabel: string;
  assetFileName: string;
  referenceAssetUrl: string | string[];
  referenceAttribution: string;
  loaderHint: string;
  scaleHint: string;
  statusLabel: string;
  isolateReferenceParts?: boolean;
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
    isolateReferenceParts: organ.model.isolateReferenceParts,
    accent: organ.theme.accent,
    surface: organ.theme.surface
  };
}

const sketchfabLocalAttribution = "Sketchfab model · supplied locally";

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
      assetLabel: "Sketchfab anatomical heart",
      assetFileName: "heart.glb",
      referenceAssetUrl: "/models/sketchfab-models/heart.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab heart GLB.",
      scaleHint: "Compact organ scale with a slight left-facing tilt.",
      statusLabel: "Verified local 3D model"
    },
    parts: [
      {
        id: "left_atrium",
        name: "Left atrium",
        description: "Receives oxygenated blood from the lungs.",
        function: "Collects incoming blood before it moves into the left ventricle."
      },
      {
        id: "right_atrium",
        name: "Right atrium",
        description: "Receives blood returning from the body.",
        function: "Passes deoxygenated blood into the right ventricle."
      },
      {
        id: "left_ventricle",
        name: "Left ventricle",
        description: "The strongest pumping chamber in the heart.",
        function: "Sends blood into the aorta for circulation."
      },
      {
        id: "right_ventricle",
        name: "Right ventricle",
        description: "Pumping chamber on the right side of the heart.",
        function: "Sends blood toward the lungs through the pulmonary valve."
      },
      {
        id: "mitral_valve",
        name: "Mitral valve",
        description: "Two-leaflet valve between the left atrium and left ventricle.",
        function: "Prevents blood from moving backward into the left atrium."
      },
      {
        id: "tricuspid_valve",
        name: "Tricuspid valve",
        description: "Three-leaflet valve between the right atrium and right ventricle.",
        function: "Prevents backflow into the right atrium."
      },
      {
        id: "pulmonary_valve",
        name: "Pulmonary valve",
        description: "Semilunar valve at the exit of the right ventricle.",
        function: "Keeps blood from returning to the right ventricle after ejection."
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
        sourcePartId: "right_atrium",
        targetPartId: "right_ventricle",
        relation: "passes blood into"
      },
      {
        sourcePartId: "left_atrium",
        targetPartId: "mitral_valve",
        relation: "opens through"
      },
      {
        sourcePartId: "right_atrium",
        targetPartId: "tricuspid_valve",
        relation: "opens through"
      },
      {
        sourcePartId: "right_ventricle",
        targetPartId: "pulmonary_valve",
        relation: "pushes blood through"
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
      assetLabel: "Sketchfab realistic lungs",
      assetFileName: "realistic_human_lungs.glb",
      referenceAssetUrl: "/models/sketchfab-models/realistic_human_lungs.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab lungs GLB.",
      scaleHint: "Tall bilateral arrangement that fills the chest cavity.",
      statusLabel: "Verified local 3D model"
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
        id: "left_upper_lobe",
        name: "Left upper lobe",
        description: "Superior lobe of the left lung.",
        function: "Provides a major portion of the left lung's gas-exchange surface."
      },
      {
        id: "left_lower_lobe",
        name: "Left lower lobe",
        description: "Inferior lobe of the left lung.",
        function: "Provides a major portion of the left lung's gas-exchange surface."
      },
      {
        id: "right_upper_lobe",
        name: "Right upper lobe",
        description: "Superior lobe of the right lung.",
        function: "Receives air through the superior lobar bronchus."
      },
      {
        id: "right_middle_lobe",
        name: "Right middle lobe",
        description: "Small central lobe unique to the right lung.",
        function: "Receives air through the middle lobar bronchus."
      },
      {
        id: "right_lower_lobe",
        name: "Right lower lobe",
        description: "Largest inferior lobe of the right lung.",
        function: "Receives air through the inferior lobar bronchus."
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
        targetPartId: "left_upper_lobe",
        relation: "contains"
      },
      {
        sourcePartId: "left_lung",
        targetPartId: "left_lower_lobe",
        relation: "contains"
      },
      {
        sourcePartId: "right_lung",
        targetPartId: "right_upper_lobe",
        relation: "contains"
      },
      {
        sourcePartId: "right_lung",
        targetPartId: "right_middle_lobe",
        relation: "contains"
      },
      {
        sourcePartId: "right_lung",
        targetPartId: "right_lower_lobe",
        relation: "contains"
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
      assetLabel: "Sketchfab human brain",
      assetFileName: "human_brain.glb",
      referenceAssetUrl: "/models/sketchfab-models/human_brain.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab brain GLB.",
      scaleHint: "Side profile with stacked regions and a narrow stem.",
      statusLabel: "Verified local 3D model"
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
      "Single-kidney cross-section highlighting the capsule, cortex, medulla, vessels, and the ureter that carries urine away.",
    studyFocus: "Follow blood into the cortex, through the medulla, and out through the ureter.",
    confidence: 0.94,
    diagramTitle: "Filtration pathway",
    diagramSubtitle: "Single-kidney cortex, medulla, vessels, and drainage",
    theme: {
      accent: "#34d399",
      glow: "rgba(52,211,153,0.24)",
      surface: "rgba(52,211,153,0.1)"
    },
    model: {
      assetLabel: "Sketchfab kidney cross-section",
      assetFileName: "kidney.glb",
      referenceAssetUrl: "/models/sketchfab-models/kidney.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab kidney GLB with internal structures.",
      scaleHint: "Vertical bean-like volume with a central funnel.",
      statusLabel: "Verified local 3D model"
    },
    parts: [
      {
        id: "renal_artery",
        name: "Renal artery",
        description: "Blood vessel that brings blood into the kidney.",
        function: "Supplies the kidney with blood to be filtered."
      },
      {
        id: "renal_vein",
        name: "Renal vein",
        description: "Blood vessel that carries filtered blood away from this kidney.",
        function: "Returns filtered blood to the body's venous circulation."
      },
      {
        id: "renal_capsule",
        name: "Renal capsule",
        description: "Thin outer fibrous covering of this single kidney.",
        function: "Protects the kidney and helps maintain its shape."
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
        targetPartId: "renal_vein",
        relation: "returns filtered blood through"
      },
      {
        sourcePartId: "renal_cortex",
        targetPartId: "renal_medulla",
        relation: "funnels filtered fluid into"
      },
      {
        sourcePartId: "renal_medulla",
        targetPartId: "ureter",
        relation: "drains urine into"
      },
      {
        sourcePartId: "renal_capsule",
        targetPartId: "renal_cortex",
        relation: "surrounds"
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
      assetLabel: "Sketchfab human liver",
      assetFileName: "liver.glb",
      referenceAssetUrl: "/models/sketchfab-models/liver.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab liver GLB.",
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
      assetLabel: "Sketchfab human eye",
      assetFileName: "eye.glb",
      referenceAssetUrl: "/models/sketchfab-models/eye.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab eye GLB.",
      scaleHint: "Small spherical profile with a forward-facing corneal dome.",
      statusLabel: "Verified local 3D model"
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

function extendOrgan(
  slug: string,
  parts: VisionPart[],
  relationships: VisionRelationship[]
) {
  const organ = atlasLibrary.find((entry) => entry.slug === slug);

  if (!organ) {
    return;
  }

  const knownPartIds = new Set(organ.parts.map((part) => part.id));
  organ.parts.push(...parts.filter((part) => !knownPartIds.has(part.id)));

  const knownRelationships = new Set(
    organ.relationships.map(
      (relationship) =>
        `${relationship.sourcePartId}:${relationship.relation}:${relationship.targetPartId}`
    )
  );
  organ.relationships.push(
    ...relationships.filter((relationship) => {
      const key = `${relationship.sourcePartId}:${relationship.relation}:${relationship.targetPartId}`;
      return !knownRelationships.has(key);
    })
  );
}

// Source meshes vary in how finely they separate structures. These expanded
// study maps keep the viewer useful as an atlas: every important region gets a
// label and a connected explanation, even when the source mesh groups it with
// a neighbouring structure.
extendOrgan(
  "heart",
  [
    { id: "superior_vena_cava", name: "Superior vena cava", description: "Large vein entering the right atrium from above.", function: "Returns oxygen-poor blood from the head and upper body." },
    { id: "inferior_vena_cava", name: "Inferior vena cava", description: "Large vein entering the right atrium from below.", function: "Returns oxygen-poor blood from the lower body." },
    { id: "pulmonary_artery", name: "Pulmonary trunk", description: "Short arterial trunk leaving the right ventricle before dividing into the right and left pulmonary arteries.", function: "Carries oxygen-poor blood from the heart toward the lungs for gas exchange." },
    { id: "pulmonary_veins", name: "Pulmonary veins", description: "Veins returning from the lungs to the left atrium.", function: "Bring oxygen-rich blood back to the heart." },
    { id: "interventricular_septum", name: "Interventricular septum", description: "Muscular wall separating the two ventricles.", function: "Keeps oxygen-rich and oxygen-poor blood pathways separate." },
    { id: "coronary_arteries", name: "Coronary arteries", description: "Vessels running over the heart surface.", function: "Supply the myocardium with oxygen-rich blood." }
  ],
  [
    { sourcePartId: "superior_vena_cava", targetPartId: "right_atrium", relation: "drains into" },
    { sourcePartId: "inferior_vena_cava", targetPartId: "right_atrium", relation: "drains into" },
    { sourcePartId: "right_ventricle", targetPartId: "pulmonary_artery", relation: "ejects blood into" },
    { sourcePartId: "pulmonary_veins", targetPartId: "left_atrium", relation: "return blood to" },
    { sourcePartId: "coronary_arteries", targetPartId: "myocardium", relation: "supply" },
    { sourcePartId: "interventricular_septum", targetPartId: "left_ventricle", relation: "separates from" }
  ]
);

extendOrgan(
  "brain",
  [
    { id: "frontal_lobe", name: "Frontal lobe", description: "Anterior cerebral region behind the forehead.", function: "Supports planning, voluntary movement, language production, and decision-making." },
    { id: "parietal_lobe", name: "Parietal lobe", description: "Upper rear cerebral region.", function: "Integrates touch, spatial awareness, and sensory information." },
    { id: "temporal_lobe", name: "Temporal lobe", description: "Side region near the temples.", function: "Helps process sound, language, and memory." },
    { id: "occipital_lobe", name: "Occipital lobe", description: "Posterior region of the cerebrum.", function: "Processes visual information." },
    { id: "thalamus", name: "Thalamus", description: "Deep relay structure near the center of the brain.", function: "Routes most sensory signals to the cerebral cortex." },
    { id: "hypothalamus", name: "Hypothalamus", description: "Small region beneath the thalamus.", function: "Regulates temperature, hunger, hormones, and autonomic balance." },
    { id: "hippocampus", name: "Hippocampus", description: "Curved structure deep in the temporal lobe.", function: "Helps form and retrieve new memories." },
    { id: "pituitary_gland", name: "Pituitary gland", description: "Pea-sized gland suspended below the brain.", function: "Releases hormones that coordinate several endocrine glands." }
  ],
  [
    { sourcePartId: "frontal_lobe", targetPartId: "cerebrum", relation: "forms the anterior region of" },
    { sourcePartId: "parietal_lobe", targetPartId: "cerebrum", relation: "forms the upper region of" },
    { sourcePartId: "temporal_lobe", targetPartId: "cerebrum", relation: "forms the lateral region of" },
    { sourcePartId: "occipital_lobe", targetPartId: "cerebrum", relation: "forms the posterior region of" },
    { sourcePartId: "thalamus", targetPartId: "cerebrum", relation: "relays sensory signals to" },
    { sourcePartId: "hypothalamus", targetPartId: "pituitary_gland", relation: "regulates" },
    { sourcePartId: "hippocampus", targetPartId: "temporal_lobe", relation: "sits within" }
  ]
);

extendOrgan(
  "lungs",
  [
    { id: "carina", name: "Carina", description: "Ridge where the trachea divides into the main bronchi.", function: "Directs airflow into the left and right bronchial trees." },
    { id: "alveoli", name: "Alveoli", description: "Microscopic air sacs at the ends of bronchioles.", function: "Exchange oxygen and carbon dioxide with nearby capillaries." },
    { id: "diaphragm", name: "Diaphragm", description: "Dome-shaped muscle below the lungs.", function: "Drives inhalation by expanding the chest cavity." }
  ],
  [
    { sourcePartId: "trachea", targetPartId: "carina", relation: "ends at" },
    { sourcePartId: "carina", targetPartId: "bronchi", relation: "divides into" },
    { sourcePartId: "bronchi", targetPartId: "alveoli", relation: "branch toward" },
    { sourcePartId: "diaphragm", targetPartId: "left_lung", relation: "supports expansion of" },
    { sourcePartId: "diaphragm", targetPartId: "right_lung", relation: "supports expansion of" }
  ]
);

extendOrgan(
  "kidneys",
  [
    { id: "renal_pyramids", name: "Renal pyramids", description: "Triangular structures within the medulla.", function: "Concentrate urine and pass it into the kidney's drainage pathway." }
  ],
  [
    { sourcePartId: "renal_medulla", targetPartId: "renal_pyramids", relation: "contains" },
    { sourcePartId: "renal_pyramids", targetPartId: "ureter", relation: "drain urine toward" }
  ]
);

extendOrgan(
  "liver",
  [
    { id: "caudate_lobe", name: "Caudate lobe", description: "Small lobe on the posterior surface near the vena cava.", function: "Contributes to the liver's metabolic and blood-processing functions." },
    { id: "quadrate_lobe", name: "Quadrate lobe", description: "Small inferior lobe near the gallbladder.", function: "Forms part of the liver's functional tissue." },
    { id: "hepatic_artery", name: "Hepatic artery", description: "Artery bringing oxygen-rich blood to the liver.", function: "Supplies the liver tissue with oxygen." },
    { id: "hepatic_veins", name: "Hepatic veins", description: "Veins draining blood from the liver.", function: "Return processed blood to the inferior vena cava." },
    { id: "common_bile_duct", name: "Common bile duct", description: "Duct carrying bile toward the small intestine.", function: "Delivers bile to help digest fats." },
    { id: "falciform_ligament", name: "Falciform ligament", description: "Fold of tissue visible on the front of the liver.", function: "Anchors the liver to the anterior abdominal wall." }
  ],
  [
    { sourcePartId: "hepatic_artery", targetPartId: "right_lobe", relation: "supplies" },
    { sourcePartId: "hepatic_veins", targetPartId: "right_lobe", relation: "drain" },
    { sourcePartId: "caudate_lobe", targetPartId: "right_lobe", relation: "lies beside" },
    { sourcePartId: "quadrate_lobe", targetPartId: "gallbladder", relation: "lies beside" },
    { sourcePartId: "hepatic_duct", targetPartId: "common_bile_duct", relation: "continues as" },
    { sourcePartId: "falciform_ligament", targetPartId: "left_lobe", relation: "marks the surface of" }
  ]
);

extendOrgan(
  "eye",
  [
    { id: "pupil", name: "Pupil", description: "Dark central opening in the iris.", function: "Lets a controlled amount of light enter the eye." },
    { id: "sclera", name: "Sclera", description: "Tough white outer coat of the eye.", function: "Protects the globe and gives eye muscles a firm attachment." },
    { id: "aqueous_humor", name: "Aqueous humor", description: "Clear fluid in the front chambers of the eye.", function: "Nourishes the cornea and lens while maintaining eye pressure." },
    { id: "vitreous_body", name: "Vitreous body", description: "Clear gel filling the large rear chamber.", function: "Helps the eye keep its shape and supports the retina." },
    { id: "choroid", name: "Choroid", description: "Vascular layer between sclera and retina.", function: "Supplies the outer retina with oxygen and nutrients." }
  ],
  [
    { sourcePartId: "iris", targetPartId: "pupil", relation: "surrounds" },
    { sourcePartId: "cornea", targetPartId: "aqueous_humor", relation: "encloses" },
    { sourcePartId: "lens", targetPartId: "vitreous_body", relation: "focuses light through" },
    { sourcePartId: "choroid", targetPartId: "retina", relation: "nourishes" },
    { sourcePartId: "sclera", targetPartId: "choroid", relation: "surrounds" }
  ]
);

atlasLibrary.push({
  slug: "pancreas",
  organName: "Pancreas",
  category: "metabolic",
  aliases: ["pancreatic", "insulin", "digestive", "islets", "duodenum"],
  summary: "A detailed pancreatic study showing its endocrine islands and the duct that delivers digestive enzymes.",
  studyFocus: "Trace digestive secretions from the pancreatic head through the duct toward the duodenum.",
  confidence: 0.95,
  diagramTitle: "Endocrine and digestive roles",
  diagramSubtitle: "Regions, duct pathway, and hormone-producing islands",
  theme: { accent: "#fbbf24", glow: "rgba(251,191,36,0.25)", surface: "rgba(251,191,36,0.1)" },
  model: {
    assetLabel: "Sketchfab pancreas cross-section",
    assetFileName: "human_pancreas_cross_section.glb",
    referenceAssetUrl: "/models/sketchfab-models/human_pancreas_cross_section.glb",
    referenceAttribution: sketchfabLocalAttribution,
    loaderHint: "Loads the locally supplied Sketchfab pancreatic cross-section GLB.",
    scaleHint: "Low, elongated gland with the broad head on the duodenal side and a narrow tail toward the spleen.",
    statusLabel: "Interactive 3D model"
  },
  parts: [
    { id: "pancreatic_head", name: "Pancreatic head", description: "Broad right-side portion cradled by the duodenum.", function: "Contributes digestive enzymes and hormones." },
    { id: "pancreatic_neck", name: "Pancreatic neck", description: "Short segment between the head and body.", function: "Connects the broad head to the central gland." },
    { id: "pancreatic_body", name: "Pancreatic body", description: "Central elongated portion of the pancreas.", function: "Contains enzyme-producing and hormone-producing tissue." },
    { id: "pancreatic_tail", name: "Pancreatic tail", description: "Tapered left end near the spleen.", function: "Contains a relatively high concentration of endocrine islets." },
    { id: "pancreatic_duct", name: "Pancreatic duct", description: "Main channel through the gland.", function: "Carries digestive secretions toward the small intestine." },
    { id: "islets_of_langerhans", name: "Islets of Langerhans", description: "Clusters of endocrine cells scattered through the pancreas.", function: "Release hormones including insulin and glucagon into the blood." },
    { id: "duodenum", name: "Duodenum", description: "First segment of the small intestine beside the pancreatic head.", function: "Receives pancreatic enzymes to support digestion." }
  ],
  relationships: [
    { sourcePartId: "pancreatic_head", targetPartId: "pancreatic_neck", relation: "continues into" },
    { sourcePartId: "pancreatic_neck", targetPartId: "pancreatic_body", relation: "continues into" },
    { sourcePartId: "pancreatic_body", targetPartId: "pancreatic_tail", relation: "continues into" },
    { sourcePartId: "pancreatic_duct", targetPartId: "duodenum", relation: "delivers enzymes to" },
    { sourcePartId: "islets_of_langerhans", targetPartId: "pancreatic_body", relation: "are distributed through" }
  ]
});

atlasLibrary.push(
  {
    slug: "digestive-system",
    organName: "Digestive System",
    category: "digestive",
    aliases: ["intestine", "colon", "digestion", "gastrointestinal", "bowel"],
    summary: "A connected digestive study built from the liver, pancreas, and small and large intestines.",
    studyFocus: "Follow digestion through the intestinal tract and identify the accessory organs that contribute enzymes and bile.",
    confidence: 0.95,
    diagramTitle: "Digestive pathway",
    diagramSubtitle: "Accessory organs, small intestine, and colon",
    theme: { accent: "#f59e0b", glow: "rgba(245,158,11,0.24)", surface: "rgba(245,158,11,0.1)" },
    model: {
      assetLabel: "Sketchfab digestive system",
      assetFileName: "digestive_system.glb",
      referenceAssetUrl: "/models/sketchfab-models/digestive_system.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab digestive-system GLB.",
      scaleHint: "Wide abdominal composition with the intestinal loops below the accessory organs.",
      statusLabel: "Verified local 3D model"
    },
    parts: [
      { id: "liver", name: "Liver", description: "Large upper abdominal organ that makes bile.", function: "Processes nutrients and produces bile for digestion." },
      { id: "pancreas", name: "Pancreas", description: "Elongated gland positioned behind the stomach.", function: "Releases digestive enzymes and blood-sugar hormones." },
      { id: "small_intestine", name: "Small intestine", description: "Long coiled digestive tube in the central abdomen.", function: "Absorbs most nutrients from digested food." },
      { id: "large_intestine", name: "Large intestine", description: "Broader intestinal frame around the small intestine.", function: "Reclaims water and compacts digestive waste." },
      { id: "bile_pathway", name: "Bile pathway", description: "Duct system that carries bile toward the intestine.", function: "Delivers bile to support fat digestion." }
    ],
    relationships: [
      { sourcePartId: "liver", targetPartId: "bile_pathway", relation: "produces bile for" },
      { sourcePartId: "pancreas", targetPartId: "small_intestine", relation: "delivers enzymes to" },
      { sourcePartId: "small_intestine", targetPartId: "large_intestine", relation: "continues into" }
    ]
  },
  {
    slug: "spleen",
    organName: "Spleen",
    category: "immune",
    aliases: ["lymphatic", "immune", "splenic", "blood filter"],
    summary: "A detailed spleen model for studying immune surveillance and blood filtration.",
    studyFocus: "Identify the capsule, red pulp, white pulp, and the vessels entering at the hilum.",
    confidence: 0.95,
    diagramTitle: "Blood filtration and immunity",
    diagramSubtitle: "White pulp, red pulp, capsule, and vessels",
    theme: { accent: "#a78bfa", glow: "rgba(167,139,250,0.24)", surface: "rgba(167,139,250,0.1)" },
    model: {
      assetLabel: "Sketchfab spleen model",
      assetFileName: "spleen_model.glb",
      referenceAssetUrl: "/models/sketchfab-models/spleen_model.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab spleen GLB.",
      scaleHint: "Compact, crescent-shaped organ with a vascular hilum.",
      statusLabel: "Verified local 3D model"
    },
    parts: [
      { id: "spleen", name: "Spleen", description: "Soft vascular organ in the upper left abdomen.", function: "Filters blood and supports immune responses." },
      { id: "splenic_capsule", name: "Splenic capsule", description: "Fibrous outer covering of the spleen.", function: "Protects the organ and maintains its shape." },
      { id: "white_pulp", name: "White pulp", description: "Immune-rich tissue arranged around arterioles.", function: "Monitors blood-borne antigens and mounts immune responses." },
      { id: "red_pulp", name: "Red pulp", description: "Blood-filled tissue making up most of the spleen.", function: "Filters aged red cells and stores blood components." },
      { id: "splenic_hilum", name: "Splenic hilum", description: "Indented surface where vessels enter and leave.", function: "Provides the route for splenic arteries, veins, and nerves." }
    ],
    relationships: [
      { sourcePartId: "splenic_capsule", targetPartId: "spleen", relation: "surrounds" },
      { sourcePartId: "white_pulp", targetPartId: "red_pulp", relation: "sits within" },
      { sourcePartId: "splenic_hilum", targetPartId: "spleen", relation: "serves" }
    ]
  },
  {
    slug: "vascular-system",
    organName: "Blood Vasculature",
    category: "vascular",
    aliases: ["blood vessels", "arteries", "veins", "circulation", "aorta"],
    summary: "A body-scale vascular reference for tracing the major arterial and venous pathways.",
    studyFocus: "Compare the central arterial routes with the large veins that return blood to the heart.",
    confidence: 0.94,
    diagramTitle: "Major circulation map",
    diagramSubtitle: "Arteries, veins, and central return pathways",
    theme: { accent: "#fb7185", glow: "rgba(251,113,133,0.24)", surface: "rgba(251,113,133,0.1)" },
    model: {
      assetLabel: "Sketchfab cardiovascular system",
      assetFileName: "reworked_cardiovascular_system.glb",
      referenceAssetUrl: "/models/sketchfab-models/reworked_cardiovascular_system.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab cardiovascular-system GLB.",
      scaleHint: "Tall body-scale vessel map centered on the aorta and venae cavae.",
      statusLabel: "Verified local 3D model"
    },
    parts: [
      { id: "aorta", name: "Aorta", description: "Largest artery leaving the heart.", function: "Distributes oxygen-rich blood to systemic arteries." },
      { id: "superior_vena_cava", name: "Superior vena cava", description: "Large vein returning blood from the upper body.", function: "Returns blood to the right atrium." },
      { id: "inferior_vena_cava", name: "Inferior vena cava", description: "Large vein returning blood from the lower body.", function: "Returns blood to the right atrium." },
      { id: "pulmonary_arteries", name: "Pulmonary arteries", description: "Vessels running from the heart to the lungs.", function: "Carry oxygen-poor blood to the lungs." },
      { id: "pulmonary_veins", name: "Pulmonary veins", description: "Vessels returning from the lungs.", function: "Carry oxygen-rich blood to the left atrium." }
    ],
    relationships: [
      { sourcePartId: "aorta", targetPartId: "inferior_vena_cava", relation: "is paired with systemic return through" },
      { sourcePartId: "pulmonary_arteries", targetPartId: "pulmonary_veins", relation: "return through" },
      { sourcePartId: "superior_vena_cava", targetPartId: "inferior_vena_cava", relation: "joins circulation with" }
    ]
  },
  {
    slug: "skeleton",
    organName: "Skeleton",
    category: "skeletal",
    aliases: ["bones", "skeletal", "skull", "spine", "rib cage"],
    summary: "Full articulated skeleton shown in an isolated skeletal study mode.",
    studyFocus: "Use the full-body hierarchy to locate the axial skeleton, limbs, and major joints.",
    confidence: 0.96,
    diagramTitle: "Articulated skeletal system",
    diagramSubtitle: "Axial framework, limbs, and joints",
    theme: { accent: "#e2e8f0", glow: "rgba(226,232,240,0.22)", surface: "rgba(226,232,240,0.08)" },
    model: {
      assetLabel: "Sketchfab articulated skeleton",
      assetFileName: "skeleton.glb",
      referenceAssetUrl: "/models/sketchfab-models/skeleton.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab skeleton GLB.",
      scaleHint: "Full standing human reference with individually modeled skeletal structures.",
      statusLabel: "Local 3D model"
    },
    parts: [
      { id: "skull", name: "Skull", description: "Bony framework of the head.", function: "Protects the brain and supports facial structures." },
      { id: "vertebral_column", name: "Vertebral column", description: "Segmented bony column from neck to pelvis.", function: "Protects the spinal cord and supports posture." },
      { id: "rib_cage", name: "Rib cage", description: "Thoracic framework of ribs and sternum.", function: "Protects the heart and lungs while supporting breathing." },
      { id: "pelvis", name: "Pelvis", description: "Bony ring connecting the trunk and lower limbs.", function: "Transfers body weight and protects pelvic organs." },
      { id: "femur", name: "Femur", description: "Largest bone in the thigh.", function: "Supports weight and drives lower-limb movement." },
      { id: "humerus", name: "Humerus", description: "Long bone of the upper arm.", function: "Connects shoulder motion to the elbow." }
    ],
    relationships: [
      { sourcePartId: "skull", targetPartId: "vertebral_column", relation: "sits above" },
      { sourcePartId: "rib_cage", targetPartId: "vertebral_column", relation: "attaches to" },
      { sourcePartId: "pelvis", targetPartId: "femur", relation: "connects to" },
      { sourcePartId: "humerus", targetPartId: "rib_cage", relation: "articulates beside" }
    ]
  },
  {
    slug: "human-body",
    organName: "Human Body",
    category: "integrated",
    aliases: ["person", "whole body", "full body", "human atlas"],
    summary: "A high-detail, body-scale human model for studying whole-body form.",
    studyFocus: "Explore how the major systems occupy the same human reference frame.",
    confidence: 0.96,
    diagramTitle: "Integrated human reference",
    diagramSubtitle: "A complete body-scale anatomical hierarchy",
    theme: { accent: "#67e8f9", glow: "rgba(103,232,249,0.22)", surface: "rgba(103,232,249,0.1)" },
    model: {
      assetLabel: "Sketchfab male human body",
      assetFileName: "male_human_body.glb",
      referenceAssetUrl: "/models/sketchfab-models/male_human_body.glb",
      referenceAttribution: sketchfabLocalAttribution,
      loaderHint: "Loads the locally supplied Sketchfab full-body GLB.",
      scaleHint: "Full standing human figure with integrated systems and reference-organ proportions.",
      statusLabel: "Verified local 3D model"
    },
    parts: [
      { id: "skeletal_system", name: "Skeletal system", description: "Body-wide framework of bones and joints.", function: "Provides support, protection, and leverage for movement." },
      { id: "circulatory_system", name: "Circulatory system", description: "Heart and body-wide vessels.", function: "Moves blood, oxygen, nutrients, and waste." },
      { id: "digestive_system", name: "Digestive system", description: "Organs that process food and absorb nutrients.", function: "Breaks down food and supports nutrient uptake." },
      { id: "respiratory_system", name: "Respiratory system", description: "Airway and lungs.", function: "Exchanges oxygen and carbon dioxide." },
      { id: "urinary_system", name: "Urinary system", description: "Kidneys, ureters, and bladder.", function: "Filters blood and regulates fluid balance." }
    ],
    relationships: [
      { sourcePartId: "respiratory_system", targetPartId: "circulatory_system", relation: "oxygenates" },
      { sourcePartId: "digestive_system", targetPartId: "circulatory_system", relation: "supplies nutrients to" },
      { sourcePartId: "skeletal_system", targetPartId: "urinary_system", relation: "protects" }
    ]
  }
);

// These details are used by the author-curated, point-and-click labels. They
// retain the same study-panel treatment as the core atlas structures while
// keeping the learner's own marker placement as the visible source of truth.
extendOrgan(
  "lungs",
  [
    { id: "cardiac_notch", name: "Cardiac notch", description: "Indentation on the anterior border of the left lung where the heart projects.", function: "Creates room for the heart within the left thorax." },
    { id: "lingula", name: "Lingula", description: "Tongue-like projection of the left upper lobe beside the cardiac notch.", function: "Occupies a position comparable to the right middle lobe." },
    { id: "lung_apex", name: "Apex of lung", description: "Uppermost pointed portion of a lung, extending above the first rib.", function: "Marks the superior limit of the lung." }
  ],
  []
);

extendOrgan(
  "brain",
  [
    { id: "pons", name: "Pons", description: "Bulging middle portion of the brainstem between the midbrain and medulla oblongata.", function: "Relays signals between the cerebrum, cerebellum, and spinal cord and helps regulate breathing." },
    { id: "medulla_oblongata", name: "Medulla oblongata", description: "Lowest part of the brainstem, continuous with the spinal cord.", function: "Regulates vital automatic functions including breathing, heart rate, and blood pressure." },
    { id: "central_sulcus", name: "Central sulcus", description: "Prominent groove separating the frontal lobe from the parietal lobe.", function: "Marks the boundary between primary motor and primary somatosensory cortices." },
    { id: "lateral_cerebral_sulcus", name: "Lateral cerebral sulcus", description: "Deep lateral groove, also called the Sylvian fissure.", function: "Separates the temporal lobe from the frontal and parietal lobes." }
  ],
  []
);

extendOrgan(
  "kidneys",
  [
    { id: "arcuate_artery", name: "Arcuate artery", description: "Artery arching along the base of a renal pyramid at the corticomedullary junction.", function: "Gives rise to cortical radiate arteries that supply the renal cortex." },
    { id: "interlobular_arteries", name: "Interlobular arteries", description: "Small cortical arteries that radiate outward between renal lobules.", function: "Deliver blood toward the afferent arterioles of nephrons." },
    { id: "superior_segmental_artery", name: "Superior segmental artery", description: "Branch of the renal artery supplying the superior renal segment.", function: "Delivers arterial blood to the upper portion of the kidney." },
    { id: "posterior_segmental_artery", name: "Posterior segmental artery", description: "Branch of the renal artery supplying the posterior renal segment.", function: "Delivers arterial blood to the posterior part of the kidney." },
    { id: "inferior_segmental_artery", name: "Inferior segmental artery", description: "Branch of the renal artery supplying the inferior renal segment.", function: "Delivers arterial blood to the lower portion of the kidney." },
    { id: "interlobar_arteries", name: "Interlobar arteries", description: "Arteries that travel between renal pyramids in the renal columns.", function: "Carry blood from segmental arteries toward the arcuate arteries." },
    { id: "renal_pelvis", name: "Renal pelvis", description: "Funnel-shaped collecting chamber at the kidney hilum.", function: "Collects urine from the calyces and channels it into the ureter." }
  ],
  []
);

extendOrgan(
  "liver",
  [
    { id: "diaphragmatic_surface", name: "Diaphragmatic surface", description: "Smooth convex surface of the liver that lies against the diaphragm.", function: "Forms the superior and anterior contact surface of the liver." }
  ],
  []
);

extendOrgan(
  "eye",
  [
    { id: "retinal_arteries", name: "Retinal arteries", description: "Branches of the central retinal artery visible on the inner retinal surface.", function: "Supply oxygenated blood to the inner layers of the retina." }
  ],
  []
);

extendOrgan(
  "pancreas",
  [
    { id: "pancreatic_lobule", name: "Pancreatic lobule", description: "Small anatomical subdivision of exocrine pancreatic tissue containing acini and ducts.", function: "Organizes enzyme-producing acini and their drainage into the duct system." },
    { id: "accessory_pancreatic_duct", name: "Accessory pancreatic duct", description: "Secondary pancreatic drainage channel, also called the duct of Santorini.", function: "May deliver pancreatic secretions into the duodenum through the minor papilla." }
  ],
  []
);

extendOrgan(
  "spleen",
  [
    { id: "splenic_trabecula", name: "Trabecula", description: "Connective-tissue band extending inward from the splenic capsule.", function: "Supports splenic tissue and carries vessels through the organ." },
    { id: "splenic_artery", name: "Splenic artery", description: "Artery entering the spleen at the hilum, usually a branch of the celiac trunk.", function: "Supplies oxygenated blood to splenic tissue." },
    { id: "splenic_vein", name: "Splenic vein", description: "Vein leaving the spleen at the hilum.", function: "Drains splenic blood toward the portal venous system." },
    { id: "lymphoid_follicles", name: "Lymphoid follicles", description: "Immune-cell aggregates within the spleen's white pulp.", function: "Support immune responses to antigens carried in the blood." }
  ],
  []
);

extendOrgan(
  "vascular-system",
  [
    { id: "heart", name: "Heart", description: "Muscular pump at the center of the circulatory system.", function: "Generates the pressure that moves blood through pulmonary and systemic circuits." },
    { id: "common_iliac_vein", name: "Common iliac vein", description: "Large pelvic vein formed by the internal and external iliac veins.", function: "Returns blood from the lower limb and pelvis toward the inferior vena cava." },
    { id: "anterior_tibial_artery", name: "Anterior tibial artery", description: "Artery of the anterior leg compartment that continues onto the dorsum of the foot.", function: "Supplies the anterior leg and dorsal foot." },
    { id: "posterior_tibial_artery", name: "Posterior tibial artery", description: "Artery descending in the posterior leg behind the medial malleolus.", function: "Supplies the posterior leg and plantar foot." }
  ],
  []
);

extendOrgan(
  "skeleton",
  [
    { id: "mandible", name: "Mandible", description: "Lower jawbone and the only freely movable bone of the skull.", function: "Supports the lower teeth and enables chewing and speech movements." },
    { id: "sternum", name: "Sternum", description: "Flat midline bone at the front of the thorax.", function: "Anchors ribs and clavicles and protects organs in the chest." },
    { id: "thorax", name: "Thorax", description: "Chest region bounded by the rib cage, sternum, and thoracic vertebrae.", function: "Protects the heart and lungs and supports respiration." },
    { id: "ulna", name: "Ulna", description: "Medial forearm bone on the little-finger side in anatomical position.", function: "Forms the main hinge of the elbow with the humerus." },
    { id: "radius", name: "Radius", description: "Lateral forearm bone on the thumb side in anatomical position.", function: "Rotates around the ulna to turn the palm." },
    { id: "sacrum", name: "Sacrum", description: "Triangular fused bone at the base of the vertebral column.", function: "Transfers weight from the spine to the pelvis." },
    { id: "patella", name: "Patella", description: "Sesamoid bone embedded in the quadriceps tendon at the front of the knee.", function: "Protects the knee and improves leverage of the quadriceps." },
    { id: "tibia", name: "Tibia", description: "Large medial weight-bearing bone of the lower leg.", function: "Transfers body weight from the knee to the ankle." },
    { id: "fibula", name: "Fibula", description: "Slender lateral bone of the lower leg.", function: "Stabilizes the ankle and provides muscle attachment." }
  ],
  []
);

export function findAtlasOrgan(identifier: string | null | undefined) {
  if (!identifier) {
    return atlasLibrary[0];
  }

  const normalized = slugify(identifier);

  // A card slug or an organ's exact name must always win. The previous fuzzy
  // lookup made "digestive-system" resolve to Pancreas because Pancreas has a
  // "digestive" alias and appears earlier in the library.
  const directMatch = atlasLibrary.find((organ) =>
    [organ.slug, organ.organName].some((term) => slugify(term) === normalized)
  );

  if (directMatch) {
    return directMatch;
  }

  const exactAliasMatch = atlasLibrary.find((organ) =>
    organ.aliases.some((alias) => slugify(alias) === normalized)
  );

  if (exactAliasMatch) {
    return exactAliasMatch;
  }

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
