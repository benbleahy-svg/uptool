import { getTranslations } from "next-intl/server";
import { SettingsNavLink } from "./settings-nav-link";

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { orgSlug } = await params;
  const t = await getTranslations("settings");

  const navItems = [
    { key: "nav_general", href: `/${orgSlug}/settings/general` },
    { key: "nav_users", href: `/${orgSlug}/settings/users` },
    { key: "nav_billing", href: `/${orgSlug}/settings/billing` },
    { key: "nav_calculator_templates", href: `/${orgSlug}/settings/calculator-templates` },
    { key: "nav_workflow_templates", href: `/${orgSlug}/settings/workflow-templates` },
    { key: "nav_quote_template", href: `/${orgSlug}/settings/quote-template` },
    { key: "nav_email_templates", href: `/${orgSlug}/settings/email-templates` },
    { key: "nav_email_accounts", href: `/${orgSlug}/settings/email-accounts` },
    { key: "nav_block_list", href: `/${orgSlug}/settings/block-list` },
    { key: "nav_rfq_web_form", href: `/${orgSlug}/settings/rfq-web-form` },
    { key: "nav_learning", href: `/${orgSlug}/settings/learning` },
  ] as const;

  const navLabels: Record<string, string> = {
    nav_general: t("nav_general"),
    nav_users: t("nav_users"),
    nav_billing: t("nav_billing"),
    nav_calculator_templates: t("nav_calculator_templates"),
    nav_workflow_templates: t("nav_workflow_templates"),
    nav_quote_template: t("nav_quote_template"),
    nav_email_templates: t("nav_email_templates"),
    nav_email_accounts: t("email_accounts.title"),
    nav_block_list: t("block_list.title"),
    nav_rfq_web_form: t("nav_rfq_web_form"),
    nav_learning: t("nav_learning"),
  };

  return (
    <div className="flex h-full">
      {/* Settings second-level nav */}
      <nav className="w-[220px] shrink-0 border-r border-[hsl(var(--border))] pt-8 pb-6 px-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] px-3 mb-2">
          {t("nav_heading")}
        </p>
        <ul className="mt-2 space-y-0.5">
          {navItems.map((item) => (
            <li key={item.key}>
              <SettingsNavLink href={item.href} label={navLabels[item.key] ?? item.key} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-8 min-w-0">{children}</div>
    </div>
  );
}
