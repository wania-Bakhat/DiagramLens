import { NextResponse } from "next/server";
import { atlasLibrary } from "@/lib/atlas";

export const runtime = "nodejs";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequest = {
  organSlug?: unknown;
  selectedPartId?: unknown;
  messages?: unknown;
};

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_REQUEST_CHARACTERS = 6_000;
const MAX_REQUESTS_PER_MINUTE = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestTimestamps = new Map<string, number[]>();

function getClientId(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: Request) {
  const clientId = getClientId(request);
  const now = Date.now();
  const recentRequests = (requestTimestamps.get(clientId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    requestTimestamps.set(clientId, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestTimestamps.set(clientId, recentRequests);
  return false;
}

function isChatRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant";
}

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return null;
  }

  let characterCount = 0;
  const messages: ChatMessage[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (!isChatRole(role) || typeof content !== "string") {
      return null;
    }

    const cleanedContent = content.trim();
    if (!cleanedContent || cleanedContent.length > MAX_MESSAGE_LENGTH) {
      return null;
    }

    characterCount += cleanedContent.length;
    if (characterCount > MAX_REQUEST_CHARACTERS) {
      return null;
    }

    messages.push({ role, content: cleanedContent });
  }

  return messages.at(-1)?.role === "user" ? messages : null;
}

function buildDiagramContext(organSlug: string, selectedPartId: string | null) {
  const organ = atlasLibrary.find((entry) => entry.slug === organSlug);
  if (!organ) {
    return null;
  }

  const partsById = new Map(organ.parts.map((part) => [part.id, part]));
  const selectedPart = selectedPartId
    ? partsById.get(selectedPartId) ?? null
    : null;

  return {
    organ: {
      name: organ.organName,
      summary: organ.summary,
      studyFocus: organ.studyFocus,
      diagramTitle: organ.diagramTitle
    },
    selectedStructure: selectedPart
      ? {
          name: selectedPart.name,
          description: selectedPart.description,
          function: selectedPart.function
        }
      : null,
    availableStructures: organ.parts.map((part) => ({
      id: part.id,
      name: part.name,
      description: part.description,
      function: part.function
    })),
    mappedRelationships: organ.relationships.flatMap((relationship) => {
      const source = partsById.get(relationship.sourcePartId);
      const target = partsById.get(relationship.targetPartId);
      return source && target
        ? [{ from: source.name, relation: relationship.relation, to: target.name }]
        : [];
    })
  };
}

function getProviderErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return "Groq could not authenticate the configured API key. Add a valid GROQ_API_KEY to .env.local and restart the app.";
  }

  if (status === 429) {
    return "Groq's request limit has been reached. Please wait a moment and try again.";
  }

  return "The AI tutor is temporarily unavailable. Please try again shortly.";
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: "Please wait a moment before sending another question." },
      { status: 429 }
    );
  }

  let payload: ChatRequest;
  try {
    payload = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (typeof payload.organSlug !== "string" || payload.organSlug.length > 80) {
    return NextResponse.json({ error: "Invalid diagram context." }, { status: 400 });
  }

  const selectedPartId =
    typeof payload.selectedPartId === "string" && payload.selectedPartId.length <= 120
      ? payload.selectedPartId
      : null;
  const messages = parseMessages(payload.messages);
  const diagramContext = buildDiagramContext(payload.organSlug, selectedPartId);

  if (!messages || !diagramContext) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The AI tutor is not configured yet. Add GROQ_API_KEY to .env.local and restart the app."
      },
      { status: 503 }
    );
  }

  const systemPrompt = [
    "You are BioLens AI Tutor, a concise and medically accurate anatomy study assistant.",
    "Answer the student's question using the trusted diagram context below. Treat the selected structure and the available structure list as the source of truth for this diagram.",
    "If a requested detail is not shown or mapped in this diagram, say so clearly. You may give brief, well-established anatomy context, but do not invent labels, locations, or relationships.",
    "Format study answers as clean Markdown: use short ## headings for distinct sections, bullet lists for multiple structures, and **bold** for important anatomy terms. Do not use tables, raw HTML, or code fences, and do not include a title when a direct answer is clearer.",
    "Use plain language, define unfamiliar terms briefly, and keep answers focused on learning. Do not diagnose, provide personal medical advice, or tell a user how to treat symptoms.",
    `Trusted diagram context:\n${JSON.stringify(diagramContext)}`
  ].join("\n\n");

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.2,
        max_tokens: 450
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    return NextResponse.json(
      { error: "The AI tutor could not reach Groq. Please try again." },
      { status: 503 }
    );
  }

  if (!providerResponse.ok) {
    return NextResponse.json(
      { error: getProviderErrorMessage(providerResponse.status) },
      { status: providerResponse.status === 429 ? 429 : 502 }
    );
  }

  const completion = (await providerResponse.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  } | null;
  const reply = completion?.choices?.[0]?.message?.content;

  if (typeof reply !== "string" || !reply.trim()) {
    return NextResponse.json(
      { error: "The AI tutor returned an empty response. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply: reply.trim() });
}
