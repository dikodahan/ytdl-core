"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeDL = void 0;
exports.extractInfo = extractInfo;
exports.listVideos = listVideos;
const stream_1 = require("stream");
const registry_1 = require("./registry");
const request_1 = require("../networking/request");
const format_select_1 = require("./format-select");
const http_1 = require("../downloader/http");
const cloudflare_1 = require("../networking/cloudflare");
const register_1 = require("../extractor/register");
(0, register_1.registerBuiltInExtractors)();
class YoutubeDL {
    params;
    request;
    constructor(params = {}) {
        this.params = { ...params };
        if (params.site && !params.service)
            this.params.service = params.site;
        if (params.service && !params.site)
            this.params.site = params.service;
        if (params.proxy && !params.agent) {
            this.params.agent = (0, request_1.createProxyAgent)(params.proxy);
        }
        else if (!params.agent) {
            this.params.agent = (0, request_1.createAgent)();
        }
        this.request = new request_1.RequestClient({
            agent: this.params.agent,
            defaultHeaders: this.params.headers,
            impersonate: this.params.impersonate,
            cloudflareBypass: this.params.cloudflareBypass,
            forceImpersonate: this.params.forceImpersonate,
            proxy: this.params.proxy,
        });
    }
    get extractors() {
        return (0, registry_1.listExtractors)();
    }
    static listSites() {
        return (0, registry_1.listExtractors)().map(ie => ie.getInfo());
    }
    static capabilities() {
        return {
            impersonateAvailable: (0, cloudflare_1.isImpersonateAvailable)(),
            impersonateProfiles: ["chrome", "firefox", "safari", "edge"],
            cloudflareBypass: true,
        };
    }
    async extractInfo(url, _download = false) {
        const site = this.params.site || this.params.service;
        let IE;
        try {
            IE = (0, registry_1.resolveExtractor)(url, site);
        }
        catch (err) {
            throw err;
        }
        if (!IE) {
            throw new Error(site ? `Unknown or unregistered service: ${site}` : `No suitable extractor for URL: ${url}`);
        }
        const ie = new IE(this.params, this.request);
        const info = await ie.extract(url);
        if (this.params.format && info.formats?.length) {
            const selected = (0, format_select_1.selectFormats)(info.formats, this.params.format);
            info.requested_formats = selected.formats;
            if (!selected.merged && selected.formats[0]) {
                info.url = selected.formats[0].url;
                info.ext = selected.formats[0].ext;
            }
        }
        return info;
    }
    async listVideos(url, options = {}) {
        const site = this.params.site || this.params.service;
        let IE;
        try {
            IE = (0, registry_1.resolveListExtractor)(url, site);
        }
        catch (err) {
            throw err;
        }
        if (!IE) {
            throw new Error(site
                ? `Service "${site}" does not support listing video ids for this URL`
                : `No list-capable extractor for URL: ${url}`);
        }
        const lister = (0, registry_1.createVideoLister)(IE, this.params, this.request);
        return lister.listVideos(url, options);
    }
    async listCategories(url, options = {}) {
        const site = this.params.site || this.params.service || "youporn";
        const IE = (0, registry_1.findExtractorByName)(site);
        if (!IE || typeof IE.prototype.listCategories !== "function") {
            throw new Error(`Service "${site}" does not support listing categories`);
        }
        const lister = new IE(this.params, this.request);
        const target = url?.trim() || "https://www.youporn.com/";
        return lister.listCategories(target, options);
    }
    download(url, options = {}) {
        const stream = new stream_1.PassThrough({ highWaterMark: options.highWaterMark || 1024 * 512 });
        this.extractInfo(url)
            .then(info => {
            const formats = info.requested_formats || info.formats || [];
            const selected = (0, format_select_1.selectFormats)(formats, this.params.format || "best");
            const format = selected.formats[0];
            stream.emit("info", info, format);
            const media = (0, http_1.downloadFormat)(format, this.params, options);
            media.on("error", err => stream.emit("error", err));
            media.on("progress", (...args) => stream.emit("progress", ...args));
            media.pipe(stream);
        })
            .catch(err => stream.emit("error", err));
        return stream;
    }
    async close() {
        await this.request.close();
    }
}
exports.YoutubeDL = YoutubeDL;
async function extractInfo(url, params = {}) {
    const ydl = new YoutubeDL(params);
    try {
        return await ydl.extractInfo(url);
    }
    finally {
        await ydl.close();
    }
}
async function listVideos(url, params = {}) {
    const { page, limit, ...rest } = params;
    const ydl = new YoutubeDL(rest);
    try {
        return await ydl.listVideos(url, { page, limit });
    }
    finally {
        await ydl.close();
    }
}
//# sourceMappingURL=youtube-dl.js.map