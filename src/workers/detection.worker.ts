/**
 * Detection worker — runs as a standalone Node process via `npm run worker`.
 * NOT a Next.js file. Uses relative imports only (no @/ aliases).
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { extractText } from "../lib/detection/text-extractor";
import { detectPlagiarism } from "../lib/detection/plagiarism-engine";
import { detectAiContent } from "../lib/detection/ai-detector";

const prisma = new PrismaClient();

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

function timestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `[${h}:${m}:${s}]`;
}

function log(message: string): void {
  console.log(`${timestamp()} ${message}`);
}

function logError(message: string, err: unknown): void {
  console.error(`${timestamp()} ${message}`, err);
}

const worker = new Worker<{ submissionId: string }>(
  "detection",
  async (job) => {
    const { submissionId } = job.data;
    const startMs = Date.now();

    try {
      log(`Job ${job.id}: starting for submission ${submissionId}`);

      // Step a: fetch submission
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, rawText: true, fileUrl: true, fileType: true },
      });

      if (!submission) {
        throw new Error(`Submission ${submissionId} not found in database`);
      }

      // Step b: update status → PROCESSING
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "PROCESSING" },
      });
      log(`Job ${job.id}: status → PROCESSING`);

      // Step c: extract text
      const text = await extractText({
        text: submission.rawText.trim().length > 0 ? submission.rawText : undefined,
        fileUrl: submission.fileUrl ?? undefined,
        fileType: submission.fileType ?? undefined,
      });
      log(`Job ${job.id}: text extracted (${text.length} chars)`);

      // Step d: run detection engines in parallel
      const [plagiarismResult, aiResult] = await Promise.all([
        detectPlagiarism(text),
        detectAiContent(text),
      ]);
      log(
        `Job ${job.id}: detection complete — plagiarism: ${plagiarismResult.overallScore.toFixed(3)}, ` +
        `AI: ${aiResult.overallScore.toFixed(3)} (${aiResult.confidence})`
      );

      const processingTimeMs = Date.now() - startMs;

      // Step e: save Report + MatchedSources atomically, then update status → COMPLETE
      await prisma.$transaction(async (tx) => {
        const report = await tx.report.upsert({
          where: { submissionId },
          update: {
            similarityScore: plagiarismResult.overallScore,
            aiScore: aiResult.overallScore,
            aiConfidence: aiResult.confidence,
            sentenceScores: aiResult.sentenceScores as unknown as Parameters<typeof tx.report.upsert>[0]["update"]["sentenceScores"],
            processingTimeMs,
          },
          create: {
            submissionId,
            similarityScore: plagiarismResult.overallScore,
            aiScore: aiResult.overallScore,
            aiConfidence: aiResult.confidence,
            sentenceScores: aiResult.sentenceScores as unknown as Parameters<typeof tx.report.upsert>[0]["create"]["sentenceScores"],
            processingTimeMs,
          },
        });

        // Delete any existing matches from a prior attempt before re-creating
        await tx.matchedSource.deleteMany({
          where: { reportId: report.id },
        });

        if (plagiarismResult.matches.length > 0) {
          await tx.matchedSource.createMany({
            data: plagiarismResult.matches.map((m) => ({
              reportId: report.id,
              sourceUrl: m.sourceUrl,
              sourceTitle: m.sourceTitle,
              sourceType: m.sourceType,
              matchedText: m.matchedText,
              originalText: m.originalText,
              matchScore: m.matchScore,
              startIndex: m.startIndex,
              endIndex: m.endIndex,
            })),
          });
        }

        // Step f: update status → COMPLETE (inside transaction so it's atomic)
        await tx.submission.update({
          where: { id: submissionId },
          data: { status: "COMPLETE" },
        });
      });

      log(`Job ${job.id}: complete in ${processingTimeMs}ms`);
    } catch (err) {
      logError(`Job ${job.id}: FAILED for submission ${submissionId}`, err);

      // Best-effort status update — do not let this throw and mask the original error
      await prisma.submission
        .update({ where: { id: submissionId }, data: { status: "FAILED" } })
        .catch((updateErr: unknown) => {
          logError(`Job ${job.id}: could not update status to FAILED`, updateErr);
        });
    }
  },
  { connection }
);

worker.on("ready", () => log("Worker ready — listening on queue: detection"));
worker.on("failed", (job, err) => {
  logError(`Job ${job?.id ?? "unknown"}: marked failed by BullMQ`, err);
});

process.on("SIGTERM", async () => {
  log("SIGTERM received — closing worker");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
