import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock token + SMTP-password lookups (covered separately by the email-token test).
const { getValidAccessTokenMock, getDecryptedSmtpPasswordMock } = vi.hoisted(() => ({
  getValidAccessTokenMock: vi.fn(),
  getDecryptedSmtpPasswordMock: vi.fn(),
}));
vi.mock("../email-token", () => ({
  getValidAccessToken: getValidAccessTokenMock,
  getDecryptedSmtpPassword: getDecryptedSmtpPasswordMock,
}));

// Mock nodemailer (SMTP adapter).
const { createTransportMock, sendMailMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  return { createTransportMock: vi.fn(() => ({ sendMail: sendMailMock })), sendMailMock };
});
vi.mock("nodemailer", () => ({ default: { createTransport: createTransportMock } }));

import type { EmailAccount } from "../index";
import { getSendAdapter } from "../index";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
  getValidAccessTokenMock.mockResolvedValue("tok-123");
  getDecryptedSmtpPasswordMock.mockResolvedValue("smtp-pw");
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  getValidAccessTokenMock.mockReset();
  getDecryptedSmtpPasswordMock.mockReset();
});

// Adapters only read a handful of fields; build a minimal account.
function account(overrides: Record<string, unknown>): EmailAccount {
  return {
    id: "acc-1",
    orgId: "org-1",
    provider: "gmail",
    email: "shop@example.com",
    smtpHost: null,
    smtpPort: null,
    smtpTls: true,
    smtpPassword: null,
    ...overrides,
  } as unknown as EmailAccount;
}

function firstCall(mock: ReturnType<typeof vi.fn>) {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("expected the mock to have been called");
  return call;
}

describe("GmailSendAdapter", () => {
  test("posts base64url MIME with headers + PDF attachment + threadId", async () => {
    await getSendAdapter(account({ provider: "gmail" })).sendQuoteEmail({
      account: account({ provider: "gmail" }),
      to: "buyer@acme.com",
      subject: "Quote #1",
      bodyText: "See attached.",
      pdfBase64: "UERGREFUQQ==",
      pdfFilename: "Quote-1.pdf",
      replyToMessageId: "<msg-9@acme.com>",
      threadId: "thread-abc",
    });

    const [url, opts] = firstCall(fetchMock);
    expect(url).toContain("/gmail/v1/users/me/messages/send");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    const body = JSON.parse(opts.body);
    expect(body.threadId).toBe("thread-abc");
    const mime = Buffer.from(body.raw, "base64url").toString("utf8");
    expect(mime).toContain("From: shop@example.com");
    expect(mime).toContain("To: buyer@acme.com");
    expect(mime).toContain("Subject: Quote #1");
    expect(mime).toContain("In-Reply-To: <msg-9@acme.com>");
    expect(mime).toContain("References: <msg-9@acme.com>");
    expect(mime).toContain('filename="Quote-1.pdf"');
    expect(mime).toContain("UERGREFUQQ==");
  });

  test("throws on non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => "denied" });
    await expect(
      getSendAdapter(account({ provider: "gmail" })).sendQuoteEmail({
        account: account({ provider: "gmail" }),
        to: "b@a.com",
        subject: "s",
        bodyText: "b",
        pdfBase64: "QUJD",
        pdfFilename: "q.pdf",
      }),
    ).rejects.toThrow(/Gmail send failed/);
  });
});

describe("MicrosoftSendAdapter", () => {
  test("uses /reply with attachment when replyToMessageId is set", async () => {
    await getSendAdapter(account({ provider: "microsoft" })).sendQuoteEmail({
      account: account({ provider: "microsoft" }),
      to: "buyer@acme.com",
      subject: "Quote #1",
      bodyText: "Hi",
      pdfBase64: "QUJD",
      pdfFilename: "Quote-1.pdf",
      replyToMessageId: "AAMk123",
    });
    const [url, opts] = firstCall(fetchMock);
    expect(url).toContain("/me/messages/AAMk123/reply");
    const body = JSON.parse(opts.body);
    expect(body.message.attachments[0].name).toBe("Quote-1.pdf");
    expect(body.message.attachments[0].contentBytes).toBe("QUJD");
    expect(body.message.body.content).toBe("Hi");
  });

  test("uses /sendMail with recipients when no replyToMessageId", async () => {
    await getSendAdapter(account({ provider: "microsoft" })).sendQuoteEmail({
      account: account({ provider: "microsoft" }),
      to: "buyer@acme.com",
      subject: "Quote #1",
      bodyText: "Hi",
      pdfBase64: "QUJD",
      pdfFilename: "Quote-1.pdf",
    });
    const [url, opts] = firstCall(fetchMock);
    expect(url).toContain("/me/sendMail");
    const body = JSON.parse(opts.body);
    expect(body.message.toRecipients[0].emailAddress.address).toBe("buyer@acme.com");
    expect(body.message.attachments[0].contentBytes).toBe("QUJD");
    expect(body.saveToSentItems).toBe(true);
  });
});

describe("ImapSmtpSendAdapter", () => {
  test("nodemailer transport config + threading headers + PDF buffer", async () => {
    await getSendAdapter(
      account({ provider: "imap", smtpHost: "smtp.x.eu", smtpPort: 465, smtpTls: true }),
    ).sendQuoteEmail({
      account: account({ provider: "imap", smtpHost: "smtp.x.eu", smtpPort: 465, smtpTls: true }),
      to: "buyer@acme.com",
      subject: "Quote #1",
      bodyText: "Hi",
      pdfBase64: "QUJD",
      pdfFilename: "Quote-1.pdf",
      replyToMessageId: "<m-1@x>",
    });

    expect(getDecryptedSmtpPasswordMock).toHaveBeenCalledWith("acc-1");
    const [cfg] = firstCall(createTransportMock);
    expect(cfg).toMatchObject({
      host: "smtp.x.eu",
      port: 465,
      secure: true,
      auth: { user: "shop@example.com", pass: "smtp-pw" },
    });
    const [mail] = firstCall(sendMailMock);
    expect(mail.from).toBe("shop@example.com");
    expect(mail.to).toBe("buyer@acme.com");
    expect(mail.inReplyTo).toBe("<m-1@x>");
    expect(mail.references).toBe("<m-1@x>");
    expect(mail.attachments[0].filename).toBe("Quote-1.pdf");
    expect(Buffer.isBuffer(mail.attachments[0].content)).toBe(true);
  });
});

test("getSendAdapter throws for an unknown provider", () => {
  expect(() => getSendAdapter(account({ provider: "carrier-pigeon" }))).toThrow(
    /No send adapter/,
  );
});
