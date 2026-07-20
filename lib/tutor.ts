import type { AtlasOrgan } from "./atlas";
import type {
  VisionExtractionResult,
  VisionPart
} from "./vision/types";

export type TutorRelatedStructure = {
  id: string;
  name: string;
  relation: string;
  direction: "incoming" | "outgoing";
  detail: string;
};

export type TutorResponse = {
  provider: "mock" | "api";
  explanation: string;
  function: string;
  relatedStructures: TutorRelatedStructure[];
  quizQuestions: string[];
  studyTip: string;
};

export type TutorInput = {
  organ: AtlasOrgan;
  result: VisionExtractionResult;
  part: VisionPart;
};

export interface TutorAdapter {
  explainPart(input: TutorInput): Promise<TutorResponse>;
}

type TutorMessage = {
  role: "system" | "user";
  content: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRelatedStructures(input: TutorInput): TutorRelatedStructure[] {
  const partsById = new Map(input.result.parts.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const related: TutorRelatedStructure[] = [];

  for (const relationship of input.result.relationships) {
    if (relationship.sourcePartId === input.part.id) {
      const target = partsById.get(relationship.targetPartId);
      if (target) {
        const key = `out:${target.id}:${relationship.relation}`;
        if (!seen.has(key)) {
          seen.add(key);
          related.push({
            id: target.id,
            name: target.name,
            relation: relationship.relation,
            direction: "outgoing",
            detail: `${input.part.name} ${relationship.relation} ${target.name.toLowerCase()}.`
          });
        }
      }
    }

    if (relationship.targetPartId === input.part.id) {
      const source = partsById.get(relationship.sourcePartId);
      if (source) {
        const key = `in:${source.id}:${relationship.relation}`;
        if (!seen.has(key)) {
          seen.add(key);
          related.push({
            id: source.id,
            name: source.name,
            relation: relationship.relation,
            direction: "incoming",
            detail: `${source.name} ${relationship.relation} ${input.part.name.toLowerCase()}.`
          });
        }
      }
    }
  }

  return related.slice(0, 4);
}

function buildQuizQuestions(input: TutorInput, related: TutorRelatedStructure[]) {
  const studyFocus = input.organ.studyFocus.toLowerCase();
  const anchor = related[0]?.name ?? input.organ.organName.toLowerCase();

  return [
    `Which job does ${input.part.name} perform in this ${input.organ.organName.toLowerCase()} diagram?`,
    `How does ${input.part.name} connect with ${anchor}?`,
    `Explain how ${input.part.name} supports ${studyFocus} in one sentence.`
  ];
}

function buildTutorPromptMessages(input: TutorInput): TutorMessage[] {
  return [
    {
      role: "system",
      content:
        "You are BioLens Tutor, an anatomy study assistant for students. Stay concise, factual, and diagram-grounded. Return JSON with explanation, function, relatedStructures, quizQuestions, and studyTip. Do not sound like a generic chatbot."
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          organ: {
            slug: input.organ.slug,
            organName: input.organ.organName,
            summary: input.organ.summary,
            studyFocus: input.organ.studyFocus
          },
          part: input.part,
          availableLabels: input.result.parts.map((entry) => entry.name),
          relationships: input.result.relationships
        },
        null,
        2
      )
    }
  ];
}

function buildMockTutorResponse(input: TutorInput): TutorResponse {
  const relatedStructures = buildRelatedStructures(input);
  const relatedAnchor = relatedStructures[0]?.name ?? input.organ.organName;
  const focus = input.organ.studyFocus.toLowerCase();

  return {
    provider: "mock",
    explanation:
      `${input.part.name} is a key anchor in the ${input.organ.organName.toLowerCase()} diagram. ` +
      `${input.part.description} Students should use it to orient themselves before tracing ${focus}. ` +
      `In this atlas view, it sits alongside ${relatedAnchor.toLowerCase()} so the visual pathway stays easy to follow.`,
    function: input.part.function,
    relatedStructures,
    quizQuestions: buildQuizQuestions(input, relatedStructures),
    studyTip:
      `${input.organ.diagramTitle}: start with ${input.part.name} and then trace the connected structures one by one.`
  };
}

export function buildTutorMessages(input: TutorInput) {
  return buildTutorPromptMessages(input);
}

export const mockTutorAdapter: TutorAdapter = {
  async explainPart(input: TutorInput) {
    const messages = buildTutorMessages(input);
    void messages;
    await delay(280);
    return buildMockTutorResponse(input);
  }
};

export const tutorAdapter = mockTutorAdapter;
