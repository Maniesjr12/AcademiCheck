import { getFileFromS3 } from "@/lib/s3";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

interface ExtractInput {
  text?: string;
  fileUrl?: string;
  fileType?: string;
  buffer?: Buffer;
}

async function downloadFromS3(fileUrl: string): Promise<Buffer> {
  try {
    return await getFileFromS3(fileUrl);
  } catch (err) {
    throw new ExtractionError(`Failed to download file from S3 (${fileUrl})`, err);
  }
}

/**
 * Remove null bytes, non-printable control characters (except tab, LF, CR),
 * and normalise whitespace runs.
 */
function sanitise(raw: string): string {
  return raw
    .replace(/\x00/g, "")                         // null bytes
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // non-printable (keep \t \n \r)
    .replace(/\r\n|\r/g, "\n")                    // normalise line endings
    .replace(/\n{3,}/g, "\n\n")                   // collapse excessive blank lines
    .replace(/[ \t]{2,}/g, " ")                   // collapse horizontal whitespace
    .trim();
}

function cleanDirectText(text: string): string {
  return sanitise(text);
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Require the inner lib directly to bypass pdf-parse's index.js self-test,
    // which tries to open ./test/data/05-versions-space.pdf relative to CWD.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const result = await pdfParse(buffer)
    const text = result.text?.trim() ?? ''

    if (!text) {
      throw new Error(
        'PDF contains no extractable text. It may be a scanned or image-based PDF.'
      )
    }

    return sanitise(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new ExtractionError(`Failed to extract text from PDF: ${message}`, err)
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return sanitise(result.value);
  } catch (err) {
    throw new ExtractionError("Failed to extract text from DOCX", err);
  }
}

function extractFromTxt(buffer: Buffer): string {
  try {
    return sanitise(buffer.toString("utf-8"));
  } catch (err) {
    throw new ExtractionError("Failed to decode TXT file as UTF-8", err);
  }
}

export async function extractText(input: ExtractInput): Promise<string> {
  const { text, fileUrl, fileType, buffer: directBuffer } = input;

  if (text !== undefined && text.trim().length > 0) {
    return cleanDirectText(text);
  }

  const resolvedBuffer = directBuffer ?? (fileUrl ? await downloadFromS3(fileUrl) : null);

  if (!resolvedBuffer) {
    throw new ExtractionError("No text, fileUrl, or buffer provided");
  }

  const type = (fileType ?? "").toLowerCase().replace(/^\./, "");

  switch (type) {
    case "pdf":
      return extractFromPdf(resolvedBuffer);
    case "docx":
      return extractFromDocx(resolvedBuffer);
    case "txt":
      return extractFromTxt(resolvedBuffer);
    default:
      throw new ExtractionError(`Unsupported file type: "${fileType ?? "unknown"}"`);
  }
}
