import { auth } from "@/auth";
import { db } from "@uptool/db";
import { storageService } from "@uptool/services";
import { type NextRequest, NextResponse } from "next/server";

// Streams an attachment's file bytes from storage (same-origin, so it's
// CSP-safe for in-app previews). Auth + org-membership checked.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const attachment = await db.query.attachments.findFirst({
    where: (a, { eq }) => eq(a.id, id),
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, attachment.orgId), eq(m.userId, userId)),
  });
  if (!membership) return new NextResponse("Forbidden", { status: 403 });

  try {
    const { body, contentType } = await storageService.download(attachment.storageKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }
}
