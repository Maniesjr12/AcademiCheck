export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReportPdf, sanitiseFilename } from "@/lib/pdf-generator";
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Submission ID is required" }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      report: {
        include: {
          matchedSources: {
            orderBy: { matchScore: "desc" },
          },
        },
      },
    },
  });

  if (!submission || submission.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 403 });
  }

  if (submission.status !== "COMPLETE" || !submission.report) {
    return NextResponse.json(
      { error: "Report is not ready for export" },
      { status: 400 }
    );
  }

  const { report } = submission;

  let pdf: Uint8Array;
  try {
    pdf = await generateReportPdf({
      id: submission.id,
      title: submission.title,
      createdAt: submission.createdAt.toISOString(),
      report: {
        similarityScore: report.similarityScore,
        aiScore: report.aiScore,
        aiConfidence: report.aiConfidence,
        matchedSources: report.matchedSources.map((src) => ({
          sourceUrl: src.sourceUrl,
          sourceTitle: src.sourceTitle,
          sourceType: src.sourceType,
          matchedText: src.matchedText,
          originalText: src.originalText,
          matchScore: src.matchScore,
        })),
        sentenceScores: (report.sentenceScores ?? []) as Array<{
          sentence: string;
          score: number;
          isAi: boolean;
        }>,
      },
    });
  } catch (error) {
    console.error("[PDF Export Error]", error);
    console.error("[PDF Export Stack]", error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: "Export failed. Please try again." },
      { status: 500 }
    );
  }

  const safeId = sanitiseFilename(submission.id);
  const filename = `integrity-report-${safeId}.pdf`;

  return new NextResponse(pdf.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
