import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { storageService, rfqService } from "@uptool/services";
import { resolveRfq } from "@/lib/resolve-rfq";
import { ReplyComposer } from "./reply-composer";
import { AttachmentPanel } from "./attachment-panel";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

export default async function RfqThreadPage({ params }: Props) {
  const { orgSlug, rfqId } = await params;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await resolveRfq(org.id, rfqId);
  const rfqUuid = rfq?.id;
  if (!rfq) notFound();

  // Opening the thread reads its emails — clear the dashboard unread badge.
  await rfqService.markEmailsRead(org.id, rfq.id);

  const attachmentsWithUrls = await Promise.all(
    rfq.attachments.map(async (a) => ({
      id: a.id,
      filename: a.filename,
      url: await storageService.presignedUrl(a.storageKey, 3600),
    })),
  );

  const [tDetail, tThread] = await Promise.all([
    getTranslations("rfqs.detail"),
    getTranslations("thread"),
  ]);

  const messages = rfq.threads.flatMap((t) => t.messages);
  messages.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

  const defaultTo = rfq.contact?.email ?? "";
  const defaultSubject = rfq.subject ? `Re: ${rfq.subject}` : "Re:";

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex-1 space-y-4 overflow-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{tDetail("no_messages")}</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-md border p-4 space-y-2 bg-white ${
                msg.direction === "outbound"
                  ? "border-[hsl(var(--primary)/0.3)] ml-8"
                  : "border-[hsl(var(--border))]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {msg.fromName ? `${msg.fromName} <${msg.fromEmail}>` : msg.fromEmail}
                  </p>
                  {msg.subject && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{msg.subject}</p>
                  )}
                </div>
                <time className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                  {new Date(msg.receivedAt).toLocaleString()}
                </time>
              </div>
              {msg.bodyText && (
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed border-t border-[hsl(var(--border))] pt-2 mt-2">
                  {msg.bodyText.slice(0, 2000)}
                  {msg.bodyText.length > 2000 && "…"}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      <div className="shrink-0">
        <div className="mb-4">
          <AttachmentPanel
            attachments={attachmentsWithUrls}
            labels={{
              all: tThread("attachments_all"),
              drawings: tThread("attachments_drawings"),
              cad: tThread("attachments_cad"),
              bom: tThread("attachments_bom"),
              other: tThread("attachments_other"),
              none: tDetail("no_attachments"),
            }}
          />
        </div>
        <ReplyComposer
          orgSlug={orgSlug}
          rfqId={rfqUuid ?? rfqId}
          defaultTo={defaultTo}
          defaultSubject={defaultSubject}
          labels={{
            reply: tThread("reply"),
            replyTo: tThread("reply_to"),
            replySubject: tThread("reply_subject"),
            replyBody: tThread("reply_body"),
            sendReply: tThread("send_reply"),
          }}
        />
      </div>
    </div>
  );
}
