import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  isCustomLabelModelKey,
  normaliseCustomLabels,
  type ProjectCustomLabelFile
} from "@/lib/custom-labels";

export const runtime = "nodejs";

const labelFilePath = path.join(process.cwd(), "data", "custom-labels.json");

function emptyProjectLabels(): ProjectCustomLabelFile {
  return { version: 1, models: {} };
}

async function readProjectLabels(): Promise<ProjectCustomLabelFile> {
  try {
    const contents = await readFile(labelFilePath, "utf8");
    const parsed: unknown = JSON.parse(contents);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyProjectLabels();
    }

    const candidate = parsed as Partial<ProjectCustomLabelFile>;
    if (!candidate.models || typeof candidate.models !== "object") {
      return emptyProjectLabels();
    }

    const models: Record<string, ReturnType<typeof normaliseCustomLabels>> = {};
    for (const [modelKey, labels] of Object.entries(candidate.models)) {
      if (isCustomLabelModelKey(modelKey)) {
        models[modelKey] = normaliseCustomLabels(labels);
      }
    }

    return { version: 1, models };
  } catch {
    return emptyProjectLabels();
  }
}

export async function PUT(request: Request) {
  // A deployed static/site build cannot safely mutate the checked-in source.
  // In that case the UI retains its local-browser fallback and this endpoint
  // remains closed. Local development writes the file that the author commits.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Project label publishing is available while running locally." },
      { status: 403 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid label payload." }, { status: 400 });
  }

  const { modelKey, labels } = payload as {
    modelKey?: unknown;
    labels?: unknown;
  };

  if (!isCustomLabelModelKey(modelKey) || !Array.isArray(labels)) {
    return NextResponse.json({ error: "Invalid label data." }, { status: 400 });
  }

  const normalisedLabels = normaliseCustomLabels(labels);
  if (normalisedLabels.length !== labels.length || normalisedLabels.length > 250) {
    return NextResponse.json({ error: "One or more labels are invalid." }, { status: 400 });
  }

  const projectLabels = await readProjectLabels();
  projectLabels.models[modelKey] = normalisedLabels;

  try {
    await mkdir(path.dirname(labelFilePath), { recursive: true });
    const temporaryPath = `${labelFilePath}.tmp`;
    await writeFile(
      temporaryPath,
      `${JSON.stringify(projectLabels, null, 2)}\n`,
      "utf8"
    );
    await rename(temporaryPath, labelFilePath);
  } catch {
    return NextResponse.json(
      { error: "Unable to write the project label file." },
      { status: 500 }
    );
  }

  return NextResponse.json({ labels: normalisedLabels });
}
