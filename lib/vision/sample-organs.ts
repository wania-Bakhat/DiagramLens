import type {
  VisionExtractionResult,
  VisionPart,
  VisionRelationship
} from "./types";

export type SampleOrgan = {
  slug: string;
  organName: string;
  aliases: string[];
  summary: string;
  confidence: number;
  parts: VisionPart[];
  relationships: VisionRelationship[];
};

export const sampleOrganLibrary: SampleOrgan[] = [
  {
    slug: "heart",
    organName: "Heart",
    aliases: ["cardiac", "cardio", "aorta", "ventricle"],
    summary:
      "Structured extraction for a textbook heart diagram with chambers, valves, and flow relationships.",
    confidence: 0.97,
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
  }
];

export function pickSampleOrgan(fileName: string): SampleOrgan {
  const normalized = fileName.toLowerCase();

  return (
    sampleOrganLibrary.find((sample) =>
      [sample.slug, ...sample.aliases].some((term) => normalized.includes(term))
    ) ?? sampleOrganLibrary[0]
  );
}

export function buildExtractionResult(
  sample: SampleOrgan,
  sourceFileName: string
): VisionExtractionResult {
  return {
    organName: sample.organName,
    summary: sample.summary,
    confidence: sample.confidence,
    sourceFileName,
    parts: sample.parts,
    relationships: sample.relationships
  };
}

