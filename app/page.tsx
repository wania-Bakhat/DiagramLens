"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent
} from "react";
import Lenis from "lenis";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
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
      "Choose a reference organ or upload a medical diagram to begin an immersive study session."
  },
  {
    index: "02",
    title: "Map the labels",
    detail:
      "Explore connected structures, functions, and relationships without losing sight of the model."
  },
  {
    index: "03",
    title: "Study in 3D",
    detail:
      "Rotate the anatomy, select a structure, and use guided notes to reinforce what you see."
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

const swapAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function RandomLetterSwap({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState(text);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.clearInterval(frameRef.current);
      }
    };
  }, []);

  const animate = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (frameRef.current !== null) {
      window.clearInterval(frameRef.current);
    }

    let step = 0;
    frameRef.current = window.setInterval(() => {
      const revealed = Math.floor(step / 2);
      setDisplayText(
        text
          .split("")
          .map((character, index) => {
            if (character === " " || index < revealed) {
              return character;
            }
            return swapAlphabet[(step * 7 + index * 11) % swapAlphabet.length];
          })
          .join("")
      );

      step += 1;
      if (step > text.length * 2) {
        if (frameRef.current !== null) {
          window.clearInterval(frameRef.current);
          frameRef.current = null;
        }
        setDisplayText(text);
      }
    }, 38);
  };

  return (
    <span
      aria-label={text}
      className="inline-block cursor-default select-none"
      onFocus={animate}
      onMouseEnter={animate}
      tabIndex={0}
    >
      <span aria-hidden="true">{displayText}</span>
    </span>
  );
}

const medicalCardImageByOrgan: Record<string, string> = {
  heart: "/images/heart.png",
  lungs: "/images/lungs.png",
  brain: "/images/brain.png",
  kidneys: "/images/kidneys.png",
  liver: "/images/liver.png",
  eye: "/images/eye.png",
  pancreas: "/images/pancreas.png",
  "digestive-system": "/images/digestive-system.png",
  spleen: "/images/spleen.png",
  "vascular-system": "/images/vascular.png",
  skeleton: "/images/skeleton.png",
  "human-body": "/images/human-body.png"
};

function AtlasModelPreview({ organ }: { organ: AtlasOrgan }) {
  const tone = organ.theme.accent;
  const surfaceId = `${organ.slug}-model-surface`;
  const previewSource = medicalCardImageByOrgan[organ.slug];
  const [previewFailed, setPreviewFailed] = useState(false);
  const shared = {
    fill: `url(#${surfaceId})`,
    stroke: "rgba(255,255,255,0.52)",
    strokeWidth: 1.2
  };

  const specimen = (() => {
    switch (organ.slug) {
      case "heart":
        return <path {...shared} d="M50 85C27 65 18 49 22 34c4-15 24-20 34-4 11-16 31-11 35 4 4 15-5 31-28 51l-13 12Z" />;
      case "brain":
        return <path {...shared} d="M21 57c-6-15 5-28 17-27 3-15 22-19 31-8 15-8 29 5 25 20 13 9 6 31-10 31-7 14-28 12-34 2-12 7-28-3-24-18-3 1-4 1-5 0Z" />;
      case "lungs":
        return <><path {...shared} d="M48 32v19c-17-13-31 3-28 28 2 16 12 24 28 25V57" /><path {...shared} d="M52 32v19c17-13 31 3 28 28-2 16-12 24-28 25V57" /><path d="M48 18h4v39h-4z" fill="rgba(224,242,254,.9)" /></>;
      case "kidneys":
        return <><path {...shared} d="M44 28c-23-7-31 13-22 35 6 15 22 18 31 6-9-18-4-31-9-41Z" /><path {...shared} d="M56 28c23-7 31 13 22 35-6 15-22 18-31 6 9-18 4-31 9-41Z" /></>;
      case "liver":
        return <path {...shared} d="M17 57c7-25 28-37 58-33 13 2 17 10 14 22-3 15-18 27-38 27-20 0-31-4-34-16Z" />;
      case "eye":
        return <><path {...shared} d="M13 59C29 35 43 26 60 30c14 3 23 13 31 29-17 20-34 29-50 25-12-3-21-12-28-25Z" /><circle cx="52" cy="57" r="15" fill={tone} opacity=".78" /><circle cx="52" cy="57" r="6" fill="#020617" /></>;
      case "pancreas":
        return <path {...shared} d="M14 57c11-15 27-19 43-13 11-12 23-9 30 1 5 8-1 18-13 16-12 9-28 11-39 4-9 1-17-1-21-8Z" />;
      case "digestive-system":
        return <><path {...shared} d="M34 23c8-6 27-5 34 3 5 7-2 17-13 16-9 0-16-5-21-19Z" /><path d="M39 49c-14 0-18 20-5 21-15 13 8 23 16 8 6 15 28 5 14-8 13-11 4-23-7-18-5-8-13-7-18-3Z" fill={`url(#${surfaceId})`} stroke="rgba(255,255,255,.52)" strokeWidth="1.2" /></>;
      case "spleen":
        return <path {...shared} d="M28 31c18-15 43-5 45 13 2 17-10 38-29 36-20-2-29-28-16-49Z" />;
      case "vascular-system":
        return <path d="M50 18v75M50 38 28 53m22-7 24 15M36 58l-12 22m40-18 14 19M50 70l-16 25m16-25 16 25" fill="none" stroke={tone} strokeLinecap="round" strokeWidth="5" />;
      case "skeleton":
        return <path d="M50 18a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 18v26m-18-16 18 8 18-8M38 58l-7 27m31-27 7 27M50 62 37 96m13-34 13 34" fill="none" stroke={`url(#${surfaceId})`} strokeLinecap="round" strokeWidth="7" />;
      default:
        return <path {...shared} d="M50 15c16 10 28 25 27 43-1 20-12 33-27 42-15-9-26-22-27-42-1-18 11-33 27-43Z" />;
    }
  })();

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[1.15rem] border border-white/10 bg-slate-950/55">
      {previewSource && !previewFailed ? (
        <img
          src={previewSource}
          alt={`${organ.organName} medical reference image`}
          loading="lazy"
          onError={() => setPreviewFailed(true)}
          className="h-full w-full object-contain p-1.5 transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <svg viewBox="0 0 104 112" role="img" aria-label={`${organ.organName} 3D model preview`} className="h-[6.8rem] w-[6.8rem] drop-shadow-[0_12px_18px_rgba(0,0,0,0.42)]">
          <defs>
            <radialGradient id={surfaceId} cx="30%" cy="22%" r="82%">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".94" />
              <stop offset=".27" stopColor={tone} stopOpacity=".95" />
              <stop offset="1" stopColor="#0f172a" stopOpacity=".94" />
            </radialGradient>
          </defs>
          {specimen}
        </svg>
      )}
    </div>
  );
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
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.7 }}
      className={`group relative overflow-hidden rounded-[1.9rem] border p-4 text-left ${
        active
          ? "border-white/25 bg-white/[0.08] shadow-[0_24px_70px_rgba(8,15,34,0.4)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/18 hover:bg-white/[0.06]"
      } ${isPending ? "opacity-90" : ""}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 85% 8%, ${organ.theme.glow}, transparent 48%)`
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

        <div className="aspect-square rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-2.5">
          <AtlasModelPreview organ={organ} />
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 text-[0.65rem] uppercase tracking-[0.28em] text-white/[0.46]">
        <span>{organ.model.statusLabel}</span>
        <span>{active ? "Loaded in viewer" : "Load into viewer"}</span>
      </div>
    </motion.button>
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
  const [isStudyLaunching, setIsStudyLaunching] = useState(false);
  const [isAtlasPending, startAtlasTransition] = useTransition();
  const studyLaunchTimer = useRef<number | null>(null);

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
        label: "Study format",
        value: "Interactive 3D"
      }
    ],
    [currentOrgan]
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      autoRaf: true,
      anchors: { offset: -18 },
      lerp: 0.085,
      smoothWheel: true,
      stopInertiaOnNavigate: true,
      prevent: (node) =>
        node instanceof HTMLElement &&
        Boolean(node.closest("[data-lenis-prevent]"))
    });

    return () => lenis.destroy();
  }, []);

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

  useEffect(() => {
    return () => {
      if (studyLaunchTimer.current !== null) {
        window.clearTimeout(studyLaunchTimer.current);
      }
    };
  }, []);

  function selectAtlas(organ: AtlasOrgan) {
    if (studyLaunchTimer.current !== null) {
      window.clearTimeout(studyLaunchTimer.current);
    }

    setIsStudyLaunching(true);
    startAtlasTransition(() => {
      setSelectedAtlasSlug(organ.slug);
      setViewMode("atlas");
      setError(null);
    });
    studyLaunchTimer.current = window.setTimeout(() => {
      setIsViewerOpen(true);
      setIsStudyLaunching(false);
      studyLaunchTimer.current = null;
    }, 180);
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
    <MotionConfig reducedMotion="user">
    <main id="top" className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% -12%, rgba(148,163,184,0.18), transparent 36%), radial-gradient(ellipse at 88% 28%, rgba(30,41,59,0.52), transparent 34%), linear-gradient(180deg, #020617 0%, #080d17 46%, #02050b 100%)"
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
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
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl md:px-5"
        >
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
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.6, ease: "easeOut" }}
          className="flex min-h-[72svh] max-w-6xl flex-col justify-center py-16 md:min-h-[78svh] md:py-24"
        >
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5 }} className="space-y-7">
            <h1 className="font-display text-5xl font-semibold leading-[0.88] tracking-[-0.07em] text-white md:text-7xl xl:text-8xl">
              <RandomLetterSwap text="DiagramLens" />
            </h1>
            <p className="max-w-xl text-base leading-7 text-white/[0.58] md:text-lg">
              An interactive anatomy atlas for clear, focused study.
            </p>
          </motion.div>

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

          <div className="mt-14 grid max-w-3xl gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <StatTile key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </motion.section>

        <motion.section
          id="atlas"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="mt-24"
        >
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
                isPending={isAtlasPending || (isStudyLaunching && organ.slug === selectedAtlas.slug)}
                onSelect={() => selectAtlas(organ)}
              />
            ))}
          </div>
        </motion.section>

        <motion.section
          id="workspace"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
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
                    {isViewerOpen ? "Study mode open" : "Open study mode"}
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
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_72%_20%,rgba(56,189,248,0.2),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(4,7,20,0.9))] p-6 shadow-soft">
              <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/10 bg-cyan-300/5 blur-2xl" />
              <div className="relative max-w-md">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/65">
                  Ready to explore
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
                  Study the {currentOrgan.organName.toLowerCase()} in 3D.
                </h3>
                <p className="mt-3 text-sm leading-7 text-white/[0.64]">
                  Enter an uncluttered study view with interactive labels,
                  layered anatomy, and guided notes beside the model.
                </p>
                <button
                  type="button"
                  onClick={() => setIsViewerOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
                >
                  Begin 3D study
                  <ArrowIcon />
                </button>
              </div>
              <div className="relative mt-7 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-white/55">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2">
                  {currentOrgan.parts.length} structures
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2">
                  Interactive anatomy
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="how-it-works"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="mt-24 pb-4"
        >
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/[0.45]">
              How it works
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              Start broad, then focus in.
            </h2>
            <p className="mt-3 max-w-xl text-white/[0.64]">
              Select an organ or add a diagram, then move into a dedicated 3D
              study space without losing the context of what you chose.
            </p>
          </div>

          <div className="mt-8 border-t border-white/10">
            {howItWorks.map((step) => (
              <StepRow key={step.index} {...step} />
            ))}
          </div>
        </motion.section>

        <footer className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/[0.45] md:flex-row md:items-center md:justify-between">
          <p>
            DiagramLens combines interactive anatomy models, structured labels,
            and guided study notes.
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

      <AnimatePresence>
        {isViewerOpen ? (
          <motion.div
            key="study-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
          >
            <AnatomyViewer
              result={currentResult}
              isLoading={isExtracting}
              fullscreen
              onExitFullscreen={() => setIsViewerOpen(false)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
    </MotionConfig>
  );
}
