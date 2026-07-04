const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix: "Unable to resolve react-native/Libraries/Core/Devtools/getDevServer" on web
// Metro tries to statically resolve all require() paths even inside conditions.
// We provide an empty shim for web so the bundler doesn't crash.
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (
      platform === 'web' &&
      moduleName === 'react-native/Libraries/Core/Devtools/getDevServer'
    ) {
      // Return empty shim for web builds
      return {
        filePath: path.resolve(__dirname, 'shims/getDevServer.js'),
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
