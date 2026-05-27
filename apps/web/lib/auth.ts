import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const ext = session as { defaultOrgId?: string; defaultOrgSlug?: string; locale?: string };
  return {
    userId: session.user.id,
    defaultOrgId: ext.defaultOrgId,
    defaultOrgSlug: ext.defaultOrgSlug,
    locale: ext.locale ?? "de",
  };
}
