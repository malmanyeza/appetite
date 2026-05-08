const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to always use the React and React Native versions in the mobile directory
// to avoid "Invalid hook call" caused by double-React in the NPM workspace.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Override react
  if (moduleName === 'react') {
    return context.resolveRequest(context, path.resolve(projectRoot, 'node_modules/react'), platform);
  }
  if (moduleName.startsWith('react/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'node_modules/react', moduleName.substring(6)), platform);
  }
  
  // Override react-dom
  if (moduleName === 'react-dom') {
    return context.resolveRequest(context, path.resolve(projectRoot, 'node_modules/react-dom'), platform);
  }
  if (moduleName.startsWith('react-dom/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'node_modules/react-dom', moduleName.substring(10)), platform);
  }

  // Override react-native
  if (moduleName === 'react-native') {
    return context.resolveRequest(context, path.resolve(projectRoot, 'node_modules/react-native'), platform);
  }
  if (moduleName.startsWith('react-native/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'node_modules/react-native', moduleName.substring(13)), platform);
  }

  // Bypass Metro's buggy 'combine' function on Windows by blocking certain types (from previous config)
  config.resolver.blockList = /.*\.expo[\\\/]types.*|.*\\__tests__\\.*/;

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
