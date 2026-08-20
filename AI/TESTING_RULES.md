# Testing & Verification Rules — ReachInternational

1. **TypeScript Typecheck**: Run `pnpm typecheck` to verify workspace-wide type safety (0 errors across 9 workspace projects).
2. **ESLint Verification**: Run `pnpm lint` to ensure code meets linting standards across all workspace projects.
3. **No Breaking API Contracts**: Ensure modified Server Actions retain existing signature parameters and return types.
4. **Manual Verification Protocol**: Verify UI responsiveness on desktop and mobile layout viewports before finalizing tasks.
5. **No Console Logs in Production**: Remove leftover debug statements (`console.log()`) before completing tasks.
6. **Strict Package Manager Rule**: Use ONLY `pnpm` (`pnpm install`, `pnpm run <cmd>`, `pnpm typecheck`, `pnpm build`). Mixing `npm` and `pnpm` is strictly prohibited.
