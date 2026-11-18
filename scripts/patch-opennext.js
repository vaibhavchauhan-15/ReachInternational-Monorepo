const fs = require('fs');
const path = require('path');

function patchOpenNextAws() {
  const pnpmDir = path.resolve('node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    console.log('No .pnpm dir found');
    return;
  }

  const entries = fs.readdirSync(pnpmDir);
  for (const entry of entries) {
    if (entry.startsWith('@opennextjs+aws@')) {
      const copyTracedPath = path.join(
        pnpmDir,
        entry,
        'node_modules',
        '@opennextjs',
        'aws',
        'dist',
        'build',
        'copyTracedFiles.js'
      );
      if (fs.existsSync(copyTracedPath)) {
        let content = fs.readFileSync(copyTracedPath, 'utf8');
        const target = `        if (symlink) {
            try {
                symlinkSync(symlink, to);
            }
            catch (e) {
                if (e.code !== "EEXIST") {
                    throw e;
                }
            }
        }`;
        const replacement = `        if (symlink) {
            try {
                symlinkSync(symlink, to, 'junction');
            }
            catch (e) {
                if (e.code !== "EEXIST") {
                    try {
                        cpSync(from, to, { recursive: true });
                    } catch (cpErr) {
                        logger.debug("Fallback copy traced symlink error:", cpErr);
                    }
                }
            }
        }`;
        if (content.includes(target)) {
          content = content.replace(target, replacement);
          fs.writeFileSync(copyTracedPath, content, 'utf8');
          console.log(`Successfully patched: ${copyTracedPath}`);
        } else if (content.includes(replacement)) {
          console.log(`Already patched: ${copyTracedPath}`);
        } else {
          console.log(`Target string not found in ${copyTracedPath}`);
        }
      }
    }

    if (entry.startsWith('@opennextjs+cloudflare@')) {
      const bundleServerPath = path.join(
        pnpmDir,
        entry,
        'node_modules',
        '@opennextjs',
        'cloudflare',
        'dist',
        'cli',
        'build',
        'bundle-server.js'
      );
      if (fs.existsSync(bundleServerPath)) {
        let content = fs.readFileSync(bundleServerPath, 'utf8');
        const targetSharp = `            patchSetWorkingDirectory(updater, buildOpts),`;
        const replacementSharp = `            patchSetWorkingDirectory(updater, buildOpts),
            {
                name: "ignore-sharp",
                setup(build) {
                    build.onResolve({ filter: /(?:sharp|@img)/ }, () => {
                        return { path: path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js") };
                    });
                },
            },`;
        if (content.includes(targetSharp) && !content.includes('name: "ignore-sharp"')) {
          content = content.replace(targetSharp, replacementSharp);
          console.log(`Patched sharp shim: ${bundleServerPath}`);
        }

        const targetMinimal = `"process.env.NODE_ENV": '"production"',`;
        const replacementMinimal = `"process.env.NODE_ENV": '"production"',\n            "process.env.NEXT_PRIVATE_MINIMAL_MODE": '"1"',`;
        if (content.includes(targetMinimal) && !content.includes('"process.env.NEXT_PRIVATE_MINIMAL_MODE"')) {
          content = content.replace(targetMinimal, replacementMinimal);
          console.log(`Patched minimal mode: ${bundleServerPath}`);
        }

        fs.writeFileSync(bundleServerPath, content, 'utf8');
      }

      const nextServerPluginPath = path.join(
        pnpmDir,
        entry,
        'node_modules',
        '@opennextjs',
        'cloudflare',
        'dist',
        'cli',
        'build',
        'patches',
        'plugins',
        'next-server.js'
      );
      if (fs.existsSync(nextServerPluginPath)) {
        let content = fs.readFileSync(nextServerPluginPath, 'utf8');
        const targetCb = `contents = patchCode(contents, disableNodeMiddlewareRule);`;
        const replacementCb = `contents = patchCode(contents, disableNodeMiddlewareRule);
                contents = patchCode(contents, removeMiddlewareManifestRule);`;
        if (content.includes(targetCb) && !content.includes('removeMiddlewareManifestRule')) {
          content = content.replace(targetCb, replacementCb);
          content += `
export const removeMiddlewareManifestRule = \`
rule:
  kind: statement_block
  inside:
    kind: method_definition
    has:
      kind: property_identifier
      regex: ^getMiddlewareManifest$
fix:
  '{return null;}'
\`;
`;
          fs.writeFileSync(nextServerPluginPath, content, 'utf8');
          console.log(`Successfully patched getMiddlewareManifest in: ${nextServerPluginPath}`);
        } else if (content.includes('removeMiddlewareManifestRule')) {
          console.log(`Already patched getMiddlewareManifest in: ${nextServerPluginPath}`);
        }
      }
    }
  }
}

patchOpenNextAws();
