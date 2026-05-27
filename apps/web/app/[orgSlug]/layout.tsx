import { forbidden, notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@uptool/db";
import { eq, and, count } from "drizzle-orm";
import { rfqs } from "@uptool/db";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { UserMenu } from "./user-menu";
import { LanguageSwitcher } from "@/components/language-switcher";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const userId = session.user.id;

  // Validate org exists
  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });

  if (!org) {
    notFound();
  }

  // Validate membership
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });

  if (!membership) {
    forbidden();
  }

  const t = await getTranslations("nav");
  const locale = await getLocale();

  const [newRfqResult] = await db
    .select({ count: count() })
    .from(rfqs)
    .where(and(eq(rfqs.orgId, org.id), eq(rfqs.status, "new")));
  const newRfqCount = newRfqResult?.count ?? 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        orgSlug={orgSlug}
        newRfqCount={newRfqCount}
        navLabels={{
          rfqs: t("rfqs"),
          customers: t("customers"),
          settings: t("settings"),
        }}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-end gap-3 border-b border-[hsl(var(--border))] bg-white px-6">
          <LanguageSwitcher currentLocale={locale as "de" | "en-GB"} />
          <UserMenu
            userEmail={session.user.email ?? ""}
            userName={session.user.name ?? ""}
            signOutLabel={t("signout")}
          />
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-auto bg-white p-6">{children}</main>
      </div>
    </div>
  );
}
