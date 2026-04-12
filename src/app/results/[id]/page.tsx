"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Types (mirror GET /api/submissions/[id] response exactly) ───────────────

interface SentenceScore {
  sentence: string;
  score: number;
  isAi: boolean;
}

interface MatchedSource {
  sourceUrl: string;
  sourceTitle: string | null;
  sourceType: string;
  matchedText: string;
  originalText: string | null;
  matchScore: number;
  startIndex: number;
  endIndex: number;
}

interface Report {
  similarityScore: number;
  aiScore: number | null;
  aiConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
  matchedSources: MatchedSource[];
  sentenceScores: SentenceScore[];
  processingTimeMs: number | null;
}

interface TextSegment {
  text: string;
  isPlagiarism: boolean;
  isAi: boolean;
  sourceTitle?: string;
  sourceIndex?: number;
}

interface SubmissionData {
  id: string;
  title?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  rawText?: string | null;
  report?: Report | null;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAnnotationMap(
  fullText: string,
  matchedSources: MatchedSource[],
  sentenceScores: SentenceScore[]
): TextSegment[] {
  const len = fullText.length;
  if (len === 0) return [];

  const plagiarismMap = new Array<boolean>(len).fill(false);
  const sourceMap = new Array<string | undefined>(len).fill(undefined);
  const sourceIndexMap = new Array<number | undefined>(len).fill(undefined);
  const aiMap = new Array<boolean>(len).fill(false);

  for (let s = 0; s < matchedSources.length; s++) {
    const src = matchedSources[s];
    const start = Math.max(0, src.startIndex);
    const end = Math.min(len, src.endIndex);
    for (let i = start; i < end; i++) {
      plagiarismMap[i] = true;
      sourceMap[i] = src.sourceTitle ?? src.sourceUrl;
      sourceIndexMap[i] = s;
    }
  }

  for (const ss of sentenceScores) {
    if (!ss.isAi) continue;
    const idx = fullText.indexOf(ss.sentence);
    if (idx === -1) continue;
    const end = Math.min(len, idx + ss.sentence.length);
    for (let i = idx; i < end; i++) {
      aiMap[i] = true;
    }
  }

  const segments: TextSegment[] = [];
  let start = 0;
  for (let i = 1; i <= len; i++) {
    if (
      i === len ||
      plagiarismMap[i] !== plagiarismMap[i - 1] ||
      aiMap[i] !== aiMap[i - 1]
    ) {
      segments.push({
        text: fullText.slice(start, i),
        isPlagiarism: plagiarismMap[start],
        isAi: aiMap[start],
        sourceTitle: sourceMap[start],
        sourceIndex: sourceIndexMap[start],
      });
      start = i;
    }
  }

  return segments;
}

function scoreBarColor(pct: number, type: "sim" | "ai"): string {
  if (type === "sim") {
    if (pct > 50) return "#8b1a1a";
    if (pct > 20) return "#b8974a";
    return "#2d6a2d";
  }
  if (pct > 60) return "#8b1a1a";
  if (pct > 30) return "#b8974a";
  return "#2d6a2d";
}

function sourceTypeBadge(sourceType: string): {
  label: string;
  className: string;
} {
  if (sourceType === "journal") {
    return {
      label: "Journal article",
      className: "bg-[#1a4d2e] text-[#b8974a]",
    };
  }
  if (sourceType === "student_submission") {
    return {
      label: "Student submission",
      className: "bg-amber-100 text-amber-800",
    };
  }
  return { label: "Web source", className: "bg-gray-100 text-gray-600" };
}

// ─── Shared chrome ────────────────────────────────────────────────────────────

function PageHeader({
  title,
  submissionId,
}: {
  title: string;
  submissionId?: string;
}) {
  const [dlState, setDlState] = useState<"idle" | "loading">("idle");
  const abortRef = useRef<AbortController | null>(null);

  async function handleDownload() {
    if (!submissionId || dlState === "loading") return;
    setDlState("loading");
    abortRef.current = new AbortController();
    try {
      const res = await fetch(`/api/submissions/${submissionId}/export`, {
        method: "POST",
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(
          (body as { error?: string }).error ??
            "Export failed. Please try again."
        );
        return;
      }
      const blob = await res.blob();
      const shortId = submissionId.slice(0, 8);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `integrity-report-${shortId}-${date}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      alert("Export failed. Please try again.");
    } finally {
      setDlState("idle");
    }
  }

  return (
    <header className="bg-[#1a4d2e] text-white">
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-8 flex items-center text-xs text-white/50">
          Academic Integrity Portal Confidential
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-widest">
            Integrity Report
          </p>
          <h1 className="font-serif text-lg font-normal leading-tight mt-0.5 text-white">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {submissionId && (
            <button
              onClick={handleDownload}
              disabled={dlState === "loading"}
              className="text-xs border border-white/30 text-white/70 hover:text-white hover:border-white/60 px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dlState === "loading" ? "Generating..." : "Download Report"}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="text-xs border border-white/30 text-white/70 hover:text-white hover:border-white/60 px-3 py-1.5 transition-colors"
          >
            Print
          </button>
        </div>
      </div>
    </header>
  );
}

function PageFooter() {
  return (
    <footer className="bg-[#1a4d2e] text-white/40 text-xs py-4 text-center">
      &copy; {new Date().getFullYear()} Yaba College of Technology &mdash;
      Academic Integrity Portal &mdash; For authorised staff use only
    </footer>
  );
}

// ─── Section heading (small-caps label + rule) ───────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p
        className="text-[0.75rem] text-[#5a5a5a] tracking-[0.05em] mb-2"
        style={{ fontVariant: "small-caps" }}
      >
        {children}
      </p>
      <hr className="border-[#d4d0c8]" />
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  pct,
  color,
  badge,
  disclaimer,
}: {
  label: string;
  pct: number;
  color: string;
  badge?: string;
  disclaimer: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className="text-[0.7rem] text-[#5a5a5a] tracking-[0.05em]"
          style={{ fontVariant: "small-caps" }}
        >
          {label}
        </span>
        <span className="font-serif text-2xl text-[#1a1a1a] font-normal">
          {pct}%
          {badge && (
            <span className="text-xs font-sans text-[#5a5a5a] ml-2">
              {" "}
              {badge}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 bg-gray-200">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
        {disclaimer}
      </p>
    </div>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

function LoadingState({ title, status }: { title?: string; status?: string }) {
  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      <PageHeader title={title ?? "Analysing submission..."} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <div className="border-l-4 border-[#1a4d2e] pl-5 py-2 mb-8">
          <h2 className="font-serif text-xl text-[#1a1a1a] font-normal">
            {title ?? "Analysing submission..."}
          </h2>
          <p className="text-xs uppercase tracking-widest text-[#5a5a5a] mt-1">
            {status === "PROCESSING" ? "Processing" : "Queued for analysis"}
          </p>
        </div>

        <div className="border border-[#d4d0c8] bg-white p-6">
          <p className="text-sm text-[#1a1a1a] mb-4">
            Analysis in progress this may take up to 90 seconds.
          </p>
          <div className="w-full h-1.5 bg-gray-200 overflow-hidden">
            <div className="h-full bg-[#1a4d2e] animate-[indeterminate_2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            You can leave this page and return later.
          </p>
        </div>

        <style>{`
          @keyframes indeterminate {
            0%   { width: 5%; margin-left: 0; }
            50%  { width: 40%; margin-left: 30%; }
            100% { width: 5%; margin-left: 95%; }
          }
        `}</style>
      </main>
      <PageFooter />
    </div>
  );
}

// ─── Failed state ─────────────────────────────────────────────────────────────

function FailedState({ title }: { title?: string }) {
  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      <PageHeader title={title ?? "Analysis Failed"} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <div className="border-l-4 border-[#8b1a1a] pl-5 py-2">
          <p className="text-sm text-[#1a1a1a]">
            Analysis could not be completed. Please resubmit your document.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-4 text-sm border border-[#1a4d2e] text-[#1a4d2e] px-4 py-2 hover:bg-[#1a4d2e] hover:text-white transition-colors"
          >
            Resubmit
          </Link>
        </div>
      </main>
      <PageFooter />
    </div>
  );
}

// ─── Source row ───────────────────────────────────────────────────────────────

function SourceRow({ src, index }: { src: MatchedSource; index: number }) {
  const matchPct = Math.round(src.matchScore * 100);
  const badge = sourceTypeBadge(src.sourceType);

  return (
    <div id={`source-${index}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <a
            href={src.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif font-normal text-sm text-[#1a4d2e] hover:underline"
          >
            {src.sourceTitle ?? src.sourceUrl}
          </a>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {src.sourceUrl}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs font-medium">{matchPct}% match</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      <blockquote
        className="pl-4 py-1 text-sm italic text-[#1a1a1a] mb-2"
        style={{ borderLeft: "3px solid #b8974a" }}
      >
        {src.matchedText}
      </blockquote>

      {src.originalText && (
        <>
          <p className="text-xs text-gray-400 mb-1">Original source text:</p>
          <blockquote
            className="pl-4 py-1 text-sm italic text-gray-400"
            style={{ borderLeft: "3px solid #d4d0c8" }}
          >
            {src.originalText}
          </blockquote>
        </>
      )}

      <hr className="border-[#d4d0c8] mt-4 mb-4" />
    </div>
  );
}

// ─── Annotated document ───────────────────────────────────────────────────────

function AnnotatedDocument({
  fullText,
  matchedSources,
  sentenceScores,
}: {
  fullText: string | null | undefined;
  matchedSources: MatchedSource[];
  sentenceScores: SentenceScore[];
}) {
  if (!fullText) {
    return (
      <p className="text-sm text-gray-400 italic">
        Full text not available for this submission.
      </p>
    );
  }

  const segments =
    matchedSources.length === 0 && sentenceScores.length === 0
      ? [{ text: fullText, isPlagiarism: false, isAi: false }]
      : buildAnnotationMap(fullText, matchedSources, sentenceScores);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "12px",
          fontSize: "11px",
          color: "#5a5a5a",
          alignItems: "center",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              display: "inline-block",
              width: "16px",
              height: "12px",
              background: "#d1fae5",
              borderRadius: "2px",
            }}
          />
          Matched source
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              display: "inline-block",
              width: "16px",
              height: "12px",
              background: "#fef3c7",
              borderRadius: "2px",
            }}
          />
          Elevated AI probability
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              display: "inline-block",
              width: "16px",
              height: "12px",
              background:
                "repeating-linear-gradient(135deg, #fef3c7, #fef3c7 4px, #d1fae5 4px, #d1fae5 8px)",
              borderRadius: "2px",
            }}
          />
          Both
        </span>
      </div>

      <div
        className="text-sm text-[#1a1a1a] leading-loose border border-[#d4d0c8] bg-white p-5"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {segments.map((seg, i) => {
          if (!seg.isPlagiarism && !seg.isAi) {
            return <span key={i}>{seg.text}</span>;
          }

          let spanStyle: React.CSSProperties = {
            borderRadius: "2px",
            padding: "1px 0",
          };
          let title: string | undefined;
          let onClick: (() => void) | undefined;

          if (seg.isPlagiarism && seg.isAi) {
            spanStyle = {
              ...spanStyle,
              background:
                "linear-gradient(135deg, #fef3c7 25%, #d1fae5 25%, #d1fae5 50%, #fef3c7 50%, #fef3c7 75%, #d1fae5 75%)",
              backgroundSize: "8px 8px",
            };
            title = "Matched source + elevated AI probability";
          } else if (seg.isAi) {
            spanStyle = { ...spanStyle, background: "#fef3c7" };
            title = "Elevated AI probability";
          } else {
            spanStyle = {
              ...spanStyle,
              background: "#d1fae5",
              cursor: "pointer",
            };
            title = seg.sourceTitle;
            if (seg.sourceIndex !== undefined) {
              const idx = seg.sourceIndex;
              onClick = () => {
                document
                  .getElementById(`source-${idx}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              };
            }
          }

          return (
            <span key={i} style={spanStyle} title={title} onClick={onClick}>
              {seg.text}
            </span>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
        Highlighted passages indicate potential source matches or elevated AI
        authorship probability. Human review is required before any conclusions
        are drawn.
      </p>
    </>
  );
}

// ─── Full report ──────────────────────────────────────────────────────────────

function FullReport({ data }: { data: SubmissionData }) {
  const report = data.report!;
  const simPct = Math.round(report.similarityScore * 100);
  const aiPct = Math.round((report.aiScore ?? 0) * 100);

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      <PageHeader
        title={`${data.title ?? "Submission"}  Integrity Report`}
        submissionId={data.id}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <nav className="text-xs text-gray-400 mb-6">
          <Link
            href="/dashboard"
            className="hover:text-[#1a4d2e] transition-colors"
          >
            Dashboard
          </Link>{" "}
          &rsaquo; Report
          <span className="ml-4 font-mono">{data.id.slice(0, 12)}&hellip;</span>
        </nav>

        {/* Section A  Summary */}
        <section className="mb-10">
          <SectionHeading>Summary</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <ScoreBar
              label="Similarity Detected"
              pct={simPct}
              color={scoreBarColor(simPct, "sim")}
              disclaimer="Similarity indicates potential overlap with existing sources. A lecturer must review before any action is taken."
            />
            <ScoreBar
              label="AI Content Probability"
              pct={aiPct}
              color={scoreBarColor(aiPct, "ai")}
              badge={
                report.aiConfidence
                  ? `${report.aiConfidence} confidence`
                  : undefined
              }
              disclaimer="AI detection is probabilistic and not definitive. Human review is required."
            />
          </div>
        </section>

        {/* Section B  Source Matches */}
        <section className="mb-10">
          <SectionHeading>
            Source Matches
            {report.matchedSources.length > 0 && (
              <span
                className="ml-2 text-gray-400 normal-case"
                style={{ fontVariant: "normal" }}
              >
                ({report.matchedSources.length})
              </span>
            )}
          </SectionHeading>
          {report.matchedSources.length === 0 ? (
            <p className="text-sm text-gray-500 pt-2">
              No matching sources were detected.
            </p>
          ) : (
            <div className="pt-2">
              {report.matchedSources.map((src, i) => (
                <SourceRow key={i} src={src} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Section C  Document Analysis */}
        <section className="mb-10">
          <SectionHeading>Document Analysis</SectionHeading>
          <div className="pt-2">
            <AnnotatedDocument
              fullText={data.rawText}
              matchedSources={report.matchedSources}
              sentenceScores={report.sentenceScores}
            />
          </div>
        </section>

        <Link
          href="/dashboard"
          className="inline-block text-sm border border-[#1a4d2e] text-[#1a4d2e] px-4 py-2 hover:bg-[#1a4d2e] hover:text-white transition-colors"
        >
          New submission
        </Link>
      </main>

      <PageFooter />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<SubmissionData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/submissions/${id}`);
        if (!res.ok) {
          setLoadError(true);
          stopped = true;
          return;
        }
        const json = (await res.json()) as SubmissionData;
        if (!stopped) setData(json);
        if (json.status === "COMPLETE" || json.status === "FAILED") {
          stopped = true;
        }
      } catch {
        if (!stopped) setLoadError(true);
        stopped = true;
      }
    }

    poll();
    const timer = setInterval(() => {
      if (!stopped) poll();
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
        <PageHeader title="Report unavailable" />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
          <div className="border-l-4 border-[#8b1a1a] pl-5 py-2">
            <p className="text-sm text-[#1a1a1a]">
              This report could not be loaded. It may not exist or you may not
              have permission to view it.
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm border border-[#1a4d2e] text-[#1a4d2e] px-4 py-2 hover:bg-[#1a4d2e] hover:text-white transition-colors"
            >
              Return to dashboard
            </Link>
          </div>
        </main>
        <PageFooter />
      </div>
    );
  }

  if (!data || data.status === "PENDING" || data.status === "PROCESSING") {
    return <LoadingState title={data?.title} status={data?.status} />;
  }

  if (data.status === "FAILED") {
    return <FailedState title={data.title} />;
  }

  if (!data.report) {
    return <FailedState title={data.title} />;
  }

  return <FullReport data={data} />;
}
