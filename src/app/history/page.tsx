"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SubmissionReport {
  similarityScore: number;
  aiScore: number | null;
  aiConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
}

interface Submission {
  id: string;
  title: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  createdAt: string;
  fileType: "pdf" | "docx" | "txt" | null;
  report: SubmissionReport | null;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileTypeLabel(fileType: string | null): string {
  if (fileType === "pdf") return "PDF";
  if (fileType === "docx") return "Word";
  return "Text";
}

function getSimilarityColor(score: number): string {
  if (score < 0.2) return "#2d6a2d";
  if (score < 0.5) return "#b8974a";
  return "#8b1a1a";
}

function getAiColor(score: number): string {
  if (score < 0.3) return "#2d6a2d";
  if (score < 0.6) return "#b8974a";
  return "#8b1a1a";
}

const STATUS_STYLES: Record<
  Submission["status"],
  { bg: string; color: string; label: string }
> = {
  PENDING: { bg: "#f3f4f6", color: "#6b7280", label: "Pending" },
  PROCESSING: { bg: "#fef3c7", color: "#92400e", label: "Processing" },
  COMPLETE: { bg: "#d1fae5", color: "#065f46", label: "Complete" },
  FAILED: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
};

function StatusBadge({ status }: { status: Submission["status"] }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "3px 8px",
        borderRadius: "3px",
        fontSize: "11px",
        fontWeight: 500,
      }}
    >
      {s.label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontFamily: "sans-serif",
  fontSize: "11px",
  fontVariant: "small-caps",
  letterSpacing: "0.05em",
  fontWeight: 500,
  textAlign: "left",
  whiteSpace: "nowrap",
  color: "#ffffff",
  backgroundColor: "#1a4d2e",
};

const tdBase: React.CSSProperties = {
  border: "1px solid #d4d0c8",
  padding: "10px 14px",
  fontFamily: "sans-serif",
  fontSize: "13px",
};

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch("/api/submissions")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<Submission[]>;
      })
      .then((data) => {
        setSubmissions(data);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, []);

  function renderRows() {
    if (loading) {
      return (
        <tr>
          <td
            colSpan={7}
            style={{ ...tdBase, textAlign: "center", color: "#6b7280" }}
          >
            Loading...
          </td>
        </tr>
      );
    }

    if (fetchError) {
      return (
        <tr>
          <td
            colSpan={7}
            style={{ ...tdBase, textAlign: "center", color: "#991b1b" }}
          >
            Could not load history.
          </td>
        </tr>
      );
    }

    if (submissions.length === 0) {
      return (
        <tr>
          <td
            colSpan={7}
            style={{ ...tdBase, textAlign: "center", color: "#6b7280" }}
          >
            No submissions yet.{" "}
            <Link
              href="/dashboard"
              style={{ color: "#1a4d2e", textDecoration: "underline" }}
            >
              Go to the dashboard
            </Link>
          </td>
        </tr>
      );
    }

    return submissions.map((sub, i) => {
      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8f7f4";
      const titleText = sub.title
        ? sub.title.length > 60
          ? sub.title.substring(0, 60) + "…"
          : sub.title
        : null;

      return (
        <tr
          key={sub.id}
          style={{ backgroundColor: rowBg }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f0f2f7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = rowBg;
          }}
        >
          {/* Title */}
          <td style={tdBase}>
            {titleText ? (
              <Link
                href={`/results/${sub.id}`}
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "13px",
                  color: "#1a4d2e",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {titleText}
              </Link>
            ) : (
              <em style={{ color: "#9ca3af" }}>Untitled submission</em>
            )}
          </td>

          {/* Submitted */}
          <td style={{ ...tdBase, color: "#5a5a5a" }}>
            {formatDate(sub.createdAt)}
          </td>

          {/* Type */}
          <td style={{ ...tdBase, color: "#5a5a5a" }}>
            {getFileTypeLabel(sub.fileType)}
          </td>

          {/* Similarity */}
          <td style={tdBase}>
            {sub.status === "COMPLETE" && sub.report != null ? (
              <span
                style={{
                  color: getSimilarityColor(sub.report.similarityScore),
                  fontWeight: 500,
                }}
              >
                {Math.round(sub.report.similarityScore * 100)}%
              </span>
            ) : (
              <span style={{ color: "#9ca3af" }}> </span>
            )}
          </td>

          {/* AI Score */}
          <td style={tdBase}>
            {sub.status === "COMPLETE" && sub.report?.aiScore != null ? (
              <span
                style={{
                  color: getAiColor(sub.report.aiScore),
                  fontWeight: 500,
                }}
              >
                {Math.round(sub.report.aiScore * 100)}%
              </span>
            ) : (
              <span style={{ color: "#9ca3af" }}> </span>
            )}
          </td>

          {/* Status */}
          <td style={tdBase}>
            <StatusBadge status={sub.status} />
          </td>

          {/* Actions */}
          <td style={tdBase}>
            {sub.status === "COMPLETE" ? (
              <Link
                href={`/results/${sub.id}`}
                style={{
                  color: "#1a4d2e",
                  fontSize: "12px",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                View Report
              </Link>
            ) : (
              <span style={{ color: "#9ca3af" }}> </span>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <div>
      <h2
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "24px",
          color: "#1a4d2e",
          fontWeight: "normal",
          marginBottom: "4px",
        }}
      >
        Submission History
      </h2>
      <p
        style={{
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#6b7280",
          marginBottom: "12px",
        }}
      >
        Your recent integrity checks
      </p>
      <hr
        style={{
          border: "none",
          borderTop: "1px solid #d4d0c8",
          marginBottom: "20px",
        }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...thStyle, width: "35%" }}>
              Title
            </th>
            <th scope="col" style={{ ...thStyle, width: "18%" }}>
              Submitted
            </th>
            <th scope="col" style={{ ...thStyle, width: "8%" }}>
              Type
            </th>
            <th scope="col" style={{ ...thStyle, width: "12%" }}>
              Similarity
            </th>
            <th scope="col" style={{ ...thStyle, width: "12%" }}>
              AI Score
            </th>
            <th scope="col" style={{ ...thStyle, width: "8%" }}>
              Status
            </th>
            <th scope="col" style={{ ...thStyle, width: "7%" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>{renderRows()}</tbody>
      </table>
    </div>
  );
}
