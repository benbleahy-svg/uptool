import { getTranslations } from "next-intl/server";
import { SettingsNavLink } from "./settings-nav-link";

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { orgSlug } = await params;
  const t = await getTranslations("settings");

  return (
    <div className="flex gap-8 h-full">
      <nav className="w-48 shrink-0 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
          {/* Settings nav header — uses nav.settings key */}
        </p>
        <ul className="space-y-1">
          <li>
            <SettingsNavLink href={`/${orgSlug}/settings/shop`} label={t("shop.title")} />
          </li>
          <li>
            <SettingsNavLink href={`/${orgSlug}/settings/email-accounts`} label={t("email_accounts.title")} />
          </li>
          <li>
            <SettingsNavLink href={`/${orgSlug}/settings/operation-templates`} label={t("operation_templates.title")} />
          </li>
          <li>
            <SettingsNavLink href={`/${orgSlug}/settings/block-list`} label={t("block_list.title")} />
          </li>
          <li>
            <SettingsNavLink href={`/${orgSlug}/settings/members`} label={t("members.title")} />
          </li>
        </ul>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
