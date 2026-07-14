"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const webpage_media_1 = require("../_shared/webpage-media");
/**
 * Fallback extractor — must be registered last.
 * Matches any URL and scrapes obvious media (OG / JSON-LD / HTML5).
 */
class GenericIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "generic";
    static IE_DESC = "Generic webpage media scrape (fallback)";
    static _VALID_URL = /.*/;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: this.IE_DESC,
            validUrl: String(this._VALID_URL),
            options: [],
            status: "ready",
        };
    }
    async extract(url) {
        return (0, webpage_media_1.extractWebpageMedia)(this.request, url, "generic");
    }
}
exports.GenericIE = GenericIE;
//# sourceMappingURL=generic.js.map