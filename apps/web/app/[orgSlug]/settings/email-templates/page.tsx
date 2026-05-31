import { requireAuth } from "@/lib/auth";
import { db } from "@uptool/db";
import { emailTemplateService } from "@uptool/services";
import { notFound } from "next/navigation";
import { EmailTemplatesForm } from "./email-templates-form";
import { saveEmailTemplates } from "./actions";
import { getEmailTemplateStrings } from "./strings";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function EmailTemplatesPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  // Stored templates merged over defaults — the form always has usable copy.
  const resolved = await emailTemplateService.resolve(org.id);

  // English UI for now; the de stub keeps localization a data-only change.
  const s = getEmailTemplateStrings("en");

  return (
    <EmailTemplatesForm
      orgSlug={orgSlug}
      initial={resolved}
      s={s}
      onSave={saveEmailTemplates}
    />
  );
}
