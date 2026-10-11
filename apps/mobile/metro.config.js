const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// --- Metro Cache Self-Healing Guard ---
// On Windows / fast development restarts, if Metro or a node process is terminated (e.g. Ctrl+C)
// mid-write, partial or 0-byte cache files in OS temp cause V8 deserialization errors:
// "Error: Unable to deserialize cloned data at deserialize (node:v8:...)"
// 1) Sweep OS temp dir for any corrupt or 0-byte metro-file-map files on startup
// 2) Patch DiskCacheManager.read so any deserialization failure unlinks the corrupt file
//    and returns null, letting Metro gracefully rebuild the cache without throwing.
try {
  const os = require('os');
  const fs = require('fs');
  const v8 = require('v8');
  const tmpDir = os.tmpdir();

  // Startup sweep
  for (const entry of fs.readdirSync(tmpDir)) {
    if (entry.startsWith('metro-file-map-') || entry.startsWith('haste-map-')) {
      const fullPath = path.join(tmpDir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          if (stat.size < 64) {
            fs.unlinkSync(fullPath);
          } else {
            v8.deserialize(fs.readFileSync(fullPath));
          }
        }
      } catch {
        try { fs.unlinkSync(fullPath); } catch {}
      }
    }
  }

  // Runtime patch
  const patchDiskCacheManager = (DiskCacheManager) => {
    if (!DiskCacheManager?.prototype || DiskCacheManager.prototype._isPatched) return;
    const originalRead = DiskCacheManager.prototype.read;
    DiskCacheManager.prototype._isPatched = true;
    DiskCacheManager.prototype.read = async function () {
      try {
        return await originalRead.call(this);
      } catch {
        try {
          const cachePath = this.getCacheFilePath?.();
          if (cachePath) {
            await fs.promises.unlink(cachePath).catch(() => {});
          }
        } catch {}
        return null;
      }
    };
  };

  const expoCli = require.resolve('@expo/cli', {
    paths: [require.resolve('expo', { paths: [projectRoot] })],
  });
  try {
    const expoFileMap = require(require.resolve('@expo/metro-file-map', { paths: [expoCli] }));
    if (expoFileMap.DiskCacheManager) patchDiskCacheManager(expoFileMap.DiskCacheManager);
  } catch {}

  try {
    const metroPath = require.resolve('metro', { paths: [expoCli] });
    const metroFileMap = require(require.resolve('metro-file-map', { paths: [metroPath] }));
    if (metroFileMap.DiskCacheManager) patchDiskCacheManager(metroFileMap.DiskCacheManager);
  } catch {}
} catch {}

const config = getDefaultConfig(projectRoot);

// 1. Preserve Expo's default monorepo watchFolders and ensure monorepoRoot and node_modules are watched
config.watchFolders = Array.from(
  new Set([
    ...(config.watchFolders || []),
    monorepoRoot,
    path.resolve(monorepoRoot, 'node_modules'),
  ]),
);

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...(config.resolver?.nodeModulesPaths || []),
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ]),
);

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

    // Intercept agentation on native mobile platforms (iOS / Android) to prevent bundling web DOM feedback tools
    if (platform !== 'web' && moduleName === 'agentation') {
      return {
        filePath: path.resolve(__dirname, 'stubs/empty-agentation.js'),
        type: 'sourceFile',
      };
    }

    // Explicitly resolve critical packages across pnpm symlinks in monorepo
    if (
      moduleName === 'expo-linear-gradient' ||
      moduleName === '@sentry/react-native' ||
      moduleName.startsWith('@sentry/react-native/') ||
      moduleName === '@supabase/supabase-js' ||
      moduleName.startsWith('@supabase/supabase-js/')
    ) {
      try {
        const resolved = require.resolve(moduleName, {
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

    // Fallback across pnpm symlinks in monorepo
    try {
      if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    } catch (resolutionError) {
      try {
        const originDir = context.originModulePath ? path.dirname(context.originModulePath) : projectRoot;
        const resolved = require.resolve(moduleName, {
          paths: [originDir, projectRoot, monorepoRoot],
        });
        return {
          filePath: resolved,
          type: 'sourceFile',
        };
      } catch {
        throw resolutionError;
      }
    }
  },
};

// Filter noisy Web / React Native Web deprecation and touch history warnings from Metro terminal output
const originalReporter = config.reporter;
if (originalReporter && typeof originalReporter.update === 'function') {
  const originalUpdate = originalReporter.update.bind(originalReporter);
  originalReporter.update = function (event) {
    if (event && event.type === 'client_log') {
      const dataStr = (event.data || []).map(String).join(' ');
      if (
        dataStr.includes('shadow*') ||
        dataStr.includes('Cannot record touch end without a touch start') ||
        dataStr.includes('Cannot record touch move without a touch start') ||
        dataStr.includes('Cannot find single active touch') ||
        dataStr.includes('Touch End:') ||
        dataStr.includes('Touch Bank:') ||
        dataStr.includes('style props are deprecated. Use "boxShadow"')
      ) {
        return;
      }
    }
    return originalUpdate(event);
  };
}

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });

