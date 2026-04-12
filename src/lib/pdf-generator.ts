// Server-only — never import from client components.

export interface ReportData {
  id: string;
  title: string;
  createdAt: string;
  report: {
    similarityScore: number;
    aiScore: number | null;
    aiConfidence: string | null;
    sentenceScores: Array<{ sentence: string; score: number; isAi: boolean }>;
    matchedSources: Array<{
      sourceUrl: string;
      sourceTitle: string | null;
      sourceType: string;
      matchedText: string;
      originalText: string | null;
      matchScore: number;
    }>;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_]/g, "-").substring(0, 60);
}

function buildReportHtml(data: ReportData): string {
  const sim = Math.round((data.report.similarityScore ?? 0) * 100);
  const ai = Math.round((data.report.aiScore ?? 0) * 100);
  const simColor = sim < 20 ? "#2d6a2d" : sim < 50 ? "#c9a84c" : "#8b1a1a";
  const aiColor = ai < 30 ? "#2d6a2d" : ai < 60 ? "#c9a84c" : "#8b1a1a";
  const date = new Date(data.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const shortId = data.id.substring(0, 8).toUpperCase();

  const sourcesHtml =
    data.report.matchedSources.length === 0
      ? '<p style="color: #5a5a5a; font-style: italic;">No matching sources were detected.</p>'
      : data.report.matchedSources
          .map(
            (s) => `
        <div style="margin-bottom: 24px; padding-bottom: 24px;
          border-bottom: 1px solid #d4d0c8;">
          <div style="display: flex; justify-content: space-between;
            align-items: baseline; margin-bottom: 4px;">
            <span style="color: #1a4d2e; font-family: Georgia, serif;
              font-size: 13px;">
              ${escapeHtml(s.sourceTitle ?? s.sourceUrl)}
            </span>
            <span style="font-size: 11px; color: #5a5a5a; white-space: nowrap; margin-left: 16px;">
              ${Math.round(s.matchScore * 100)}% match
            </span>
          </div>
          <div style="font-size: 10px; color: #5a5a5a; margin-bottom: 8px;">
            ${escapeHtml(s.sourceUrl)} &nbsp;&middot;&nbsp;
            <span style="text-transform: uppercase; letter-spacing: 0.03em;">
              ${s.sourceType === "journal" ? "Journal article" : s.sourceType === "web" ? "Web source" : "Student submission"}
            </span>
          </div>
          <blockquote style="margin: 0; padding: 10px 14px;
            border-left: 3px solid #c9a84c; background: #faf9f6;
            font-style: italic; font-size: 11px; color: #3a3a3a;">
            ${escapeHtml(s.matchedText)}
          </blockquote>
          ${
            s.originalText
              ? `
            <p style="font-size: 10px; color: #5a5a5a; margin: 8px 0 4px;">
              Original source text:
            </p>
            <blockquote style="margin: 0; padding: 10px 14px;
              border-left: 3px solid #d4d0c8; background: #f5f4f0;
              font-style: italic; font-size: 11px; color: #5a5a5a;">
              ${escapeHtml(s.originalText)}
            </blockquote>
          `
              : ""
          }
        </div>
      `
          )
          .join("");

  const sentencesHtml = (data.report.sentenceScores ?? [])
    .map(
      (s) =>
        `<span style="${
          s.isAi
            ? "background: #fef3c7; border-radius: 2px; padding: 1px 3px;"
            : ""
        }">${escapeHtml(s.sentence)} </span>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, serif;
      color: #1a1a1a;
      background: #f8f7f4;
      font-size: 12px;
      line-height: 1.6;
    }
    .section-label {
      font-family: Arial, sans-serif;
      font-size: 9px;
      letter-spacing: 0.08em;
      color: #5a5a5a;
      text-transform: uppercase;
      border-bottom: 1px solid #d4d0c8;
      padding-bottom: 6px;
      margin-bottom: 16px;
    }
    .section { margin-bottom: 32px; }
  </style>
</head>
<body>
  <!-- Header band -->
  <div style="background: #1a4d2e; color: white; padding: 20px 24px;
    margin-bottom: 24px;">
    <div style="font-family: Arial, sans-serif; font-size: 9px;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: #c9a84c; margin-bottom: 6px;">
      Academic Integrity Report &mdash; Confidential
    </div>
    <div style="font-size: 18px; font-weight: normal;">
      ${escapeHtml(data.title)}
    </div>
    <div style="display: flex; gap: 32px; margin-top: 10px;
      font-size: 10px; color: #c8c4b8;">
      <span>Date: ${escapeHtml(date)}</span>
      <span>Reference: ${escapeHtml(shortId)}</span>
    </div>
  </div>

  <!-- Summary -->
  <div class="section">
    <div class="section-label">Summary</div>
    <div style="display: flex; gap: 16px; margin-bottom: 12px;">
      <div style="flex: 1; border: 1.5px solid ${simColor};
        padding: 14px; background: white;">
        <div style="font-family: Arial, sans-serif; font-size: 8px;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #5a5a5a; margin-bottom: 6px;">
          Similarity Detected
        </div>
        <div style="font-size: 28px; color: ${simColor}; font-weight: bold;">
          ${sim}%
        </div>
      </div>
      <div style="flex: 1; border: 1.5px solid ${aiColor};
        padding: 14px; background: white;">
        <div style="font-family: Arial, sans-serif; font-size: 8px;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #5a5a5a; margin-bottom: 6px;">
          AI Content Probability
        </div>
        <div style="font-size: 28px; color: ${aiColor}; font-weight: bold;">
          ${ai}%
        </div>
        <div style="font-size: 10px; color: #5a5a5a; margin-top: 2px;">
          ${escapeHtml(data.report.aiConfidence ?? "LOW")} confidence
        </div>
      </div>
    </div>
    <p style="font-size: 9px; color: #5a5a5a; font-style: italic;">
      Similarity scores indicate potential overlap only. A qualified lecturer
      must review before any disciplinary action is taken. AI detection is
      probabilistic and not definitive.
    </p>
  </div>

  <!-- Source matches -->
  <div class="section">
    <div class="section-label">Source Matches (${data.report.matchedSources.length})</div>
    ${sourcesHtml}
  </div>

  <!-- Sentence analysis -->
  <div class="section">
    <div class="section-label">Sentence-Level Analysis</div>
    <p style="font-size: 9px; color: #5a5a5a; font-style: italic;
      margin-bottom: 12px;">
      Sentences highlighted in amber showed elevated AI authorship probability.
      This analysis is indicative only.
    </p>
    <div style="font-size: 11px; line-height: 1.8; background: white;
      padding: 16px; border: 1px solid #d4d0c8;">
      ${sentencesHtml || '<em style="color: #5a5a5a;">No sentence analysis available.</em>'}
    </div>
  </div>
</body>
</html>`;
}

export async function generateReportPdf(data: ReportData): Promise<Uint8Array> {
  const html = buildReportHtml(data);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf: Uint8Array = await page.pdf({
      format: "A4",
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 9px;
          color: #5a5a5a; width: 100%; padding: 0 20mm;
          display: flex; justify-content: space-between; border-top: 1px solid #d4d0c8;">
          <span>AcademiCheck &mdash; Academic Integrity Portal</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    return pdf;
  } finally {
    await browser.close();
  }
}
