import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
  endpoint: process.env.S3_ENDPOINT,
});

/**
 * Download a file from S3 and return its content as a Buffer.
 * fileUrl is expected to be in the form "s3://bucket/key" or just "bucket/key".
 */
export async function getFileFromS3(fileUrl: string): Promise<Buffer> {
  const stripped = fileUrl.replace(/^s3:\/\//, "");
  const slashIdx = stripped.indexOf("/");
  if (slashIdx === -1) {
    throw new Error(`Invalid S3 URL — cannot parse bucket/key from: ${fileUrl}`);
  }
  const bucket = stripped.slice(0, slashIdx);
  const key = stripped.slice(slashIdx + 1);

  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!response.Body) {
    throw new Error(`S3 response body was empty for: ${fileUrl}`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
