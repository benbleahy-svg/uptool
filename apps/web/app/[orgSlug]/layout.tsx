import { forbidden, notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@uptool/db";
import { eq, and, count } from "drizzle-orm";
import { rfqs } from "@uptool/db";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";

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

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });

  if (!org) {
    notFound();
  }

  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });

  if (!membership) {
    forbidden();
  }

  const [t, locale] = await Promise.all([
    getTranslations("nav"),
    getLocale(),
  ]);

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
          support: t("support"),
          signout: t("signout"),
          profile: t("profile"),
        }}
        userEmail={session.user.email ?? ""}
        userName={session.user.name ?? ""}
        locale={locale as "de" | "en-GB"}
      />
      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  );
}
