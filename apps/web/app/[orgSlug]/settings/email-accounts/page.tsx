import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { emailAccountService, blockListService } from "@uptool/services";
import {
  addBlockListEntry,
  connectGoogleAccount,
  connectMicrosoftAccount,
  removeBlockListEntry,
} from "./actions";
import { DisconnectButton } from "./disconnect-button";
import { ForwardingAddressSection } from "./forwarding-address-section";
import { ImapConnectDialog } from "./imap-connect-dialog";

interface Props {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ connected?: string; error?: string }>;
}

export default async function EmailAccountsPage({ params, searchParams }: Props) {
  const { orgSlug } = await params;
  const { connected, error } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const [accounts, blockEntries] = await Promise.all([
    emailAccountService.findByOrg(org.id),
    blockListService.findByOrg(org.id),
  ]);

  const t = await getTranslations("settings");

  return (
    <div className="max-w-2xl space-y-10">
      {connected === "1" && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Account connected successfully.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          Connection failed ({error}). Please try again.
        </div>
      )}

      {/* Email accounts section */}
      <section>
        <h1 className="text-lg font-semibold mb-1">{t("email_accounts.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          {t("email_accounts.subtitle")}
        </p>

        <div className="flex gap-3 mb-6">
          <form action={connectMicrosoftAccount.bind(null, orgSlug)}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-white px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <MicrosoftIcon />
              {t("email_accounts.add_microsoft")}
            </button>
          </form>
          <form action={connectGoogleAccount.bind(null, orgSlug)}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-white px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <GoogleIcon />
              {t("email_accounts.add_google")}
            </button>
          </form>
          <ImapConnectDialog
            orgSlug={orgSlug}
            strings={{
              button: t("imap.button"),
              dialog_title: t("imap.dialog_title"),
              email: t("imap.email"),
              server: t("imap.server"),
              port: t("imap.port"),
              tls: t("imap.tls"),
              password: t("imap.password"),
              connecting: t("imap.connecting"),
              connect: t("imap.connect"),
              connect_failed: t("imap.connect_failed"),
            }}
          />
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("email_accounts.no_accounts")}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[hsl(var(--border))] border border-[hsl(var(--border))] rounded-md">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-medium shrink-0">
                      <span className={account.provider === "imap" ? "text-[9px]" : "text-xs"}>
                        {account.provider === "microsoft"
                          ? "M"
                          : account.provider === "imap"
                            ? "IMAP"
                            : "G"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{account.email}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {account.status === "error"
                          ? t("email_accounts.status_error")
                          : t("email_accounts.status_connected")}{" "}
                        · {account.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <DisconnectButton
                    accountId={account.id}
                    orgSlug={orgSlug}
                    label={t("email_accounts.disconnect")}
                    confirmText={t("email_accounts.disconnect_confirm")}
                  />
                </li>
              ))}
            </ul>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
              {t("email_accounts.first_check_info")}
            </p>
          </>
        )}
      </section>

      {/* Forwarding address section */}
      {org.forwardingAddress && (
        <ForwardingAddressSection
          address={org.forwardingAddress}
          title={t("email_accounts.forwarding_title")}
          subtitle={t("email_accounts.forwarding_subtitle")}
          copyLabel={t("email_accounts.forwarding_copy")}
          copiedLabel={t("email_accounts.forwarding_copied")}
        />
      )}

      {/* Block list section */}
      <section>
        <h2 className="text-base font-semibold mb-1">{t("block_list.title")}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          {t("block_list.subtitle")}
        </p>

        <form action={addBlockListEntry} className="flex gap-2 mb-4">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input
            name="value"
            type="text"
            placeholder={t("block_list.placeholder")}
            className="flex-1 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          <button
            type="submit"
            className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("block_list.add")}
          </button>
        </form>

        {blockEntries.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("block_list.empty")}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))] border border-[hsl(var(--border))] rounded-md">
            {blockEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm font-mono">{entry.value}</span>
                <form action={removeBlockListEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <button
                    type="submit"
                    className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600 transition-colors"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <title>Microsoft</title>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><title>Google</title>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
