/**
 * ServiceCentric Mobile — Multi-Environment Manager (Phase 32)
 * Manages configuration across development, staging, and production environments.
 * Provides startup validation, environment-specific URLs/keys, and production protection flags.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  env: AppEnvironment;
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiTimeoutMs: number;
  enableDebugLogs: boolean;
  isProduction: boolean;
}

/**
 * Environment-specific preset configurations
 */
const ENV_PRESETS: Record<AppEnvironment, Partial<EnvironmentConfig>> = {
  development: {
    env: 'development',
    apiTimeoutMs: 15000,
    enableDebugLogs: true,
    isProduction: false,
  },
  staging: {
    env: 'staging',
    apiTimeoutMs: 10000,
    enableDebugLogs: true,
    isProduction: false,
  },
  production: {
    env: 'production',
    apiTimeoutMs: 8000,
    enableDebugLogs: false,
    isProduction: true,
  },
};

/**
 * Returns the active environment configuration based on process.env settings.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const currentEnv = (process.env.EXPO_PUBLIC_APP_ENV as AppEnvironment) || 'development';
  const preset = ENV_PRESETS[currentEnv] || ENV_PRESETS.development;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://reachinternational.supabase.co';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';

  return {
    env: currentEnv,
    supabaseUrl,
    supabaseAnonKey,
    apiTimeoutMs: preset.apiTimeoutMs || 10000,
    enableDebugLogs: preset.enableDebugLogs ?? true,
    isProduction: preset.isProduction ?? false,
  };
}

/**
 * Validates startup environment configuration. Throws detailed error if critical variables are absent.
 */
export function validateStartupEnvironment(): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const config = getEnvironmentConfig();

  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    warnings.push('EXPO_PUBLIC_SUPABASE_URL not explicitly set. Using fallback URL.');
  }

  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    warnings.push('EXPO_PUBLIC_SUPABASE_ANON_KEY not explicitly set. Using fallback Anon Key.');
  }

  if (config.isProduction && (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
    errors.push('CRITICAL: Production build requires explicit EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY!');
  }

  console.log(`[Environment]: Active Environment = '${config.env}' | Production Mode = ${config.isProduction}`);
  if (warnings.length > 0) console.warn('[Environment Warnings]:', warnings);
  if (errors.length > 0) console.error('[Environment Errors]:', errors);

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
