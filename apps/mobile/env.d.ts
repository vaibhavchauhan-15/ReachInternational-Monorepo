/// <reference types="nativewind/types" />

declare var process: {
  env: {
    NODE_ENV?: "development" | "production" | "test";
    EXPO_PUBLIC_APP_ENV?: "development" | "preview" | "staging" | "production";
    EXPO_PUBLIC_SHELL_MODE?: "native" | "webview";
    EXPO_PUBLIC_SCHEME?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_APP_URL?: string;
    EXPO_PUBLIC_WEB_APP_URL?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
    EXPO_PUBLIC_ENABLE_AGENTATION?: string;
    [key: string]: string | undefined;
  };
};

declare module "*.css" {
  const content: any;
  export default content;
}
