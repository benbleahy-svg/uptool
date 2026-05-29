# ADR 0011 — Estimate File Viewer (PDF + 3D CAD)

## Status

Accepted

## Context

The right pane of the estimate page shows the part's drawing (PDF) and CAD model
(STEP), toggled by a floating thumbnail, with a fullscreen CAD inspector. The
brief mandated `react-pdf` (pdf.js) and `online-3d-viewer` (occt-import-js).

## Decision

1. **pdf.js worker is self-hosted.** `pdf.worker.min.mjs` (from the bundled
   pdfjs-dist 5.4.296) is copied to `/public` and set as `workerSrc`. Keeps
   pdf.js same-origin — no CSP change needed for drawings.

2. **CSP relaxed for `online-3d-viewer`'s CDN.** `online-3d-viewer@0.18.0`
   hardcodes loading the occt-import-js (STEP) parser + a blob `Worker` from
   `https://cdn.jsdelivr.net` (no override API in this version). To allow STEP to
   render, `next.config.ts` CSP now permits `https://cdn.jsdelivr.net` in
   `script-src`/`connect-src`, plus `blob:` and `worker-src 'self' blob:`. This is
   the one externally-sourced-script exception; scoped to jsDelivr. Revisit if we
   later vendor occt-import-js locally (would require patching the library).

3. **The fullscreen inspector is custom chrome around `EmbeddedViewer`.** The npm
   package ships only the engine + `EmbeddedViewer`, not the 3dviewer.net website
   UI, so the toolbar / Meshes rail / Details panel in `15_3` are built by us
   (`cad-inspector-dialog.tsx`). Vertices/triangles/bbox dimensions are pulled
   from the loaded model.

4. **Popout opens the current page in a new tab** (`window.open(location.href)`).
   The full "pop the other viewer to a second screen, stay connected across part
   changes" behaviour described on the `16_1` asset is out of scope for this pass.

5. **Volume / Surface "Calculate…" is a bounding-box stub** (occt can compute the
   real values later). Clearly a placeholder, per the brief's "occt or stub".

6. **Both viewers are lazy-loaded** (`next/dynamic`, `ssr: false`) and
   browser-only; `online-3d-viewer` is further imported inside a `useEffect` so it
   never evaluates during SSR. A `ResizeObserver` reflows the 3D canvas on split
   resize.

## Consequences

- STEP rendering depends on network access to jsDelivr at runtime. Offline / CSP-
  hardened deploys will need occt-import-js vendored locally + a library patch.
- Sample assets live in `/public/samples` (`072-93083.*`, `072-93105.*`).
- The viewer libs add meaningful bundle weight, isolated to lazy chunks.
