"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FC2IE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^(?:https?:\/\/video\.fc2\.com\/(?:[^/]+\/)*content\/|fc2:)(?<id>[^/?#]+)/i;
class FC2IE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "fc2";
    static IE_DESC = "FC2 Video";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — api/v3/videoplaylist progressive/HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const videoId = (0, helpers_1.matchId)(url, VALID_URL);
        let title;
        let thumbnail;
        let description = null;
        if (!url.startsWith("fc2:")) {
            try {
                const webpage = await this.request.text(url);
                title =
                    webpage.match(/<h2\s+class="videoCnt_title">([^<]+)/i)?.[1]?.trim() ||
                        webpage.match(/property=["']og:title["']\s+content=["']([^"']+)/i)?.[1];
                thumbnail = webpage.match(/property=["']og:image["']\s+content=["']([^"']+)/i)?.[1];
                description =
                    webpage.match(/property=["']og:description["']\s+content=["']([^"']+)/i)?.[1] || null;
            }
            catch {
                /* playlist API is enough for playback */
            }
        }
        const vidplaylist = await this.request.json(`https://video.fc2.com/api/v3/videoplaylist/${videoId}`, { query: { sh: 1, fs: 0 } });
        const nq = vidplaylist.playlist?.nq;
        if (!nq) {
            throw new Error(`fc2: unable to extract playlist.nq for ${videoId} (login or geo may be required)`);
        }
        const vidUrl = new URL(nq, "https://video.fc2.com/").toString();
        const isHls = vidplaylist.type === 2 || /\.m3u8/i.test(vidUrl);
        const formats = [
            isHls
                ? (0, helpers_1.hlsFormat)(vidUrl, "hls")
                : (0, helpers_1.progressiveFormat)(vidUrl, { format_id: "http" }),
        ];
        return (0, helpers_1.baseInfo)("fc2", url, {
            id: videoId,
            title: title || videoId,
            description,
            thumbnail,
            formats,
            http_headers: { Referer: "https://video.fc2.com/" },
        });
    }
}
exports.FC2IE = FC2IE;
//# sourceMappingURL=fc2.js.map