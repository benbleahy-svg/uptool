// occt-import-js ships no type declarations. The factory default export returns a
// Promise of the WASM module; extract-step.ts casts it to a typed interface.
declare module "occt-import-js" {
  const occtimportjs: unknown;
  export default occtimportjs;
}
