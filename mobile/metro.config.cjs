const config = getDefaultConfig(__dirname);

// Bypass Metro's buggy 'combine' function on Windows by providing a single regex
config.resolver.blockList = /.*\.expo[\\\/]types.*|.*\\__tests__\\.*/;

module.exports = config;
