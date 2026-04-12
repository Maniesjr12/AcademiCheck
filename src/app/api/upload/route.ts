export const runtime = 'nodejs'

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractText, ExtractionError } from "@/lib/detection/text-extractor";
import { addDetectionJob } from "@/lib/queue";

const ACCEPTED_TYPES = new Set([
  // PDF
  "application/pdf",
  // Word .docx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/docx",
  "application/msword",
  // Plain text
  "text/plain",
  "text/plain; charset=utf-8",
  "text/plain;charset=utf-8",
  // Sometimes browsers send empty or generic types
  "application/octet-stream",
]);

function isAcceptedType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().trim();
  if (ACCEPTED_TYPES.has(normalized)) return true;
  if (normalized.startsWith("text/plain")) return true;
  return false;
}

function getFileType(mimeType: string, filename: string): "pdf" | "docx" | "txt" | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    ext === "docx" || ext === "doc"
  ) return "docx";
  if (mimeType.startsWith("text/plain") || ext === "txt") return "txt";
  return null;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_WORDS = 50;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const titleRaw = formData.get("title") as string | null;

  console.log("[Upload] formData received");
  console.log("[Upload] file:", file?.name, "type:", file?.type, "size:", file?.size);
  console.log("[Upload] title:", titleRaw);

  if (!file || typeof file.name !== "string") {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 10 MB size limit." },
      { status: 400 }
    );
  }

  if (!isAcceptedType(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, Word (.docx), and plain text files are supported." },
      { status: 400 }
    );
  }

  const fileType = getFileType(file.type, file.name);
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type." },
      { status: 400 }
    );
  }

  console.log("[Upload] MIME check passed, fileType:", fileType);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  console.log("[Upload] buffer size:", buffer.length);

  let rawText: string;
  try {
    console.log("[Upload] calling extractText with fileType:", fileType);
    rawText = await extractText({ buffer, fileType });
    console.log("[Upload] extracted text length:", rawText.length);
    console.log("[Upload] first 200 chars:", rawText.substring(0, 200));
  } catch (err) {
    console.error("[Upload] ERROR:", err);
    console.error("[Upload] ERROR stack:", err instanceof Error ? err.stack : err);
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Failed to extract text from the uploaded file." },
      { status: 500 }
    );
  }

  const wordCount = countWords(rawText);
  console.log("[Upload] word count:", wordCount);

  if (wordCount < MIN_WORDS) {
    return NextResponse.json(
      {
        error:
          "The document contains too little text to analyse. Please submit at least 50 words.",
      },
      { status: 400 }
    );
  }

  const title = titleRaw?.trim() || file.name;

  const submission = await prisma.submission.create({
    data: {
      userId: session.user.id,
      title,
      rawText,
      fileUrl: null,
      fileType,
      status: "PENDING",
    },
    select: { id: true, status: true },
  });

  await addDetectionJob(submission.id);

  return NextResponse.json(
    { submissionId: submission.id, status: submission.status },
    { status: 201 }
  );
}
