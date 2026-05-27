import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    // Required for Minio path-style URLs
    forcePathStyle: true,
  });
}

const bucket = () => process.env.S3_BUCKET ?? "uptool-attachments";

export const storageService = {
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  },

  async presignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const client = getClient();
    const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
    return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
  },

  async delete(key: string): Promise<void> {
    const client = getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
};
