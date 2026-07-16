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
  referenceAssetUrl: string | string[];
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
      assetLabel: "Human Reference Atlas heart",
      assetFileName: "VH_M_Heart.glb",
      referenceAssetUrl: "/models/human-reference-atlas/heart.glb",
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the bundled Human Reference Atlas heart GLB; its chambers and valves remain independently selectable.",
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
      assetLabel: "Human Reference Atlas lungs",
      assetFileName: "VH_M_Lung.glb",
      referenceAssetUrl: "/models/human-reference-atlas/lungs.glb",
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the bundled Human Reference Atlas respiratory GLB with separable airway branches and lobes.",
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
      assetLabel: "Allen Human Reference Brain",
      assetFileName: "Allen_F_Brain.glb",
      referenceAssetUrl: "/models/human-reference-atlas/brain.glb",
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the bundled Allen / Human Reference Atlas brain GLB with its detailed anatomical hierarchy.",
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
      assetLabel: "Human Reference Atlas kidney pair",
      assetFileName: "VH_M_Kidney_L.glb + VH_M_Kidney_R.glb",
      referenceAssetUrl: [
        "/models/human-reference-atlas/kidney-left.glb",
        "/models/human-reference-atlas/kidney-right.glb"
      ],
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the bundled left and right Human Reference Atlas kidney GLBs as one paired study model.",
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
      assetLabel: "Human Reference Atlas eye",
      assetFileName: "VH_M_Eye_L.glb",
      referenceAssetUrl: "/models/human-reference-atlas/eye-left.glb",
      referenceAttribution: humanReferenceAtlasAttribution,
      loaderHint: "Loads the bundled Human Reference Atlas eye GLB with separable optical structures.",
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

// The bundled HuBMAP meshes are intentionally concise. These expanded study
// maps keep the viewer useful as an atlas: every important region gets a label
// and a connected explanation, even when the source mesh groups it with a
// neighbouring structure.
extendOrgan(
  "heart",
  [
    { id: "superior_vena_cava", name: "Superior vena cava", description: "Large vein entering the right atrium from above.", function: "Returns oxygen-poor blood from the head and upper body." },
    { id: "inferior_vena_cava", name: "Inferior vena cava", description: "Large vein entering the right atrium from below.", function: "Returns oxygen-poor blood from the lower body." },
    { id: "pulmonary_artery", name: "Pulmonary artery", description: "Artery leaving the right ventricle for the lungs.", function: "Carries oxygen-poor blood to the lungs for gas exchange." },
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
    { id: "left_kidney", name: "Left kidney", description: "Left-sided kidney shown as part of the paired renal study.", function: "Filters blood and helps regulate fluid, electrolytes, and blood pressure." },
    { id: "right_kidney", name: "Right kidney", description: "Right-sided kidney shown as part of the paired renal study.", function: "Filters blood and helps regulate fluid, electrolytes, and blood pressure." },
    { id: "renal_vein", name: "Renal vein", description: "Vessel carrying filtered blood away from the kidney.", function: "Returns blood to the central circulation after renal processing." },
    { id: "renal_pyramids", name: "Renal pyramids", description: "Triangular structures within the medulla.", function: "Concentrate urine and pass it toward the renal pelvis." }
  ],
  [
    { sourcePartId: "left_kidney", targetPartId: "renal_cortex", relation: "contains" },
    { sourcePartId: "right_kidney", targetPartId: "renal_cortex", relation: "contains" },
    { sourcePartId: "renal_artery", targetPartId: "renal_vein", relation: "returns through" },
    { sourcePartId: "renal_medulla", targetPartId: "renal_pyramids", relation: "contains" },
    { sourcePartId: "renal_pyramids", targetPartId: "renal_pelvis", relation: "drain into" }
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
    assetLabel: "Human Reference Atlas pancreas",
    assetFileName: "3d-vh-m-pancreas.glb",
    referenceAssetUrl: `${humanReferenceAtlasAssetBase}/pancreas-male/v1.2/assets/3d-vh-m-pancreas.glb`,
    referenceAttribution: humanReferenceAtlasAttribution,
    loaderHint: "Loads the Human Reference Atlas pancreas GLB with a clear museum-style study presentation.",
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
