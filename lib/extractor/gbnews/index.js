"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGbnewsChannel = exports.parseGbnewsPlayerConfig = exports.parseGbnewsChannelsHtml = exports.normalizeGbnewsChannelId = exports.fetchGbnewsStreamUrl = exports.discoverGbnewsChannels = exports.GBNEWS_LIVE_URL = exports.GBNEWS_CHANNELS_URL = exports.GbnewsIE = void 0;
var gbnews_1 = require("./gbnews");
Object.defineProperty(exports, "GbnewsIE", { enumerable: true, get: function () { return gbnews_1.GbnewsIE; } });
var client_1 = require("./client");
Object.defineProperty(exports, "GBNEWS_CHANNELS_URL", { enumerable: true, get: function () { return client_1.GBNEWS_CHANNELS_URL; } });
Object.defineProperty(exports, "GBNEWS_LIVE_URL", { enumerable: true, get: function () { return client_1.GBNEWS_LIVE_URL; } });
Object.defineProperty(exports, "discoverGbnewsChannels", { enumerable: true, get: function () { return client_1.discoverGbnewsChannels; } });
Object.defineProperty(exports, "fetchGbnewsStreamUrl", { enumerable: true, get: function () { return client_1.fetchGbnewsStreamUrl; } });
Object.defineProperty(exports, "normalizeGbnewsChannelId", { enumerable: true, get: function () { return client_1.normalizeGbnewsChannelId; } });
Object.defineProperty(exports, "parseGbnewsChannelsHtml", { enumerable: true, get: function () { return client_1.parseGbnewsChannelsHtml; } });
Object.defineProperty(exports, "parseGbnewsPlayerConfig", { enumerable: true, get: function () { return client_1.parseGbnewsPlayerConfig; } });
Object.defineProperty(exports, "resolveGbnewsChannel", { enumerable: true, get: function () { return client_1.resolveGbnewsChannel; } });
//# sourceMappingURL=index.js.map