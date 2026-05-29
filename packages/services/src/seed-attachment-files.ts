// One-off: upload sample file bytes to MinIO under the seeded attachment
// storageKeys, so each RFQ attachment resolves to a real, distinct object.
// Run: S3_*=… pnpm --filter @uptool/db exec tsx ../services/src/seed-attachment-files.ts

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."); // repo root
const bucket = process.env.S3_BUCKET ?? "uptool-attachments";

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
  forcePathStyle: true,
});

// storageKey -> source sample (relative to repo root). Two distinct samples
// give the previews real variety; .step bodies exist for completeness.
const PDF = "application/pdf";
const STEP = "model/step";
const FILES: Array<[key: string, source: string, contentType: string]> = [
  ["acme/attachments/vent-plate-pub-drw-v1.pdf", "assets/072-93083.pdf", PDF],
  ["acme/attachments/vent-plate-pub.step", "assets/072-93083.STEP", STEP],
  ["acme/attachments/collar-mounting-bracket-pub-drw-v1.pdf", "assets/072-93105.pdf", PDF],
  ["acme/attachments/collar-mounting-bracket-pub.step", "assets/072-93105.STEP", STEP],
  ["acme/attachments/peat-motor-stand.pdf", "assets/072-93083.pdf", PDF],
  ["acme/attachments/peat-motor-stand.step", "assets/072-93105.STEP", STEP],
  ["acme/attachments/rfq1004-acknowledgement.pdf", "assets/072-93105.pdf", PDF],
];

async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`created bucket ${bucket}`);
  }
}

async function main() {
  await ensureBucket();
  for (const [key, source, contentType] of FILES) {
    const body = readFileSync(resolve(ROOT, source));
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
    console.log(`uploaded ${key} <- ${source}`);
  }
  console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
