import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SentenceScore } from "@/lib/detection/ai-detector";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
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
    where: { id, userId: session.user.id },
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

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // For in-progress submissions, return only the status
  if (submission.status === "PENDING" || submission.status === "PROCESSING") {
    return NextResponse.json({ id: submission.id, title: submission.title, status: submission.status });
  }

  if (submission.status === "FAILED") {
    return NextResponse.json({
      id: submission.id,
      status: "FAILED",
      error: "Detection failed. Please resubmit.",
    });
  }

  if (!submission.report) {
    return NextResponse.json({
      id: submission.id,
      title: submission.title,
      status: submission.status,
      report: null,
    });
  }

  const { report } = submission;

  return NextResponse.json({
    id: submission.id,
    title: submission.title,
    status: submission.status,
    rawText: submission.rawText,
    report: {
      similarityScore: report.similarityScore,
      aiScore: report.aiScore,
      aiConfidence: report.aiConfidence,
      processingTimeMs: report.processingTimeMs,
      matchedSources: report.matchedSources.map((src) => ({
        sourceUrl: src.sourceUrl,
        sourceTitle: src.sourceTitle,
        sourceType: src.sourceType,
        matchedText: src.matchedText,
        originalText: src.originalText,
        matchScore: src.matchScore,
        startIndex: src.startIndex,
        endIndex: src.endIndex,
      })),
      sentenceScores: (report.sentenceScores ?? []) as unknown as SentenceScore[],
    },
  });
}
