/**
 * Backward compatibility re-export for lib/interaction/haptics -> lib/haptics
 * Ensures smooth transition and prevents Metro bundler cache resolution errors.
 */

export * from '../haptics';
export { default } from '../haptics';
