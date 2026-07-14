"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfoExtractor = void 0;
class InfoExtractor {
    static IE_NAME = "generic";
    static IE_DESC = "";
    static _VALID_URL = /(?!)/;
    params;
    request;
    constructor(params, request) {
        this.params = params;
        this.request = request;
    }
    static suitable(url) {
        return this._VALID_URL.test(url);
    }
    /** UI / API metadata for this extractor */
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: this.IE_DESC,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
}
exports.InfoExtractor = InfoExtractor;
//# sourceMappingURL=info-extractor.js.map