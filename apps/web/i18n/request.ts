import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@uptool/db";

type Locale = "de" | "en-GB";

const SUPPORTED_LOCALES: Locale[] = ["de", "en-GB"];
const DEFAULT_LOCALE: Locale = "de";

function isSupported(locale: string | null | undefined): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

async function resolveLocale(): Promise<Locale> {
  // 1. ?locale= query param (passed via x-locale header set in middleware)
  const headersList = await headers();
  const fromHeader = headersList.get("x-locale");
  if (isSupported(fromHeader)) return fromHeader;

  // 2. User's locale from JWT session
  const session = await auth();
  const fromSession = (session as { locale?: string } | null)?.locale;
  if (isSupported(fromSession)) return fromSession;

  // 3. Org's locale_default (if we have an org slug from middleware)
  const orgSlug = headersList.get("x-potential-slug");
  if (orgSlug) {
    const org = await db.query.orgs.findFirst({
      where: (o, { eq }) => eq(o.slug, orgSlug),
    });
    const fromOrg = org?.localeDefault;
    if (isSupported(fromOrg)) return fromOrg;
  }

  // 4. Accept-Language header
  const acceptLanguage = headersList.get("accept-language") ?? "";
  if (acceptLanguage.includes("en")) return "en-GB";

  // 5. Fallback
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
