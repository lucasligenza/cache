const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const coreRoot = path.resolve(monorepoRoot, 'packages/core');

const config = getDefaultConfig(projectRoot);

// Watch the shared core so Metro rebuilds when @cache/core changes.
config.watchFolders = [...(config.watchFolders ?? []), coreRoot];

// Resolve the workspace package to source (not a stale copy in node_modules).
config.resolver.unstable_enablePackageExports = true;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@cache/core': coreRoot,
};

// Prefer this app's node_modules (React 19 / RN) over a parent web install (React 18).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
