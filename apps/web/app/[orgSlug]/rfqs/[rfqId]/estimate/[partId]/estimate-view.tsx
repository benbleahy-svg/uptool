"use client";

import { Calculator } from "./calculator";
import { FileViewerPane } from "./file-viewer-pane";
import type { Part } from "./mocks/mockPart";
import { SplitPane } from "./split-pane";

interface Props {
  part: Part;
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  partIds: string[];
}

export function EstimateView({ part, orgSlug, rfqParam, rfqId, partIds }: Props) {
  return (
    <SplitPane
      left={
        <Calculator
          part={part}
          orgSlug={orgSlug}
          rfqParam={rfqParam}
          rfqId={rfqId}
          partIds={partIds}
        />
      }
      right={<FileViewerPane partId={part.id} />}
    />
  );
}
