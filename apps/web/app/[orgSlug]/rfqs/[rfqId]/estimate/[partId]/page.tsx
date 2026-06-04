import { requireAuth } from "@/lib/auth";
import { resolveRfq } from "@/lib/resolve-rfq";
import { type DerivedRfqStatus, getRfqStatus } from "@/lib/rfq-status";
import { db } from "@uptool/db";
import { estimateService } from "@uptool/services";
import { EstimateView } from "./estimate-view";
import { type Part, getMockPart } from "./mocks/mockPart";
import { dbMaterialToClient, dbOperationToClient } from "./persistence";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string; partId: string }>;
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <p className="text-sm font-medium">Part not found</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
      </div>
    </div>
  );
}

function LoadError() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <p className="text-sm font-medium text-[hsl(var(--destructive))]">
          Couldn’t load this estimate
        </p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Something went wrong reading the estimate. Refresh to try again.
        </p>
      </div>
    </div>
  );
}

export default async function EstimatePartPage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam, partId } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) return <NotFound message="There is no estimate data for this part." />;

  const rfq = await resolveRfq(org.id, rfqParam);
  if (!rfq) return <NotFound message="This RFQ doesn’t exist." />;

  // Require a real DB part. The p1/p2/p3 mock-demo path is retired — the estimate
  // calculator now always reads persisted data (see ADR 0020).
  const dbPart = await db.query.parts.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, partId), eq(p.orgId, org.id)),
  });
  if (!dbPart || dbPart.rfqId !== rfq.id) {
    return <NotFound message="This part isn’t part of this RFQ." />;
  }

  const rfqStatus: DerivedRfqStatus = getRfqStatus(rfq);
  const partIds = (rfq.parts ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => p.id);

  // Hydrate on first open (idempotent), then load the canonical estimate state.
  // Never fall back to client mocks; surface an explicit error instead.
  let operations: ReturnType<typeof dbOperationToClient>[];
  let materials: ReturnType<typeof dbMaterialToClient>[];
  let hydratedAt: string;
  let notesExternal: string;
  let notesInternal: string;
  try {
    if (!dbPart.estimateHydratedAt) {
      await estimateService.hydratePartEstimate(org.id, partId);
    }
    const [ops, mats, fresh] = await Promise.all([
      estimateService.listPartOperations(org.id, partId),
      estimateService.listPartMaterials(org.id, partId),
      db.query.parts.findFirst({
        where: (p, { and, eq }) => and(eq(p.id, partId), eq(p.orgId, org.id)),
        columns: { estimateHydratedAt: true, notesExternal: true, notesInternal: true },
      }),
    ]);
    operations = ops.map(dbOperationToClient);
    materials = mats.map(dbMaterialToClient);
    hydratedAt = fresh?.estimateHydratedAt ? String(fresh.estimateHydratedAt.getTime()) : "0";
    notesExternal = fresh?.notesExternal ?? "";
    notesInternal = fresh?.notesInternal ?? "";
  } catch {
    return <LoadError />;
  }

  // Header metadata is still MOCK (geometry + AI-extraction verbatim arrive with
  // the extraction epic). Overlay the real part identity onto the mock header so
  // it isn't mistaken for real geometry/AI data.
  const mockHeader = getMockPart(partId);
  const part: Part = {
    ...(mockHeader as Part),
    partNumber: dbPart.partNumber ?? mockHeader?.partNumber ?? "",
    revision: dbPart.revision ?? mockHeader?.revision ?? "",
    description: dbPart.description ?? mockHeader?.description ?? "",
    material: dbPart.material ?? mockHeader?.material ?? "",
    finish: dbPart.finish ?? mockHeader?.finish ?? "",
  };

  return (
    <EstimateView
      // Remount with fresh state after a Reset (which nulls + re-stamps hydratedAt).
      key={hydratedAt}
      part={part}
      orgSlug={orgSlug}
      rfqParam={rfqParam}
      rfqId={rfq.id}
      rfqStatus={rfqStatus}
      partIds={partIds}
      initialOperations={operations}
      initialMaterials={materials}
      initialNotesExternal={notesExternal}
      initialNotesInternal={notesInternal}
    />
  );
}
