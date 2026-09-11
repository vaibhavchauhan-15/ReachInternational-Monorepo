const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;

