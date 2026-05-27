"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { replyService } from "@uptool/services";

export async function sendReply(formData: FormData) {
  await requireAuth();

  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const toEmail = formData.get("toEmail") as string;
  const subject = formData.get("subject") as string;
  const bodyText = formData.get("bodyText") as string;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) throw new Error("Org not found");

  const fromEmail = await replyService.resolveFromEmail(org.id);

  // Send via Resend
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject,
    text: bodyText,
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to send email");
  }

  await replyService.recordOutbound({
    orgId: org.id,
    rfqId,
    providerMessageId: data.id,
    fromEmail,
    toEmail,
    subject,
    bodyText,
  });

  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/thread`);
}
