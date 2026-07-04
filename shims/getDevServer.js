// Empty shim for web: Metro tries to statically resolve this internal React Native 
// module even inside conditional requires. On web it's never called at runtime.
module.exports = {
  default: function getDevServer() {
    return { bundleLoadedFromServer: false, url: '' };
  },
};
