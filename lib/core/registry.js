"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExtractor = registerExtractor;
exports.listExtractors = listExtractors;
exports.listExtractorInfo = listExtractorInfo;
exports.findExtractor = findExtractor;
exports.findExtractorByName = findExtractorByName;
exports.resolveExtractor = resolveExtractor;
const url_usage_1 = require("../extractor/url-usage");
const extractors = [];
function registerExtractor(ie) {
    if (!extractors.includes(ie)) {
        extractors.push(ie);
    }
}
function listExtractors() {
    return [...extractors];
}
function listExtractorInfo() {
    return extractors.map(ie => (0, url_usage_1.withUrlUsage)(ie.getInfo()));
}
function findExtractor(url) {
    for (const ie of extractors) {
        if (ie.suitable(url)) {
            return ie;
        }
    }
    return null;
}
function findExtractorByName(name) {
    const needle = name.trim().toLowerCase();
    if (!needle)
        return null;
    for (const ie of extractors) {
        if (ie.IE_NAME.toLowerCase() === needle)
            return ie;
    }
    return null;
}
/** Resolve extractor: force `site`/`service` when set, else first URL match. */
function resolveExtractor(url, siteOrService) {
    if (siteOrService) {
        const IE = findExtractorByName(siteOrService);
        if (!IE)
            return null;
        if (!IE.suitable(url)) {
            const err = new Error(`URL is not valid for service "${IE.IE_NAME}"`);
            err.code = "SITE_URL_MISMATCH";
            throw err;
        }
        return IE;
    }
    return findExtractor(url);
}
//# sourceMappingURL=registry.js.map