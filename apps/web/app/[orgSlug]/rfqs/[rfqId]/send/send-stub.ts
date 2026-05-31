// Shape of the original email the Send composer replies to. This is now sourced
// from the RFQ's real thread (the most recent message — same data the Messaging
// page shows). STUB_ORIGINAL_EMAIL is only a fallback when the RFQ has no thread.

export interface OriginalEmail {
  /** Reply-from address (our inbox); carries the (stubbed) needs-verification warning. */
  replyFromEmail: string;
  replyFromUnverified: boolean;
  dateLabel: string;
  /** Full message body, rendered read-only (pre-wrap). */
  bodyText: string;
  /** Attachment filenames on the original message. */
  attachments: string[];
}

export const STUB_ORIGINAL_EMAIL: OriginalEmail = {
  replyFromEmail: "rfq@wemillyouchill.com",
  replyFromUnverified: true,
  dateLabel: "Feb 13, 9:12 AM",
  bodyText:
    "Alex,\n\nThank you for the opportunity to quote this project. Lead times are ARO. Phone # 456-7890 Thank you - Chip\n\nChip Maker | chip@wemillyouchill.com | 123-456-7890",
  attachments: ["Quote 1187 We Mill You Chill 2026-02-12.pdf"],
};

/** Default reply body referencing the quote (pre-filled, editable). */
export function defaultReplyBody(contactName: string, quoteNumber: number): string {
  const first = contactName.split(/\s+/)[0] || "there";
  return [
    `Hi ${first},`,
    "",
    `Thank you for the opportunity to quote this project. Please find Quote ${quoteNumber} attached.`,
    "Lead times are ARO. Please call with any questions or concerns.",
    "",
    "Best regards",
  ].join("\n");
}
