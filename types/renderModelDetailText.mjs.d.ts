/**
 * Fix TS7016 on Vercel:
 * __tests__/model-detail.text.snapshot.test.ts imports:
 *   ../scripts/test/renderModelDetailText.mjs
 *
 * We intentionally type it as `any` because this is a test-only renderer,
 * and we only need `tsc --noEmit` to pass on CI.
 */
declare module "*/scripts/test/renderModelDetailText.mjs" {
  export const renderModelDetailText: any;
  const _default: any;
  export default _default;
}
