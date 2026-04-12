/**
 * Detection Worker — standalone Node.js process.
 * Run with: npm run worker
 *
 * This file lives outside src/ so path aliases (@/*) are not available.
 * All imports use relative paths.
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { extractText } from "../src/lib/detection/text-extractor.js";
import { detectPlagiarism } from "../src/lib/detection/plagiarism-engine.js";
import { detectAiContent } from "../src/lib/detection/ai-detector.js";

// ─── Infrastructure ───────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─── Job payload ──────────────────────────────────────────────────────────────

interface DetectionJobData {
  submissionId: string;
}

// ─── Core processor ───────────────────────────────────────────────────────────

async function processDetectionJob(submissionId: string): Promise<void> {
  const startTime = Date.now();

  // a. Fetch submission from DB
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, rawText: true, fileUrl: true, fileType: true, status: true },
  });

  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  if (submission.status === "COMPLETE" || submission.status === "PROCESSING") {
    console.log(`[worker] Skipping ${submissionId} — already ${submission.status}`);
    return;
  }

  // b. Mark as PROCESSING
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "PROCESSING" },
  });

  // c. Extract plain text
  const text = await extractText({
    text: submission.rawText || undefined,
    fileUrl: submission.fileUrl ?? undefined,
    fileType: submission.fileType ?? undefined,
  });

  if (!text || text.trim().length === 0) {
    throw new Error(`No extractable text for submission ${submissionId}`);
  }

  // d. Run plagiarism detection + AI detection in parallel
  const [plagiarismResult, aiResult] = await Promise.all([
    detectPlagiarism(text),
    detectAiContent(text),
  ]);

  const processingTimeMs = Date.now() - startTime;

  // e. Save Report and MatchedSource records in a transaction
  await prisma.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        submissionId,
        similarityScore: plagiarismResult.overallScore,
        aiScore: aiResult.overallScore,
        aiConfidence: aiResult.confidence,
        sentenceScores: aiResult.sentenceScores as unknown as Parameters<typeof tx.report.create>[0]["data"]["sentenceScores"],
        processingTimeMs,
      },
    });

    if (plagiarismResult.matches.length > 0) {
      await tx.matchedSource.createMany({
        data: plagiarismResult.matches.map((match) => ({
          reportId: report.id,
          sourceUrl: match.sourceUrl,
          sourceTitle: match.sourceTitle,
          sourceType: match.sourceType,
          matchedText: match.matchedText,
          originalText: match.originalText ?? null,
          matchScore: match.matchScore,
          startIndex: match.startIndex,
          endIndex: match.endIndex,
        })),
      });
    }
  });

  // f. Mark as COMPLETE
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "COMPLETE" },
  });

  console.log(
    `[worker] Submission ${submissionId} completed in ${processingTimeMs}ms — ` +
    `similarity=${(plagiarismResult.overallScore * 100).toFixed(1)}% ` +
    `ai=${(aiResult.overallScore * 100).toFixed(1)}% (${aiResult.confidence})`
  );
}

// ─── Job handler (wrapped so the worker process never crashes) ────────────────

async function handleJob(job: Job<DetectionJobData>): Promise<void> {
  const { submissionId } = job.data;

  console.log(`[worker] Job ${job.id} — processing submission ${submissionId}`);

  try {
    await processDetectionJob(submissionId);
  } catch (err) {
    console.error(`[worker] Job ${job.id} failed for submission ${submissionId}:`, err);

    // Best-effort status update — don't let a DB error mask the original failure
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "FAILED" },
      });
    } catch (updateErr) {
      console.error(
        `[worker] Could not update submission ${submissionId} to FAILED:`,
        updateErr
      );
    }

    // Re-throw so BullMQ marks this job attempt as failed and applies retry backoff.
    // The worker process itself is not affected — BullMQ isolates job errors.
    throw err;
  }
}

// ─── Worker instance ──────────────────────────────────────────────────────────

const worker = new Worker<DetectionJobData>("detection", handleJob, {
  connection,
  concurrency: 2, // process up to 2 jobs at the same time
});

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

worker.on("error", (err) => {
  // Connection or internal BullMQ errors — log but do not exit
  console.error("[worker] Worker error:", err);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal} — shutting down gracefully`);
  await worker.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Prevent unhandled promise rejections from crashing the process
process.on("unhandledRejection", (reason) => {
  console.error("[worker] Unhandled rejection:", reason);
});

console.log("[worker] Detection worker started — listening on queue: detection");
