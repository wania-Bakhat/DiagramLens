"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent
} from "react";
import { AnatomyViewer } from "./anatomy-viewer";
import {
  atlasLibrary,
  buildAtlasResult,
  defaultAtlasOrgan,
  findAtlasOrgan,
  type AtlasOrgan
} from "@/lib/atlas";
import { visionAdapter, type VisionExtractionResult } from "@/lib/vision";

const howItWorks = [
  {
    index: "01",
    title: "Browse or upload",
    detail:
      "Pick one of the atlas cards or upload a textbook image. Both routes feed the same anatomy viewer shell."
  },
  {
    index: "02",
    title: "Map the labels",
    detail:
      "The mock vision adapter returns structured organ JSON with parts, relationships, and model metadata."
  },
  {
    index: "03",
    title: "Study in 3D",
    detail:
      "Click labels, rotate the model, toggle layers, and read grounded tutor notes that can later switch to a real LLM."
  }
];

type ViewMode = "atlas" | "upload";

function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="h-10 w-10" fill="none">
      <defs>
        <linearGradient id="brand-mark-gradient" x1="8" y1="6" x2="32" y2="34">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="52%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="4"
        width="32"
        height="32"
        rx="12"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.12)"
      />
      <path
        d="M11 23.5C13 18.2 15.6 14.5 20 14.5C24.4 14.5 27 18.2 29 23.5"
        stroke="url(#brand-mark-gradient)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M13 28C14.5 25.2 16.8 23.5 20 23.5C23.2 23.5 25.5 25.2 27 28"
        stroke="url(#brand-mark-gradient)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="20" cy="18" r="2.3" fill="#fff" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 2l1.7 5.5L19 9.2l-5.3 1.7L12 16l-1.7-5.1L5 9.2l5.3-1.7L12 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18 14l.8 2.6L21 17.4l-2.2.8L18 21l-.8-2.8-2.2-.8 2.2-.8L18 14z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M12 16V5m0 0l-4 4m4-4 4 4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M5 12h14m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatTile({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-white/[0.45]">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium leading-6 text-white/[0.84]">
        {value}
      </p>
    </div>
  );
}

function StepRow({
  index,
  title,
  detail
}: {
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid gap-4 border-b border-white/10 py-5 md:grid-cols-[72px_minmax(0,1fr)] md:gap-8">
      <div className="text-xs uppercase tracking-[0.32em] text-white/[0.45]">
        {index}
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-white/[0.64]">
          {detail}
        </p>
      </div>
    </div>
  );
}

function buildAtlasPreviewResult(organ: AtlasOrgan): VisionExtractionResult {
  return buildAtlasResult(organ, `${organ.slug}-atlas-diagram.png`);
}

function AtlasCard({
  organ,
  active,
  isPending,
  onSelect
}: {
  organ: AtlasOrgan;
  active: boolean;
  isPending: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-[1.9rem] border p-4 text-left transition duration-300 hover:-translate-y-1 ${
        active
          ? "border-white/20 bg-white/[0.08] shadow-[0_24px_70px_rgba(8,15,34,0.4)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/18 hover:bg-white/[0.06]"
      } ${isPending ? "opacity-90" : ""}`}
      style={{
        boxShadow: active ? `0 0 0 1px ${organ.theme.glow}` : undefined
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at top left, ${organ.theme.glow}, transparent 56%)`
        }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.34em] text-white/[0.42]">
            {organ.category}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{organ.organName}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/[0.64]">
            {organ.summary}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-[0.62rem] uppercase tracking-[0.22em] ${
            active
              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/[0.04] text-white/60"
          }`}
        >
          {active ? "Selected" : `${organ.parts.length} labels`}
        </span>
      </div>

      <div className="relative mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_132px]">
        <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-white/[0.42]">
            Diagram
          </p>
          <p className="mt-2 text-sm font-semibold text-white">{organ.diagramTitle}</p>
          <p className="mt-1 text-sm leading-6 text-white/[0.58]">
            {organ.diagramSubtitle}
          </p>
          <p className="mt-4 text-xs leading-6 text-white/45">
            {organ.studyFocus}
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-white/[0.42]">
            3D model
          </p>
          <div className="mt-3 flex h-24 items-center justify-center rounded-[1.2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
            <div
              className="h-14 w-14 rounded-full"
              style={{
                background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9), ${organ.theme.accent} 55%, ${organ.theme.glow} 100%)`
              }}
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">{organ.model.assetLabel}</p>
          <p className="mt-1 text-xs leading-5 text-white/[0.54]">
            {organ.model.assetFileName}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 text-[0.65rem] uppercase tracking-[0.28em] text-white/[0.46]">
        <span>{organ.model.statusLabel}</span>
        <span>{active ? "Loaded in viewer" : "Load into viewer"}</span>
      </div>
    </button>
  );
}

export default function Home() {
  const [selectedAtlasSlug, setSelectedAtlasSlug] = useState(defaultAtlasOrgan.slug);
  const [viewMode, setViewMode] = useState<ViewMode>("atlas");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<VisionExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAtlasPending, startAtlasTransition] = useTransition();

  const selectedAtlas = useMemo(
    () => findAtlasOrgan(selectedAtlasSlug),
    [selectedAtlasSlug]
  );
  const uploadPreviewOrgan = useMemo(
    () => (selectedFile ? findAtlasOrgan(selectedFile.name) : null),
    [selectedFile]
  );
  const atlasPreviewResult = useMemo(
    () => buildAtlasPreviewResult(selectedAtlas),
    [selectedAtlas]
  );
  const uploadPreviewResult = useMemo(() => {
    if (!selectedFile) {
      return atlasPreviewResult;
    }

    return buildAtlasPreviewResult(uploadPreviewOrgan ?? selectedAtlas);
  }, [selectedFile, uploadPreviewOrgan, selectedAtlas, atlasPreviewResult]);
  const currentResult = useMemo<VisionExtractionResult>(() => {
    if (viewMode === "upload") {
      return analysis ?? uploadPreviewResult;
    }

    return atlasPreviewResult;
  }, [analysis, atlasPreviewResult, uploadPreviewResult, viewMode]);
  const currentOrgan = useMemo(
    () => findAtlasOrgan(currentResult.organSlug ?? currentResult.organName),
    [currentResult.organName, currentResult.organSlug]
  );
  const heroStats = useMemo(
    () => [
      {
        label: "Atlas library",
        value: `${atlasLibrary.length} major organs`
      },
      {
        label: "Current focus",
        value: currentOrgan.organName
      },
      {
        label: "3D preset",
        value: currentOrgan.model.assetLabel
      }
    ],
    [currentOrgan]
  );

  useEffect(() => {
    if (!selectedFile) {
      setAnalysis(null);
      setIsExtracting(false);
      setViewMode("atlas");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    let active = true;

    setAnalysis(null);
    setError(null);
    setIsExtracting(true);
    setViewMode("upload");
    setIsViewerOpen(true);

    void visionAdapter
      .extract({
        file: selectedFile,
        imageUrl: previewUrl
      })
      .then((result) => {
        if (!active) {
          return;
        }

        setAnalysis(result);
        setIsExtracting(false);
      })
      .catch((exception) => {
        if (!active) {
          return;
        }

        setError(
          exception instanceof Error
            ? exception.message
            : "Unable to extract anatomy from the uploaded diagram."
        );
        setIsExtracting(false);
      });

    return () => {
      active = false;
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!isViewerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsViewerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isViewerOpen]);

  function selectAtlas(organ: AtlasOrgan) {
    startAtlasTransition(() => {
      setSelectedAtlasSlug(organ.slug);
      setViewMode("atlas");
      setError(null);
    });
  }

  function acceptFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file such as PNG, JPG, or WebP.");
      return;
    }

    setError(null);
    setSelectedFile(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function handleClear() {
    setSelectedFile(null);
    setAnalysis(null);
    setIsExtracting(false);
    setError(null);
    setViewMode("atlas");
    setIsViewerOpen(false);
  }

  const sourceTitle =
    viewMode === "upload" && selectedFile
      ? selectedFile.name
      : `${currentOrgan.organName} atlas`;
  const sourceSubtitle =
    viewMode === "upload" && selectedFile
      ? selectedFile.type || "image/*"
      : currentOrgan.model.statusLabel;
  const sourceStatus =
    viewMode === "upload" && selectedFile
      ? isExtracting
        ? "Mapping diagram into JSON"
        : analysis
          ? "Extraction complete"
          : "Upload in progress"
      : "Atlas preview";

  return (
    <main id="top" className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(251, 113, 133, 0.18), transparent 24%), radial-gradient(circle at 82% 14%, rgba(56, 189, 248, 0.16), transparent 22%), radial-gradient(circle at 50% 92%, rgba(52, 211, 153, 0.08), transparent 28%), linear-gradient(180deg, #050816 0%, #09111f 44%, #04070f 100%)"
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          WebkitMaskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 52%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 52%, transparent 100%)"
        }}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-16 pt-5 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4 rounded-full border border-white/10 bg-white/5 px-4 py-3 shadow-glow backdrop-blur-xl md:px-5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-[0.65rem] uppercase tracking-[0.36em] text-white/[0.45]">
                DiagramLens
              </p>
              <p className="text-sm text-white/[0.78]">
                Anatomy atlas and guided study
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-white/[0.65] md:flex">
            <a className="transition hover:text-white" href="#atlas">
              Atlas
            </a>
            <a className="transition hover:text-white" href="#workspace">
              Workspace
            </a>
            <a className="transition hover:text-white" href="#how-it-works">
              How it works
            </a>
          </nav>

          <a
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
            href="#workspace"
          >
            Start studying
            <ArrowIcon />
          </a>
        </header>

        <section className="mt-16 max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-white/60 backdrop-blur">
            <SparkIcon />
            Mock vision adapter and tutor
          </div>

          <div className="mt-8 space-y-6">
            <h1 className="max-w-5xl font-display text-5xl font-semibold leading-[0.92] tracking-[-0.05em] text-balance text-white md:text-6xl xl:text-7xl">
              Turn textbook anatomy into a living study atlas.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/[0.72] md:text-xl">
              Choose an organ card or upload a textbook diagram. DiagramLens
              returns structured anatomy JSON, opens a clean 3D study view, and
              surfaces grounded tutor notes that are ready to swap to a real LLM
              later.
            </p>
            <p className="max-w-2xl text-sm uppercase tracking-[0.28em] text-white/[0.45]">
              Current study focus: {currentOrgan.studyFocus}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#atlas"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
            >
              Browse atlas
              <ArrowIcon />
            </a>
            <a
              href="#workspace"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/[0.85] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
            >
              Upload diagram
            </a>
          </div>

          <div className="mt-10 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <StatTile key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </section>

        <section id="atlas" className="mt-24">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.3em] text-white/[0.45]">
                Atlas library
              </p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
                Pick a body system and keep the study flow focused.
              </h2>
              <p className="mt-3 max-w-2xl text-white/[0.64]">
                Each card is wired to its own diagram labels, 3D model metadata,
                and relationship data so the viewer can swap between organs
                without changing the app shell.
              </p>
            </div>

            <div className="hidden w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur-xl xl:block">
              <p className="text-xs uppercase tracking-[0.3em] text-white/[0.45]">
                Current selection
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {currentOrgan.organName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/[0.64]">
                {currentOrgan.summary}
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-white/[0.45]">
                  Loader hint
                </p>
                <p className="mt-2 text-sm leading-6 text-white/[0.72]">
                  {currentOrgan.model.loaderHint}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {atlasLibrary.map((organ) => (
              <AtlasCard
                key={organ.slug}
                organ={organ}
                active={organ.slug === selectedAtlas.slug}
                isPending={isAtlasPending}
                onSelect={() => selectAtlas(organ)}
              />
            ))}
          </div>
        </section>

        <section
          id="workspace"
          className="mt-24 grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start"
        >
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/[0.45]">
                  Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Upload a diagram or keep browsing the atlas
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/[0.65]">
                  This shell is built for either route. Upload a textbook figure
                  to trigger the mock extraction service, or keep the currently
                  selected atlas organ in study mode.
                </p>
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100">
                Ready
              </span>
            </div>

            <div
              className={`mt-6 rounded-[1.7rem] border border-dashed p-6 transition ${
                isDragging
                  ? "border-cyan-300 bg-cyan-500/[0.08]"
                  : "border-white/15 bg-slate-950/[0.28]"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => {
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] text-white/[0.85]">
                    <UploadIcon />
                  </div>
                  <div>
                    <p className="text-base font-medium text-white">
                      Drag and drop an image
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/[0.58]">
                      PNG, JPG, WebP, or HEIC. The viewer updates as soon as a
                      file is chosen.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5">
                    Choose file
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleInputChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsViewerOpen((current) => !current)}
                    className={`inline-flex items-center justify-center rounded-full border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      isViewerOpen
                        ? "border-amber-300/30 bg-amber-500/10 text-amber-50 hover:bg-amber-500/15"
                        : "border-cyan-300/30 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/15"
                    }`}
                  >
                    {isViewerOpen ? "Exit full screen" : "Open full screen"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] uppercase tracking-[0.26em] text-white/[0.5]">
                    Image only
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] uppercase tracking-[0.26em] text-white/[0.5]">
                    Drag & drop
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.26em] text-emerald-100">
                    Tutor ready
                  </span>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/[0.45]">
                    Current source
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-base font-medium text-white">{sourceTitle}</p>
                    <p className="text-sm text-white/[0.58]">{sourceSubtitle}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      {sourceStatus}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="result">
            {isViewerOpen ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.32em] text-white/[0.45]">
                  Immersive mode
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Full-screen study mode is open
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/[0.65]">
                  {viewMode === "upload"
                    ? "The uploaded diagram is being studied in full screen. Press Escape or use the close button to return to the inline preview."
                    : `You are studying ${currentOrgan.organName} in full screen. Press Escape or use the close button to return to the inline preview.`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.24em] text-white/55">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    {currentOrgan.model.assetLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    {currentOrgan.parts.length} labels
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    {currentOrgan.model.statusLabel}
                  </span>
                </div>
              </div>
            ) : (
              <AnatomyViewer result={currentResult} isLoading={isExtracting} />
            )}
          </div>
        </section>

        <section id="how-it-works" className="mt-24 pb-4">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/[0.45]">
              How it works
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              Small adapter today, real model later.
            </h2>
            <p className="mt-3 max-w-xl text-white/[0.64]">
              The page only depends on a simple extraction interface, so the
              mock vision layer can later swap to a production model without
              changing the rest of the experience.
            </p>
          </div>

          <div className="mt-8 border-t border-white/10">
            {howItWorks.map((step) => (
              <StepRow key={step.index} {...step} />
            ))}
          </div>
        </section>

        <footer className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/[0.45] md:flex-row md:items-center md:justify-between">
          <p>
            DiagramLens returns structured anatomy JSON, atlas metadata, and
            tutor-ready study notes from a mock pipeline.
          </p>
          <a
            className="inline-flex items-center gap-2 text-white/70 transition hover:text-white"
            href="#top"
          >
            Back to top
            <ArrowIcon />
          </a>
        </footer>
      </div>

      {isViewerOpen ? (
        <AnatomyViewer
          result={currentResult}
          isLoading={isExtracting}
          fullscreen
          onExitFullscreen={() => setIsViewerOpen(false)}
        />
      ) : null}
    </main>
  );
}
