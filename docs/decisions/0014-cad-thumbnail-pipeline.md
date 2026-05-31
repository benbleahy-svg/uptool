# ADR 0014 — Server-side CAD thumbnail pipeline

## Status

Accepted

## Context

The Anfragen dashboard "Teile" column previously showed a generic box icon per
part (`PartThumb` / `CadThumb`). We want real thumbnails of each part's CAD that
are **guaranteed to match the in-app file viewer** (`estimate/[partId]/cad-canvas.tsx`,
which embeds `online-3d-viewer`). Rendering CAD client-side per row is a non-starter
— one WebGL context per thumbnail on a list page — and a STEP parser (occt) plus a
fixed camera are needed to get a stable image, so the render must happen server-side
once, at ingest, and be cached.

The hard constraint: the thumbnail must be the *same view* as the interactive
viewer. The only way to guarantee that is to run the *same renderer* with the
*same config*. So we drive a real headless browser running `online-3d-viewer`,
rather than reimplementing the camera/lighting in a server three.js.

## Decision

1. **Playwright + headless Chromium running `online-3d-viewer`, in the worker.**
   `apps/worker/src/cad-render/renderer.ts` (`CadRenderer`) launches one Chromium
   with software WebGL (`--use-angle=swiftshader --enable-unsafe-swiftshader`),
   serves a render page (`render-page.html`) from an in-process HTTP server, and
   per job creates a fresh browser context, loads the CAD via a tokenised
   `/model/<uuid><ext>` URL, runs the **same `EmbeddedViewer` config + default
   camera + `FitSphereToWindow`** as `cad-canvas.tsx`, and screenshots the canvas.
   Output is a 256-px-square PNG at `deviceScaleFactor: 2` (512 px, retina-friendly).

2. **occt-import-js vendored locally — renders fully offline.** `online-3d-viewer`
   hardcodes a jsDelivr base URL for the occt (STEP) WASM parser; `o3dv.min.js`,
   `occt-import-js{,-worker}.js`, and `.wasm` are vendored under
   `cad-render/vendor/` and the base URL is rewritten to the in-process server at
   serve time. Same-origin so the blob Worker's `importScripts`/wasm resolve
   locally — no CDN at runtime, no Playwright request interception. The vendor dir
   is excluded from Biome (`biome.json`).

3. **Reused browser, capped concurrency, failure-isolated.** The worker lazily
   inits one `CadRenderer` on the first job and reuses it; the
   `render-cad-thumbnail` Worker runs `concurrency: 2` (each render holds a page +
   WebGL context). A per-render timeout (25 s) kills a hung page context without
   wedging the worker. A failed render is isolated to its part: the part is marked
   `failed` (retryable) and the error is surfaced to BullMQ's failed-job log.

4. **Status on the part row; image in object storage.** Migration 0014 adds
   `parts.thumbnail_key` + `parts.thumbnail_status` (`pending | ready | failed`,
   null = no CAD linked, CHECK-constrained). The PNG is stored via the existing
   `storageService` at `{orgId}/thumbnails/{partId}.png`. `partService` owns the
   status transitions + `findCadForPart` / `findPartsNeedingThumbnail`.

5. **Web is the producer; idempotent enqueue-on-load + auto-retry.**
   `apps/web/lib/cad-thumbnail-queue.ts` is a thin BullMQ producer (queue name +
   job-data shape kept in sync with `apps/worker/src/queues.ts`). The dashboard
   calls `ensureThumbnails(orgId)` on every load: it enqueues only parts that have
   a linked CAD attachment but no usable thumbnail (`null` or `failed`), so failed
   renders self-heal on the next visit and there is no separate retry UI. `jobId`
   is `thumb:{partId}:{attachmentId}` — re-enqueuing the same CAD is a no-op while
   in flight; a replaced CAD (new `attachmentId`) gets a fresh render. `bullmq` is
   in `serverExternalPackages` so it isn't webpack-bundled.

6. **Part↔CAD link.** The render sources the part's linked CAD attachment
   (`attachments.category = 'cad'`, `attachments.part_id = part.id`) — the link the
   seed already establishes. The dashboard presigns ready thumbnails (mirroring the
   org-logo precedent in the same page) and `PartsCell` renders an `<img>`;
   pending shows a pulsing placeholder, failed/not-started shows the box icon.

## Consequences

- **Worker needs Chromium in prod.** The worker now depends on a Playwright
  Chromium + its system libraries. The worker has no Dockerfile yet; the prod
  image must `playwright install --with-deps chromium` (or use the Playwright base
  image). This is a deploy follow-up, not wired here.
- **In-app viewer still uses sample assets.** `estimate/[partId]` reads CAD from
  `mocks/mockFiles.ts` (`/public/samples/*`), not the real attachment bytes. The
  thumbnail matches today because the seed's sample assets and stored attachment
  bytes are the *same files* and the render config is identical. Rewiring the
  interactive viewer to stream real attachment bytes is a separate change; until
  then "matches the viewer" holds for seeded data only.
- **Thumbnails render at first dashboard observation, not strictly at email
  ingest.** Email ingest creates attachments but not parts; parts (and the CAD
  link) appear during estimating. Enqueue-on-load is the practical equivalent of
  "at ingest" given that ordering, and is idempotent/self-healing.
- Migration 0014 generated cleanly (only the `parts` ALTERs) — no snapshot trim
  was needed this time, unlike 0013.
