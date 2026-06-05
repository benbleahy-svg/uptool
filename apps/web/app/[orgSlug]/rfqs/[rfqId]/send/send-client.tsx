"use client";

// Send page: left = the DIN-5008 quote PDF from /api/quotes/[id]/pdf (persisted
// rows, pdf.js canvas — preview == attachment); right = the email composer. Send
// goes through sendQuoteAction (Resend + status transition). An already-sent
// quote shows its sentAt + Re-send + Create-revision instead of first-send.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  toast,
} from "@uptool/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createQuoteRevisionAction, sendQuoteAction } from "./actions";
import { QuotePdfPane } from "./quote-pdf-pane";
import type { SendViewProps } from "./send-view";

export function SendClient({
  orgSlug,
  rfqParam,
  rfqId,
  quoteId,
  quoteNumber,
  status,
  sentAtISO,
  hasSentQuote,
  defaultTo,
  defaultSubject,
  defaultBody,
  sendAccounts,
  resolvedAccountId,
}: SendViewProps) {
  const t = useTranslations("send");
  const router = useRouter();

  const [to, setTo] = React.useState(defaultTo);
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState(defaultBody);
  const [sending, setSending] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [fromAccountId, setFromAccountId] = React.useState(
    resolvedAccountId ?? sendAccounts[0]?.id ?? "",
  );

  // No connected account can send → block the composer entirely.
  const blocked = sendAccounts.length === 0;

  const [pdf, setPdf] = React.useState<{ url: string; blob: Blob } | null>(null);
  const [pdfError, setPdfError] = React.useState(false);
  const startedRef = React.useRef(false);
  const urlRef = React.useRef<string | null>(null);

  // Fetch the server-rendered PDF once; the blob feeds preview + Download/Print.
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    fetch(`/api/quotes/${quoteId}/pdf`)
      .then((r) => {
        if (!r.ok) throw new Error(`pdf ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        urlRef.current = URL.createObjectURL(blob);
        setPdf({ url: urlRef.current, blob });
      })
      .catch(() => setPdfError(true));
  }, [quoteId]);

  React.useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const isSent = status === "sent";
  const isRevision = status === "draft" && hasSentQuote;
  const downloadName = `Quote-${quoteNumber}.pdf`;

  async function doSend() {
    setSending(true);
    const res = await sendQuoteAction({
      orgSlug,
      rfqParam,
      rfqId,
      to,
      subject,
      body,
      overrideSendAccountId: fromAccountId || undefined,
    });
    setSending(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(t("sent"));
      router.refresh();
    } else {
      toast.error(res.error === "no_send_account" ? t("no_send_account") : t("send_failed"));
    }
  }

  async function doRevision() {
    const res = await createQuoteRevisionAction({ orgSlug, rfqParam, rfqId });
    if (res.ok) {
      toast.success(t("revision"));
      router.push(`/${orgSlug}/rfqs/${rfqParam}/quote`);
    } else {
      toast.error(t("send_failed"));
    }
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 basis-1/2">
        <QuotePdfPane
          blob={pdf?.blob ?? null}
          url={pdf?.url ?? null}
          loading={!pdf && !pdfError}
          error={pdfError}
          quoteLabel={String(quoteNumber)}
          downloadName={downloadName}
        />
      </div>

      <aside className="min-w-0 flex-1 basis-1/2 overflow-auto border-l border-gray-200 p-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">{t("send_quote")}</h1>
          {isRevision && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {t("revision_badge")}
            </span>
          )}
        </div>

        {isSent && sentAtISO && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {t("sent_at", { date: new Date(sentAtISO).toLocaleString() })}
          </div>
        )}

        {blocked ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p>{t("no_send_account")}</p>
            <Link
              href={`/${orgSlug}/settings/email-accounts`}
              className="mt-2 inline-block font-medium underline"
            >
              {t("go_to_settings")}
            </Link>
          </div>
        ) : (
        <div className="space-y-4">
          <Labelled label={t("sending_from")}>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              {sendAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label={t("to")}>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </Labelled>
          <Labelled label={t("subject")}>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </Labelled>
          <Labelled label={t("body")}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full resize-y rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </Labelled>

          <div className="flex items-center gap-3">
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={sending || to.trim() === ""}
                  className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50"
                >
                  {sending ? t("sending") : isSent ? t("resend") : t("send_quote")}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("confirm_title", { number: quoteNumber })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("confirm_body", { email: to })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={doSend}>
                    {isSent ? t("resend") : t("send_quote")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isSent && (
              <button
                type="button"
                onClick={doRevision}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("revision")}
              </button>
            )}
          </div>
        </div>
        )}
      </aside>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the input passed as children
    <label className="block">
      <span className="mb-1 block text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
