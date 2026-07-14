"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoxMediaIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
class VoxMediaIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "voxmedia";
    static IE_DESC = "Vox Media Volume embeds";
    static _VALID_URL = /https?:\/\/volume\.vox-cdn\.com\/embed\/(?<id>[0-9a-f]{9})/i;
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VoxMediaIE._VALID_URL);
        const webpage = await this.request.text(url);
        const setupMatch = webpage.match(/setup\s*=\s*/);
        if (!setupMatch || setupMatch.index == null) {
            throw new Error(`Could not find Volume setup for ${id}`);
        }
        const brace = webpage.indexOf("{", setupMatch.index);
        const setup = (0, helpers_1.extractJsonObject)(webpage, brace);
        if (!setup)
            throw new Error(`Could not parse Volume setup for ${id}`);
        const playerSetup = setup.player_setup || setup;
        const videoData = playerSetup.video || setup.video || {};
        const formatted = videoData.formatted_metadata || {};
        const asset = setup.embed_assets?.chorus || {};
        const formats = [];
        if (asset.hls_url)
            formats.push((0, helpers_1.hlsFormat)(asset.hls_url));
        if (asset.mp4_url) {
            const tbr = asset.mp4_url.match(/-(\d+)k\./)?.[1];
            formats.push((0, helpers_1.progressiveFormat)(asset.mp4_url, {
                format_id: tbr ? `http-${tbr}` : "http",
                tbr: tbr ? Number(tbr) : null,
            }));
        }
        if (!formats.length) {
            const yt = videoData && "youtube_id" in videoData
                ? videoData.youtube_id
                : undefined;
            throw new Error(yt
                ? `Volume embed ${id} only references YouTube ${yt}; use the youtube extractor`
                : `Volume embed ${id} has no HLS/MP4 assets`);
        }
        return (0, helpers_1.baseInfo)(VoxMediaIE.IE_NAME, url, {
            id,
            title: playerSetup.title || videoData.title_short || id,
            description: videoData.description_long || videoData.description_short || null,
            thumbnail: formatted.thumbnail || videoData.brightcove_thumbnail,
            duration: asset.duration ?? null,
            formats,
        });
    }
}
exports.VoxMediaIE = VoxMediaIE;
//# sourceMappingURL=voxmedia.js.map