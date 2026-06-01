// Headless CAD → PNG renderer. Runs online-3d-viewer in a reused Chromium
// (Playwright), so server-side thumbnails are byte-for-byte the same view as the
// in-app file viewer (cad-canvas.tsx — same EmbeddedViewer config + fit). occt
// is vendored locally and served from an in-process HTTP server, so the worker
// renders fully offline (no jsDelivr at runtime).

import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const VENDOR = join(DIR, "vendor");
// online-3d-viewer 0.18 hardcodes this; we patch it to our local server.
const JSDELIVR_OCCT = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/";

interface PendingModel {
  bytes: Buffer;
  ext: string;
}

export class CadRenderer {
  private browser: Browser | null = null;
  private server: Server | null = null;
  private port = 0;
  private html = "";
  private o3dv = "";
  // Models in flight, keyed by token so concurrent renders don't collide.
  private readonly models = new Map<string, PendingModel>();

  async init(): Promise<void> {
    if (this.browser) return;
    this.html = await readFile(join(DIR, "render-page.html"), "utf8");
    this.o3dv = await readFile(join(VENDOR, "o3dv.min.js"), "utf8");

    this.server = createServer(async (req, res) => {
      const path = (req.url || "/").split("?")[0] ?? "/";
      try {
        if (path === "/") {
          res.writeHead(200, { "content-type": "text/html" });
          res.end(this.html);
        } else if (path === "/o3dv.min.js") {
          // Point the hardcoded occt baseUrl at this server (offline, same-origin
          // so the blob Worker's importScripts/wasm resolve here too).
          const patched = this.o3dv.replace(JSDELIVR_OCCT, `http://127.0.0.1:${this.port}/occt/`);
          res.writeHead(200, { "content-type": "text/javascript" });
          res.end(patched);
        } else if (path.startsWith("/occt/")) {
          const name = path.slice("/occt/".length);
          if (!/^occt-import-js(-worker)?\.(js|wasm)$/.test(name)) {
            res.writeHead(404);
            res.end();
            return;
          }
          const body = await readFile(join(VENDOR, name));
          res.writeHead(200, {
            "content-type": name.endsWith(".wasm") ? "application/wasm" : "text/javascript",
          });
          res.end(body);
        } else if (path.startsWith("/model/")) {
          const token = path.slice("/model/".length).split(".")[0] ?? "";
          const model = this.models.get(token);
          if (!model) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200, { "content-type": "application/octet-stream" });
          res.end(model.bytes);
        } else {
          res.writeHead(404);
          res.end();
        }
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", () => resolve()));
    this.port = (this.server?.address() as { port: number }).port;

    this.browser = await chromium.launch({
      args: [
        // Software WebGL — works headless without a GPU.
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  /**
   * Render CAD bytes (ext like ".step"/".stp") to a square PNG buffer.
   *
   * timeout is generous: large STEP files (multi-MB) parse + mesh in occt and
   * paint via software WebGL (swiftshader), which is slow — 25s was too tight
   * and left big assemblies failing/retrying forever. 60s comfortably covers
   * the largest fixtures while still bounding a genuinely stuck render.
   */
  async render(bytes: Buffer, ext: string, timeoutMs = 60_000): Promise<Buffer> {
    if (!this.browser) throw new Error("CadRenderer not initialised");
    const token = randomUUID();
    this.models.set(token, { bytes, ext });
    const context = await this.browser.newContext({
      viewport: { width: 320, height: 320 },
      deviceScaleFactor: 2, // 256px CSS → 512px PNG (retina)
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      await page.goto(`http://127.0.0.1:${this.port}/`, { waitUntil: "load" });
      const modelUrl = `http://127.0.0.1:${this.port}/model/${token}${ext}`;
      await page.evaluate(
        (u) =>
          (globalThis as unknown as { __renderCad: (u: string) => Promise<boolean> }).__renderCad(
            u,
          ),
        modelUrl,
      );
      // Explicit timeout so the screenshot's stability wait shares the full
      // render budget (not Playwright's 30s default); animations disabled so a
      // settling fit/zoom can't keep the element "unstable" past the deadline.
      return await page
        .locator("#v canvas")
        .screenshot({ timeout: timeoutMs, animations: "disabled" });
    } finally {
      this.models.delete(token);
      await context.close().catch(() => {});
    }
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
    this.server = null;
  }
}
