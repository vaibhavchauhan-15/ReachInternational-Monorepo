const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo root to allow resolving pnpm symlinks
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const originalResolveRequest = config.resolver?.resolveRequest;

const existingBlockList = Array.isArray(config.resolver?.blockList)
  ? config.resolver.blockList
  : config.resolver?.blockList
  ? [config.resolver.blockList]
  : [];

config.resolver = {
  ...config.resolver,
  blockList: [
    ...existingBlockList,
    /__tests__\/.*$/,
    /.*\.test\.[jt]sx?$/,
    /.*\.spec\.[jt]sx?$/,
    /run-tests\.mjs$/,
    /store-assets\/.*$/,
    /docs\/.*$/,
  ],
  resolveRequest: (context, moduleName, platform) => {
    // Intercept @expo-google-fonts/material-symbols to prevent bundling the unused 964KB MaterialSymbols_400Regular.ttf
    // ServiceCentric Mobile exclusively uses lucide-react-native for all iconography.
    if (moduleName.startsWith('@expo-google-fonts/material-symbols')) {
      return {
        filePath: path.resolve(__dirname, 'stubs/empty-material-symbols.js'),
        type: 'sourceFile',
      };
    }

    // Explicitly resolve expo-linear-gradient across pnpm symlinks in monorepo
    if (moduleName === 'expo-linear-gradient') {
      try {
        const resolved = require.resolve('expo-linear-gradient', {
          paths: [projectRoot, monorepoRoot],
        });
        return {
          filePath: resolved,
          type: 'sourceFile',
        };
      } catch {
        // Fall through to default resolver
      }
    }

    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;

