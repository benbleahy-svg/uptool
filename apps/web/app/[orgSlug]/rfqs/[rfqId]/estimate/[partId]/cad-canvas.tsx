"use client";

import * as React from "react";

export interface CadStats {
  vertices: number;
  triangles: number;
  dims: { x: number; y: number; z: number } | null;
  meshes: string[];
}

export interface CadApi {
  fitToView: () => void;
  getStats: () => CadStats | null;
  resize: () => void;
}

interface Props {
  url: string;
  /**
   * File name (with extension) for the model at `url`. o3dv infers the importer
   * from the file extension; when `url` has none (e.g. `/api/attachments/<id>`),
   * pass the name so the extension comes from here instead of the URL.
   */
  name?: string;
  /** When false the canvas ignores pointer events (used by the toggle thumbnail). */
  interactive?: boolean;
  background?: [number, number, number];
  className?: string;
  onReady?: (api: CadApi) => void;
  onLoaded?: () => void;
}

// online-3d-viewer is browser-only (three.js + WASM) and loads the occt-import-js
// STEP parser from jsDelivr at runtime, so we import it lazily inside the effect.
export function CadCanvas({
  url,
  name,
  interactive = true,
  background = [255, 255, 255],
  className,
  onReady,
  onLoaded,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [bgR, bgG, bgB] = background;
  // Keep the latest callbacks without retriggering the (expensive) init effect.
  const onReadyRef = React.useRef(onReady);
  const onLoadedRef = React.useRef(onLoaded);
  onReadyRef.current = onReady;
  onLoadedRef.current = onLoaded;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    // biome-ignore lint/suspicious/noExplicitAny: online-3d-viewer ships loose `any` types
    let viewer: any = null;

    // Reflow the canvas when the pane (split divider) resizes, not just the window.
    const resizeObserver = new ResizeObserver(() => {
      try {
        viewer?.Resize();
      } catch {
        /* not ready */
      }
    });
    resizeObserver.observe(el);

    (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic browser-only module
      const OV: any = await import("online-3d-viewer");
      if (cancelled || !containerRef.current) return;

      viewer = new OV.EmbeddedViewer(containerRef.current, {
        backgroundColor: new OV.RGBAColor(bgR, bgG, bgB, 255),
        defaultColor: new OV.RGBColor(184, 188, 194),
        onModelLoaded: () => onLoadedRef.current?.(),
      });
      // o3dv picks the importer by file extension. If the URL has none but a
      // named file is given (with an extension), load it as a named URL input.
      if (name && /\.[a-z0-9_]+$/i.test(name) && !/\.[a-z0-9_]+$/i.test(url.split("?")[0] ?? "")) {
        viewer.LoadModelFromInputFiles([new OV.InputFile(name, OV.FileSource.Url, url)]);
      } else {
        viewer.LoadModelFromUrlList([url]);
      }

      const api: CadApi = {
        fitToView: () => {
          try {
            const v = viewer.GetViewer();
            v.FitSphereToWindow(
              v.GetBoundingSphere(() => true),
              true,
            );
          } catch {
            /* viewer not ready */
          }
        },
        getStats: () => {
          try {
            const model = viewer.GetModel();
            if (!model) return null;

            let dims: CadStats["dims"] = null;
            try {
              const bbox = OV.GetBoundingBox(model);
              dims = {
                x: bbox.max.x - bbox.min.x,
                y: bbox.max.y - bbox.min.y,
                z: bbox.max.z - bbox.min.z,
              };
            } catch {
              /* no bbox */
            }

            const meshes: string[] = [];
            try {
              const count = model.MeshCount();
              for (let i = 0; i < count; i++) {
                const name = model.GetMesh(i).GetName();
                meshes.push(name && name.length > 0 ? name : `Mesh ${i + 1}`);
              }
            } catch {
              /* no mesh names */
            }

            return {
              vertices: model.VertexCount(),
              triangles: model.TriangleCount(),
              dims,
              meshes,
            };
          } catch {
            return null;
          }
        },
        resize: () => {
          try {
            viewer.Resize();
          } catch {
            /* not ready */
          }
        },
      };
      onReadyRef.current?.(api);
    })();

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      if (containerRef.current) containerRef.current.replaceChildren();
      viewer = null;
    };
  }, [url, name, bgR, bgG, bgB]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", pointerEvents: interactive ? "auto" : "none" }}
    />
  );
}
