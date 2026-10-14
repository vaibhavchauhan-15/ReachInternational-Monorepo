# Current Task

## Task: 123 — Fix Worklets Babel Plugin Exception (`Cannot read properties of undefined (reading 'length')` in `useMotion.ts`)
**Status**: 🟢 COMPLETED
**Date**: 2026-10-14
**Scope**: Fix Web and Metro bundling failure in `apps/mobile`:
- **Root Cause Identified**: `@reachinternational/mobile` had `@babel/plugin-transform-react-jsx: "^8.0.1"` in its `devDependencies`. This inadvertently pulled Babel 8 pre-release packages into the dependency tree (`@babel/generator@8.0.6` and `@babel/traverse@8.0.7`). While Babel 7's parser structures `TSFunctionType` with `node.parameters`, `@babel/generator@8.0.6` broke compatibility by looking for `node.params` (`Printer.tsPrintFunctionOrConstructorType` calling `_parameters(parameters)` where `parameters` was `undefined`). When `react-native-worklets` transpiled functions with `'worklet'` directives in `lib/motion/useMotion.ts` (`withSpatialSpring`, `withEffectsSpring`, `withMotionTiming`), `@babel/generator@8.0.6` crashed with `TypeError: Cannot read properties of undefined (reading 'length')`.
- **Surgical Resolution**:
  1. Downgraded `@babel/plugin-transform-react-jsx` from `^8.0.1` to `^7.25.9` in `apps/mobile/package.json` to match Expo SDK 57 / React Native 0.86 / Babel 7 toolchain.
  2. Pinned `"@babel/generator": "^7.29.8"` in `pnpm-workspace.yaml` and root `package.json` `overrides` to strictly prohibit Babel 8 generator from entering the monorepo graph.
  3. Ran `pnpm install` removing 19 incompatible Babel 8 packages and deduping `@babel/generator` to `7.29.8`.

---

## Deliverables & Verification
1. **Package Dependency Downgrade & Alignment**: `apps/mobile/package.json` updated with `"@babel/plugin-transform-react-jsx": "^7.25.9"`.
2. **Monorepo Overrides Hardening**: Root `package.json` and `pnpm-workspace.yaml` enforce `"@babel/generator": "^7.29.8"`.
3. **Babel Transformation Verification**: Direct Babel AST transpilation with `apps/mobile/babel.config.js` on `lib/motion/useMotion.ts`, `lib/motion/index.ts`, `lib/motion/tokens.ts`, `lib/motion/springs.ts`, `components/ui/overlay/Toast.tsx` succeeded with 0 errors.
4. **Mobile Verification Suite**: `node apps/mobile/run-tests.mjs` passed (146/146 test scenarios verified, 100%).
5. **Typography & Touch Guards**: `node scripts/check-typography.mjs` (0 raw properties found) & `pnpm --filter @reachinternational/permissions test` (5/5 passed).
6. **Mobile TypeScript Compilation**: `pnpm --filter @reachinternational/mobile typecheck` (`tsc --noEmit`) passed with 0 errors.
