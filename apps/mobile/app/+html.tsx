import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML for Expo Router web output.
 * Configures Open Graph, Twitter Cards, theme-aware favicons, and manifest for shared link logo previews.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover"
        />

        {/* Primary Meta */}
        <title>REACH INTERNATIONAL — Reaching All Heights</title>
        <meta
          name="description"
          content="Enterprise heavy machinery fleet management, field service tracking, and automated operations platform."
        />

        {/* Shared Link Logo Preview: Open Graph */}
        <meta property="og:site_name" content="REACH INTERNATIONAL" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="REACH INTERNATIONAL — Reaching All Heights" />
        <meta
          property="og:description"
          content="Enterprise heavy machinery fleet management, field service tracking, and automated operations platform."
        />
        <meta property="og:image" content="/dark-web-app-manifest-512x512.png" />
        <meta property="og:image:secure_url" content="/dark-web-app-manifest-512x512.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:alt" content="Reach International Fleet Operations" />

        {/* Shared Link Logo Preview: Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="REACH INTERNATIONAL — Reaching All Heights" />
        <meta
          name="twitter:description"
          content="Enterprise heavy machinery fleet management, field service tracking, and automated operations platform."
        />
        <meta name="twitter:image" content="/dark-web-app-manifest-512x512.png" />

        {/* Theme-Adaptive Favicons & Touch Icons (Dark theme uses light icons; Light theme uses dark icons) */}
        <link rel="icon" href="/light-favicon.ico" sizes="any" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/dark-favicon.ico" sizes="any" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/light-favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/dark-favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/light-favicon-96x96.png" sizes="96x96" type="image/png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/dark-favicon-96x96.png" sizes="96x96" type="image/png" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" href="/light-apple-touch-icon.png" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/dark-apple-touch-icon.png" media="(prefers-color-scheme: light)" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Theme Color Meta */}
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: responsiveStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveStyles = `
body {
  background-color: #09090b;
}
@media (prefers-color-scheme: light) {
  body {
    background-color: #fafafa;
  }
}
`;
