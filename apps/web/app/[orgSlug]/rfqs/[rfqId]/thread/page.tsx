import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { rfqService, quoteService, storageService } from "@uptool/services";
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

  const rfq = await rfqService.findById(org.id, rfqId);
  if (!rfq) notFound();

  const attachmentsWithUrls = await Promise.all(
    rfq.attachments.map(async (a) => ({
      id: a.id,
      filename: a.filename,
      url: await storageService.presignedUrl(a.storageKey, 3600),
    })),
  );

  const quotes = await quoteService.findByRfq(org.id, rfqId);

  const [tDetail, tThread] = await Promise.all([
    getTranslations("rfqs.detail"),
    getTranslations("thread"),
  ]);

  const messages = rfq.threads.flatMap((t) => t.messages);
  messages.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

  type TimelineEvent = { label: string; at: Date; icon: "mail-in" | "mail-out" | "quote" | "rfq" };
  const timeline: TimelineEvent[] = [
    { label: tDetail("timeline_received"), at: new Date(rfq.receivedAt), icon: "rfq" },
    ...messages.map((m) => ({
      label:
        m.direction === "outbound"
          ? tDetail("timeline_reply_sent")
          : `${tDetail("timeline_email_from")} ${m.fromName ?? m.fromEmail}`,
      at: new Date(m.receivedAt),
      icon: (m.direction === "outbound" ? "mail-out" : "mail-in") as TimelineEvent["icon"],
    })),
    ...quotes.flatMap((q) => {
      const events: TimelineEvent[] = [
        {
          label: `${tDetail("timeline_quote_created")} #${q.quoteNumber}`,
          at: new Date(q.createdAt),
          icon: "quote" as const,
        },
      ];
      if (q.sentAt) {
        events.push({
          label: `${tDetail("timeline_quote_sent")} #${q.quoteNumber}`,
          at: new Date(q.sentAt),
          icon: "quote" as const,
        });
      }
      return events;
    }),
  ];
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  const defaultTo = rfq.contact?.email ?? "";
  const defaultSubject = rfq.subject ? `Re: ${rfq.subject}` : "Re:";

  return (
    <div className="flex gap-6 h-full">
      {/* Left: email thread + reply composer */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="space-y-4 flex-1">
          {messages.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{tDetail("no_messages")}</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-md border p-4 space-y-2 ${
                  msg.direction === "outbound"
                    ? "border-[hsl(var(--primary)/0.3)] bg-blue-50/50 ml-8"
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

        <ReplyComposer
          orgSlug={orgSlug}
          rfqId={rfqId}
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

      {/* Right: metadata + attachments */}
      <div className="w-64 shrink-0 space-y-6">
        <div className="rounded-md border border-[hsl(var(--border))] p-4 space-y-3">
          <MetaRow label={tDetail("meta_customer")} value={rfq.customer?.name ?? "—"} />
          <MetaRow label={tDetail("meta_contact")} value={rfq.contact?.email ?? "—"} />
          <MetaRow label={tDetail("meta_received")} value={new Date(rfq.receivedAt).toLocaleDateString()} />
          <MetaRow label={tDetail("meta_assignee")} value={rfq.assignee?.name ?? rfq.assignee?.email ?? "—"} />
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
            {tDetail("attachments")}
          </h2>
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

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
            {tDetail("timeline")}
          </h2>
          <ol className="relative border-l border-[hsl(var(--border))] ml-2 space-y-4">
            {timeline.map((event) => (
              <li key={`${event.label}-${event.at.getTime()}`} className="pl-4">
                <div className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white bg-[hsl(var(--muted-foreground))]" />
                <p className="text-xs text-[hsl(var(--foreground))] leading-snug">{event.label}</p>
                <time className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {event.at.toLocaleDateString()}
                </time>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
