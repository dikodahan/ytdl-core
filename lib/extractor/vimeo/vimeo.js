"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VimeoIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:www|player)\.)?vimeo\.com\/(?:video\/)?(?<id>\d+)/i;
class VimeoIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "vimeo";
    static IE_DESC = "Vimeo";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive + HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    formatsFromConfig(config) {
        const files = config.video?.files || config.request?.files || {};
        const formats = [];
        for (const f of files.progressive || []) {
            if (!f.url)
                continue;
            formats.push((0, helpers_1.progressiveFormat)(f.url, {
                format_id: `http-${f.quality || "progressive"}`,
                width: f.width ?? null,
                height: f.height ?? null,
                fps: f.fps ?? null,
                tbr: f.bitrate ?? null,
            }));
        }
        for (const [cdn, data] of Object.entries(files.hls?.cdns || {})) {
            if (data.url)
                formats.push((0, helpers_1.hlsFormat)(data.url, `hls-${cdn}`));
        }
        for (const [cdn, data] of Object.entries(files.dash?.cdns || {})) {
            let url = data.url;
            if (!url)
                continue;
            if (url.includes("json=1")) {
                // leave as-is; VLC may not play dash json — convert master.json → master.mpd
                url = url.replace("/master.json", "/master.mpd");
            }
            formats.push((0, helpers_1.dashFormat)(url, `dash-${cdn}`));
        }
        return formats;
    }
    findConfigInPage(webpage) {
        const clipped = (0, helpers_1.extractBetween)(webpage, "window.playerConfig = ", ";");
        if (clipped) {
            const parsed = (0, helpers_1.tryParseJson)(clipped);
            if (parsed)
                return parsed;
        }
        const assign = (0, helpers_1.searchJsonAssignment)(webpage, /(?:var\s+)?(?:config|playerConfig)\s*=\s*/);
        if (assign?.request || assign?.video)
            return assign;
        const dataConfig = webpage.match(/data-config-url="([^"]+)"/);
        if (dataConfig?.[1]) {
            return { request: { files: {} }, video: { id: "" } }; // marker handled by caller via config_url
        }
        const idx = webpage.indexOf('"request":');
        if (idx >= 0) {
            const brace = webpage.lastIndexOf("{", idx);
            if (brace >= 0) {
                const obj = (0, helpers_1.extractJsonObject)(webpage, brace);
                if (obj?.request || obj?.video)
                    return obj;
            }
        }
        return null;
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const playerUrl = `https://player.vimeo.com/video/${id}`;
        const webpage = await this.request.text(playerUrl, {
            headers: { Referer: "https://vimeo.com/" },
        });
        let config = this.findConfigInPage(webpage);
        const configUrl = webpage.match(/data-config-url="([^"]+)"/)?.[1] ||
            webpage.match(/"config_url"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
        if ((!config || !config.request?.files) && configUrl) {
            config = await this.request.json(configUrl.replace(/&amp;/g, "&"), {
                headers: { Referer: playerUrl },
            });
        }
        // Also try config embedded as JSON in script
        if (!config) {
            const embed = (0, helpers_1.extractBetween)(webpage, "var config = ", ";");
            if (embed)
                config = (0, helpers_1.tryParseJson)(embed);
        }
        if (!config)
            throw new Error(`Unable to extract Vimeo config for ${id}`);
        const formats = this.formatsFromConfig(config);
        if (!formats.length) {
            throw new Error(`No playable formats for Vimeo ${id} (may require login or embed referer)`);
        }
        const thumbs = config.video?.thumbs || {};
        const thumb = thumbs.base || thumbs["1280"] || thumbs["640"] || Object.values(thumbs)[0] ||
            config.video?.thumbnail;
        return (0, helpers_1.baseInfo)("vimeo", url, {
            id,
            title: config.video?.title || `Vimeo ${id}`,
            duration: config.video?.duration ?? null,
            uploader: config.video?.owner?.name || null,
            thumbnail: thumb,
            formats,
        });
    }
}
exports.VimeoIE = VimeoIE;
//# sourceMappingURL=vimeo.js.map