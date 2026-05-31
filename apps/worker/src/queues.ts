import { Queue } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};

export const QUEUE_NAMES = {
  HELLO_WORLD: "hello-world",
  POLL_EMAIL_ACCOUNT: "poll-email-account",
  INGEST_EMAIL: "ingest-email",
  RENDER_CAD_THUMBNAIL: "render-cad-thumbnail",
} as const;

export const helloWorldQueue = new Queue(QUEUE_NAMES.HELLO_WORLD, { connection });
export const pollEmailAccountQueue = new Queue(QUEUE_NAMES.POLL_EMAIL_ACCOUNT, { connection });
export const ingestEmailQueue = new Queue(QUEUE_NAMES.INGEST_EMAIL, { connection });
export const renderCadThumbnailQueue = new Queue(QUEUE_NAMES.RENDER_CAD_THUMBNAIL, { connection });

export interface PollEmailAccountJobData {
  emailAccountId: string;
  orgId: string;
}

export interface IngestEmailJobData {
  emailAccountId: string;
  orgId: string;
  provider: "microsoft" | "gmail";
  providerMessageId: string;
  providerThreadId: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  subject?: string;
  bodyText?: string;
  receivedAt: string; // ISO string
  attachments: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    dataBase64: string; // Buffer serialised as base64
  }>;
}

export interface RenderCadThumbnailJobData {
  orgId: string;
  partId: string;
  attachmentId: string;
  storageKey: string; // CAD object key (immutable — safe to carry on the job)
  filename: string; // for the extension; the renderer keys off it
}
