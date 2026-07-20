import { NextResponse } from "next/server";
import { atlasLibrary, buildAtlasResult } from "@/lib/atlas";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type VisionCompletion = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function readModelJson(content: unknown) {
  if (typeof content !== "string") {
    return null;
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned) as { organSlug?: unknown };
  } catch {
    return null;
  }
}

function configuredProvider() {
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (openAIKey) {
    return {
      apiKey: openAIKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.6"
    };
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      apiKey: groqKey,
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model:
        process.env.GROQ_VISION_MODEL?.trim() ||
        "meta-llama/llama-4-scout-17b-16e-instruct"
    };
  }

  return null;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid image file." }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Choose an image to analyze." }, { status: 400 });
  }

  if (!supportedImageTypes.has(image.type)) {
    return NextResponse.json(
      { error: "Use a PNG, JPG, or WebP image for anatomy recognition." },
      { status: 415 }
    );
  }

  if (!image.size || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Use an image smaller than 3 MB for reliable visual analysis." },
      { status: 413 }
    );
  }

  const provider = configuredProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error:
          "Image recognition is not configured. Add OPENAI_API_KEY or GROQ_API_KEY to .env.local and restart the app."
      },
      { status: 503 }
    );
  }

  const base64Image = Buffer.from(await image.arrayBuffer()).toString("base64");
  const supportedOrgans = atlasLibrary.map((organ) => ({
    slug: organ.slug,
    name: organ.organName,
    aliases: organ.aliases
  }));
  const prompt = [
    "You classify a single medical anatomy image for BioLens.",
    "Inspect the image itself. Do not use the filename, labels in the filename, or assumed source.",
    "Choose exactly one best matching atlas organ from the supplied list. A connected whole digestive tract must map to digestive-system, not pancreas.",
    "If the image is not a clear match for one listed anatomical study, return null.",
    "Return only JSON in this exact shape: {\"organSlug\": \"one-of-the-listed-slugs\"} or {\"organSlug\": null}.",
    `Atlas organs: ${JSON.stringify(supportedOrgans)}`
  ].join("\n\n");

  let providerResponse: Response;
  try {
    providerResponse = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.type};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: 160
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    return NextResponse.json(
      { error: "The anatomy analysis service could not be reached. Please try again." },
      { status: 503 }
    );
  }

  if (!providerResponse.ok) {
    if (providerResponse.status === 401 || providerResponse.status === 403) {
      return NextResponse.json(
        {
          error:
            "Image recognition could not authenticate the configured API key. Update GROQ_API_KEY or add OPENAI_API_KEY, then restart the app."
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "The anatomy analysis service is temporarily unavailable. Please try again." },
      { status: providerResponse.status === 429 ? 429 : 502 }
    );
  }

  const completion = (await providerResponse.json().catch(() => null)) as VisionCompletion | null;
  const parsed = readModelJson(completion?.choices?.[0]?.message?.content);
  const organSlug = typeof parsed?.organSlug === "string" ? parsed.organSlug : null;
  const organ = atlasLibrary.find((entry) => entry.slug === organSlug);

  if (!organ) {
    return NextResponse.json(
      {
        error:
          "We could not confidently match that image to one of the available 3D anatomy studies. Try a clearer organ image."
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ result: buildAtlasResult(organ, image.name) });
}
