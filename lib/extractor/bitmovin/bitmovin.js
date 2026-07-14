"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitmovinIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
class BitmovinIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "bitmovin";
    static IE_DESC = "Bitmovin Streams embeds";
    static _VALID_URL = /https?:\/\/streams\.bitmovin\.com\/(?<id>\w+)/i;
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, BitmovinIE._VALID_URL);
        const config = await this.request.json(`https://streams.bitmovin.com/${id}/config`);
        const sources = config.sources || {};
        const formats = [];
        if (sources.hls)
            formats.push((0, helpers_1.hlsFormat)(sources.hls));
        if (sources.dash)
            formats.push((0, helpers_1.dashFormat)(sources.dash));
        if (!formats.length) {
            throw new Error(`Bitmovin stream ${id} has no HLS/DASH sources`);
        }
        return (0, helpers_1.baseInfo)(BitmovinIE.IE_NAME, url, {
            id,
            title: sources.title || config.title || id,
            thumbnail: sources.poster || config.poster || `https://streams.bitmovin.com/${id}/poster`,
            formats,
        });
    }
}
exports.BitmovinIE = BitmovinIE;
//# sourceMappingURL=bitmovin.js.map