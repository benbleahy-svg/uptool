"use client";

import type { MaterialCard } from "@/lib/quoting/materialCost";
import type { Operation } from "@/lib/quoting/operationCost";
import type { DerivedRfqStatus } from "@/lib/rfq-status";
import { Calculator } from "./calculator";
import { FileViewerPane } from "./file-viewer-pane";
import type { Part } from "./mocks/mockPart";
import { SplitPane } from "./split-pane";

interface Props {
  part: Part;
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  rfqStatus: DerivedRfqStatus;
  partIds: string[];
  initialOperations: Operation[];
  initialMaterials: MaterialCard[];
  initialNotesExternal: string;
  initialNotesInternal: string;
}

export function EstimateView({
  part,
  orgSlug,
  rfqParam,
  rfqId,
  rfqStatus,
  partIds,
  initialOperations,
  initialMaterials,
  initialNotesExternal,
  initialNotesInternal,
}: Props) {
  return (
    <SplitPane
      left={
        <Calculator
          part={part}
          orgSlug={orgSlug}
          rfqParam={rfqParam}
          rfqId={rfqId}
          rfqStatus={rfqStatus}
          partIds={partIds}
          initialOperations={initialOperations}
          initialMaterials={initialMaterials}
          initialNotesExternal={initialNotesExternal}
          initialNotesInternal={initialNotesInternal}
        />
      }
      right={<FileViewerPane partId={part.id} />}
    />
  );
}
