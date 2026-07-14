"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeneratedExtractor = createGeneratedExtractor;
const info_extractor_1 = require("../../core/info-extractor");
const webpage_media_1 = require("../_shared/webpage-media");
function compilePatterns(entry) {
    const out = [];
    for (const src of entry.patterns || []) {
        try {
            out.push(new RegExp(src, "i"));
        }
        catch {
            /* skip broken conversions */
        }
    }
    if (!out.length && entry.hosts?.length) {
        const hostAlt = entry.hosts.map(h => h.replace(/\./g, "\\.")).join("|");
        out.push(new RegExp(`^https?:\\/\\/(?:[\\w-]+\\.)*(?:${hostAlt})(?:[/?#]|$)`, "i"));
    }
    return out;
}
function createGeneratedExtractor(entry) {
    const compiled = compilePatterns(entry);
    const patterns = compiled.length ? compiled : [/(?!)/];
    class GeneratedIE extends info_extractor_1.InfoExtractor {
        static IE_NAME = entry.id;
        static IE_DESC = entry.description;
        static _VALID_URL = patterns[0];
        static _PATTERNS = patterns;
        static suitable(url) {
            return this._PATTERNS.some(re => re.test(url));
        }
        static getInfo() {
            return {
                name: this.IE_NAME,
                description: this.IE_DESC,
                validUrl: patterns.map(String).join(" | "),
                options: [],
                status: "partial",
            };
        }
        constructor(params, request) {
            super(params, request);
        }
        async extract(url) {
            return (0, webpage_media_1.extractWebpageMedia)(this.request, url, entry.id);
        }
    }
    Object.defineProperty(GeneratedIE, "name", { value: `${entry.id}GeneratedIE` });
    return GeneratedIE;
}
//# sourceMappingURL=factory.js.map