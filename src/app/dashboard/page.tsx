"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  FileUp,
  AlignLeft,
  Info,
} from "lucide-react";

type TabType = "text" | "file";

interface SubmissionRow {
  id: string;
  title: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  createdAt: string;
  fileType: "pdf" | "docx" | "txt" | null;
  report: {
    similarityScore: number;
    aiScore: number | null;
    aiConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
  } | null;
}

const STATUS_STYLES: Record<
  SubmissionRow["status"],
  { bg: string; color: string; label: string }
> = {
  PENDING: { bg: "#f3f4f6", color: "#6b7280", label: "Pending" },
  PROCESSING: { bg: "#fef3c7", color: "#92400e", label: "Processing" },
  COMPLETE: { bg: "#d1fae5", color: "#065f46", label: "Complete" },
  FAILED: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("text");
  const [textContent, setTextContent] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SubmissionRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/submissions")
      .then((r) => r.json())
      .then((data: unknown) => {
        setHistory(
          Array.isArray(data) ? (data as SubmissionRow[]).slice(0, 5) : []
        );
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  }, []);

  const acceptedFileTypes = [".pdf", ".docx", ".txt"];

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  }

  function validateAndSetFile(file: File) {
    setError(null);
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(extension)) {
      setError(
        "Unsupported file type. Please upload a PDF, DOCX, or TXT file."
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds the 10 MB size limit.");
      return;
    }
    setSelectedFile(file);
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (textContent.trim().length < 50) {
      setError("Please enter at least 50 characters for analysis.");
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmed = textContent.trim();
      const title =
        trimmed.length > 60 ? trimmed.substring(0, 60) + "..." : trimmed;
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text: textContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      router.push(`/results/${data.submissionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }

    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      if (fileTitle.trim()) form.append("title", fileTitle.trim());

      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      router.push(`/results/${data.submissionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <nav className="text-xs text-gray-400 mb-2">
          Dashboard &rsaquo; Submit Document
        </nav>
        <h2 className="text-xl font-bold text-[#1a4d2e]">
          Submit Document for Analysis
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Paste text or upload a document to run a plagiarism and similarity
          check.
        </p>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          All submissions are logged and subject to the university&apos;s data
          retention policy. Do not submit documents containing personally
          identifiable student information without appropriate consent.
        </span>
      </div>

      {/* Submission Card */}
      <div className="bg-white border border-gray-200 rounded shadow-sm">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab("text");
              setError(null);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "text"
                ? "border-[#1a4d2e] text-[#1a4d2e] bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <AlignLeft className="h-4 w-4" />
            Paste Text
          </button>
          <button
            onClick={() => {
              setActiveTab("file");
              setError(null);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "file"
                ? "border-[#1a4d2e] text-[#1a4d2e] bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FileUp className="h-4 w-4" />
            Upload File
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Text Tab */}
          {activeTab === "text" && (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Text
                </label>
                <textarea
                  placeholder="Paste the text you wish to check. Minimum 50 characters required."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1a4d2e]/20 focus:border-[#1a4d2e] text-gray-900 placeholder:text-gray-400 resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {textContent.length} characters
                  {textContent.length > 0 && textContent.length < 50 && (
                    <span className="text-amber-600 ml-1">
                      ({50 - textContent.length} more required)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || textContent.trim().length < 50}
                  className="flex items-center gap-2 px-5 py-2 bg-[#1a4d2e] hover:bg-[#2d6a42] disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analysing...
                    </>
                  ) : (
                    "Submit for Analysis"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* File Tab */}
          {activeTab === "file" && (
            <form onSubmit={handleFileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Title{" "}
                  <span className="font-normal text-gray-400">
                    (optional defaults to filename)
                  </span>
                </label>
                <input
                  type="text"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="e.g. HIST3201 Essay Week 8"
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1a4d2e]/20 focus:border-[#1a4d2e] text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Document
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-[#1a4d2e] bg-[#1a4d2e]/5"
                      : selectedFile
                      ? "border-green-400 bg-green-50"
                      : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                      <p className="font-medium text-gray-800 text-sm">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB Click to
                        change
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600 font-medium">
                        Drag and drop a file, or click to browse
                      </p>
                      <p className="text-xs text-gray-400">
                        Accepted formats: PDF, DOCX, TXT &mdash; Maximum 10 MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="flex items-center gap-2 px-5 py-2 bg-[#1a4d2e] hover:bg-[#2d6a42] disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analysing...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Submit for Analysis
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white border border-gray-200 rounded shadow-sm">
        <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Submission History
          </h3>
          <span className="text-xs text-gray-400">5 most recent</span>
        </div>
        <div className="p-6">
          {historyLoading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm italic">
                No submissions yet. Your submission history will appear here.
              </p>
            </div>
          ) : (
            <>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#1a4d2e", color: "#ffffff" }}>
                    {(
                      [
                        "Title",
                        "Date",
                        "Similarity",
                        "Status",
                        "Action",
                      ] as const
                    ).map((h) => (
                      <th
                        key={h}
                        scope="col"
                        style={{
                          padding: "8px 12px",
                          fontFamily: "sans-serif",
                          fontSize: "11px",
                          fontVariant: "small-caps",
                          letterSpacing: "0.05em",
                          fontWeight: 500,
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => {
                    const rowBg = i % 2 === 0 ? "#ffffff" : "#f8f7f4";
                    const td: React.CSSProperties = {
                      border: "1px solid #d4d0c8",
                      padding: "8px 12px",
                    };
                    const s = STATUS_STYLES[row.status];
                    const sim =
                      row.status === "COMPLETE" && row.report != null
                        ? row.report.similarityScore
                        : null;
                    const simColor =
                      sim == null
                        ? "#9ca3af"
                        : sim < 0.2
                        ? "#2d6a2d"
                        : sim < 0.5
                        ? "#b8974a"
                        : "#8b1a1a";
                    const titleDisplay = row.title
                      ? row.title.length > 50
                        ? row.title.substring(0, 50) + "…"
                        : row.title
                      : "Untitled submission";

                    return (
                      <tr
                        key={row.id}
                        style={{ backgroundColor: rowBg }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f2f7";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = rowBg;
                        }}
                      >
                        <td style={td}>
                          <a
                            href={`/results/${row.id}`}
                            style={{
                              fontFamily: "Georgia, serif",
                              color: "#1a4d2e",
                              textDecoration: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration =
                                "underline";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = "none";
                            }}
                          >
                            {titleDisplay}
                          </a>
                        </td>
                        <td style={{ ...td, color: "#5a5a5a" }}>
                          {formatDate(row.createdAt)}
                        </td>
                        <td
                          style={{
                            ...td,
                            color: simColor,
                            fontWeight: sim != null ? 500 : undefined,
                          }}
                        >
                          {sim != null ? `${Math.round(sim * 100)}%` : "-"}
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              background: s.bg,
                              color: s.color,
                              padding: "2px 7px",
                              borderRadius: "3px",
                              fontSize: "11px",
                              fontWeight: 500,
                            }}
                          >
                            {s.label}
                          </span>
                        </td>
                        <td style={td}>
                          {row.status === "COMPLETE" ? (
                            <a
                              href={`/results/${row.id}`}
                              style={{
                                color: "#1a4d2e",
                                fontSize: "12px",
                                textDecoration: "none",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.textDecoration =
                                  "underline";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.textDecoration = "none";
                              }}
                            >
                              View
                            </a>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ textAlign: "right", marginTop: "8px" }}>
                <a
                  href="/history"
                  style={{
                    fontSize: "12px",
                    color: "#1a4d2e",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLAnchorElement).style.textDecoration =
                      "underline";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLAnchorElement).style.textDecoration =
                      "none";
                  }}
                >
                  View all submissions →
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
