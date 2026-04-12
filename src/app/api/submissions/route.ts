import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDetectionJob } from "@/lib/queue";

const SubmissionSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    text: z.string().min(1).optional(),
    fileUrl: z.string().url("fileUrl must be a valid URL").optional(),
    fileType: z.enum(["pdf", "docx", "txt"]).optional(),
  })
  .refine((data) => data.text !== undefined || data.fileUrl !== undefined, {
    message: "At least one of 'text' or 'fileUrl' must be provided",
  });

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const submissions = await prisma.submission.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      fileType: true,
      report: {
        select: {
          similarityScore: true,
          aiScore: true,
          aiConfidence: true,
        },
      },
    },
  });

  return NextResponse.json(submissions);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { title, text, fileUrl, fileType } = parsed.data;

  const submission = await prisma.submission.create({
    data: {
      userId: session.user.id,
      title,
      rawText: text ?? "",
      fileUrl: fileUrl ?? null,
      fileType: fileType ?? null,
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
