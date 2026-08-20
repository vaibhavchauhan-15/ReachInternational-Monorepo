/**
 * Shared Design Tokens Package for ReachInternational Monorepo
 * Canonical visual language single source of truth for Web & Mobile.
 */

// Canonical Token Exports
export * from './tokens/colors';
export * from './tokens/typography';
export * from './tokens/spacing';
export * from './tokens/radius';
export * from './tokens/elevation';
export * from './tokens/motion';
export * from './tokens/breakpoints';

// Component Visual Contracts
export * from './contracts/badge';
export * from './contracts/icons';

// Platform Adapters
export * from './adapters/cssVariables';
export * from './adapters/reactNative';

export const DESIGN_TOKENS_PACKAGE = "@reachinternational/design-tokens";
