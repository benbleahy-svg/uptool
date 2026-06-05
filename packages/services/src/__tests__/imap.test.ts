// Must be set before any encrypt/decrypt call (getKey reads it at call time).
process.env.ENCRYPTION_KEY ||= Buffer.alloc(32).toString("base64");

import { db, users } from "@uptool/db";
import { decrypt, encrypt } from "@uptool/shared/crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ImapConnectionError,
  emailAccountService,
  emailIngestService,
  pollImapMailbox,
  testImapConnection,
} from "../index";
import { createOrg, dropOrg } from "./helpers/fixtures";

// imapflow + mailparser are mocked so tests never touch a real network.
const { connectMock, searchMock, fetchOneMock, flagsMock, logoutMock, lockReleaseMock, parseMock } =
  vi.hoisted(() => ({
    connectMock: vi.fn(),
    searchMock: vi.fn(),
    fetchOneMock: vi.fn(),
    flagsMock: vi.fn(),
    logoutMock: vi.fn(),
    lockReleaseMock: vi.fn(),
    parseMock: vi.fn(),
  }));

vi.mock("imapflow", () => ({
  ImapFlow: vi.fn(() => ({
    connect: connectMock,
    getMailboxLock: vi.fn(async () => ({ release: lockReleaseMock })),
    search: searchMock,
    fetchOne: fetchOneMock,
    messageFlagsAdd: flagsMock,
    logout: logoutMock,
  })),
}));
vi.mock("mailparser", () => ({ simpleParser: parseMock }));
// Avoid opening a Redis connection when connectImap registers the poll job.
vi.mock("../email-poll-scheduler", () => ({
  registerAccountPoll: vi.fn(),
  cancelAccountPoll: vi.fn(),
  syncAccountPolls: vi.fn(),
  POLL_INTERVAL_MS: 300000,
}));

const createdOrgs: string[] = [];
const createdUsers: string[] = [];

// All imapflow client methods must return promises (the adapter awaits + .catch).
beforeEach(() => {
  connectMock.mockResolvedValue(undefined);
  searchMock.mockResolvedValue([]);
  fetchOneMock.mockResolvedValue(false);
  flagsMock.mockResolvedValue(undefined);
  logoutMock.mockResolvedValue(undefined);
  parseMock.mockResolvedValue({});
});

afterEach(async () => {
  for (const id of createdOrgs.splice(0)) await dropOrg(id);
  for (const id of createdUsers.splice(0)) await db.delete(users).where(eq(users.id, id));
  vi.restoreAllMocks();
  for (const m of [connectMock, searchMock, fetchOneMock, flagsMock, logoutMock, lockReleaseMock, parseMock])
    m.mockReset();
});

async function setup() {
  const orgId = await createOrg();
  createdOrgs.push(orgId);
  const [u] = await db
    .insert(users)
    .values({ email: `imap-${crypto.randomUUID()}@test.local` })
    .returning({ id: users.id });
  if (!u) throw new Error("failed to create user");
  createdUsers.push(u.id);
  return { orgId, userId: u.id };
}

const validConfig = {
  email: "shop@example.com",
  imapHost: "mail.example.com",
  imapPort: 993,
  imapTls: true,
  password: "s3cret-pw",
};

describe("connectImap", () => {
  test("creates an imap account with the password encrypted at rest", async () => {
    const { orgId, userId } = await setup();

    const account = await emailAccountService.connectImap({ orgId, userId, ...validConfig });
    if (!account) throw new Error("connectImap returned no account");

    expect(account.provider).toBe("imap");
    expect(account.email).toBe(validConfig.email);
    expect(account.status).toBe("connected");
    expect(account.imapHost).toBe(validConfig.imapHost);
    expect(account.imapPort).toBe(validConfig.imapPort);

    const row = await db.query.emailAccounts.findFirst({
      where: (a, { eq: e }) => e(a.id, account.id),
    });
    // Never plaintext at rest; round-trips back to the original.
    const stored = row?.imapPassword;
    if (!stored) throw new Error("imap_password not stored");
    expect(stored).not.toBe(validConfig.password);
    expect(decrypt(stored)).toBe(validConfig.password);
  });
});

describe("testImapConnection", () => {
  test("throws ImapConnectionError on a failed login and saves nothing", async () => {
    connectMock.mockRejectedValueOnce(new Error("Invalid credentials"));

    await expect(testImapConnection(validConfig)).rejects.toBeInstanceOf(ImapConnectionError);

    // testImapConnection never persists — confirm no imap row exists for this config.
    const rows = await db.query.emailAccounts.findMany({
      where: (a, { eq: e }) => e(a.provider, "imap"),
    });
    expect(rows.find((r) => r.email === validConfig.email)).toBeUndefined();
  });
});

describe("pollImapMailbox", () => {
  test("fetches unseen, ingests with the shared 'imap' payload shape, marks seen", async () => {
    const ingestSpy = vi.spyOn(emailIngestService, "ingestMessage").mockResolvedValue("created");
    const statusSpy = vi.spyOn(emailAccountService, "updateStatus").mockResolvedValue();
    const checkedSpy = vi.spyOn(emailAccountService, "updateLastChecked").mockResolvedValue();

    searchMock.mockResolvedValueOnce([101]);
    fetchOneMock.mockResolvedValueOnce({ source: Buffer.from("raw-mime") });
    parseMock.mockResolvedValueOnce({
      from: { value: [{ address: "buyer@acme.com", name: "Buyer" }] },
      to: { value: [{ address: "shop@example.com" }] },
      subject: "RFQ bracket",
      text: "Please quote.",
      date: new Date("2026-06-05T10:00:00Z"),
      messageId: "<msg-101@acme.com>",
      references: undefined,
      attachments: [
        {
          filename: "bracket.step",
          contentType: "model/step",
          size: 9,
          content: Buffer.from("STEPDATA!"),
        },
      ],
    });

    const account = {
      id: "acc-1",
      orgId: "org-1",
      email: "shop@example.com",
      imapHost: "mail.example.com",
      imapPort: 993,
      imapTls: true,
      imapPassword: encrypt("s3cret-pw"),
      lastCheckedAt: null,
    };

    await pollImapMailbox(account);

    expect(ingestSpy).toHaveBeenCalledTimes(1);
    const call = ingestSpy.mock.calls[0];
    if (!call) throw new Error("ingestMessage was not called");
    const payload = call[0];
    expect(payload).toMatchObject({
      orgId: "org-1",
      emailAccountId: "acc-1",
      provider: "imap",
      providerMessageId: "<msg-101@acme.com>",
      providerThreadId: "<msg-101@acme.com>",
      fromEmail: "buyer@acme.com",
      fromName: "Buyer",
      toEmails: ["shop@example.com"],
      subject: "RFQ bracket",
      bodyText: "Please quote.",
    });
    expect(payload.attachments).toHaveLength(1);
    const att = payload.attachments[0];
    if (!att) throw new Error("expected one attachment");
    expect(att).toMatchObject({
      filename: "bracket.step",
      contentType: "model/step",
      sizeBytes: 9,
    });
    expect(Buffer.isBuffer(att.data)).toBe(true);

    // Marked \Seen by UID, and status advanced like the OAuth adapters.
    expect(flagsMock).toHaveBeenCalledWith("101", ["\\Seen"], { uid: true });
    expect(checkedSpy).toHaveBeenCalledWith("acc-1");
    expect(statusSpy).toHaveBeenCalledWith("acc-1", "connected");
  });
});
