import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

// Arbeitsgangvorlagen has been folded into Kalkulationsvorlagen
// (settings/calculator-templates), which manages operation_templates with the full
// field set (cost_category, rate, more types). This route redirects so old links
// land on the canonical page. See prompt-3 decision.
export default async function OperationTemplatesRedirect({ params }: Props) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/settings/calculator-templates`);
}
