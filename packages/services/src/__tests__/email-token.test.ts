process.env.ENCRYPTION_KEY ||= Buffer.alloc(32).toString("base64");

import { db, emailAccounts } from "@uptool/db";
import { encrypt } from "@uptool/shared/crypto";
import { afterEach, expect, test } from "vitest";
import { getDecryptedSmtpPassword } from "../index";
import { createOrg, dropOrg } from "./helpers/fixtures";

const createdOrgs: string[] = [];
afterEach(async () => {
  for (const id of createdOrgs.splice(0)) await dropOrg(id);
});

test("smtp_password is stored encrypted and decrypts to the original", async () => {
  const orgId = await createOrg();
  createdOrgs.push(orgId);

  const [a] = await db
    .insert(emailAccounts)
    .values({
      orgId,
      provider: "imap",
      email: "smtp@shop.test",
      status: "connected",
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpTls: true,
      smtpPassword: encrypt("s3cret-smtp"),
    })
    .returning();
  if (!a) throw new Error("failed to create account");

  expect(a.smtpPassword).toBeTruthy();
  expect(a.smtpPassword).not.toBe("s3cret-smtp"); // not plaintext at rest
  expect(await getDecryptedSmtpPassword(a.id)).toBe("s3cret-smtp");
});
