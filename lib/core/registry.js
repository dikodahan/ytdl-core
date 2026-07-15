"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExtractor = registerExtractor;
exports.listExtractors = listExtractors;
exports.listExtractorInfo = listExtractorInfo;
exports.findExtractor = findExtractor;
exports.findExtractorByName = findExtractorByName;
exports.resolveExtractor = resolveExtractor;
exports.listListCapableExtractors = listListCapableExtractors;
exports.resolveListExtractor = resolveListExtractor;
exports.createVideoLister = createVideoLister;
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
function isListCapable(ie) {
    return typeof ie.listUrlSupported === "function" &&
        typeof ie.prototype.listVideos === "function";
}
function listListCapableExtractors() {
    return extractors.filter(isListCapable);
}
/** Resolve list extractor: force `site`/`service` when set, else first listing URL match. */
function resolveListExtractor(url, siteOrService) {
    if (siteOrService) {
        const IE = findExtractorByName(siteOrService);
        if (!IE || !isListCapable(IE))
            return null;
        if (!IE.listUrlSupported(url)) {
            const err = new Error(`URL is not a supported listing page for service "${IE.IE_NAME}"`);
            err.code = "SITE_URL_MISMATCH";
            throw err;
        }
        return IE;
    }
    for (const ie of extractors) {
        if (isListCapable(ie) && ie.listUrlSupported(url))
            return ie;
    }
    return null;
}
function createVideoLister(ie, params, request) {
    return new ie(params, request);
}
//# sourceMappingURL=registry.js.map