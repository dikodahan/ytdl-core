"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnvatoIE = void 0;
const crypto_1 = require("crypto");
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const API_BASE = "https://tkx.mp.lura.live/rest/v2";
/** From anvplayer.min.js — used as a short XOR key for X-Anvato-Adst-Auth */
const AUTH_KEY = Buffer.from([0x31, 0xc2, 0x42, 0x84, 0x9e, 0x73, 0xa0, 0xce]);
/** MCP short names → long access keys (yt-dlp AnvatoIE) */
const MCP_TO_ACCESS_KEY = {
    qa: "anvato_mcpqa_demo_web_stage_18b55e00db5a13faa8d03ae6e41f6f5bcb15b922",
    lin: "anvato_mcp_lin_web_prod_4c36fbfd4d8d8ecae6488656e21ac6d1ac972749",
    univison: "anvato_mcp_univision_web_prod_37fe34850c99a3b5cdb71dab10a417dd5cdecafa",
    uni: "anvato_mcp_univision_web_prod_37fe34850c99a3b5cdb71dab10a417dd5cdecafa",
    dev: "anvato_mcp_fs2go_web_prod_c7b90a93e171469cdca00a931211a2f556370d0a",
    sps: "anvato_mcp_sps_web_prod_54bdc90dd6ba21710e9f7074338365bba28da336",
    spsstg: "anvato_mcp_sps_web_prod_54bdc90dd6ba21710e9f7074338365bba28da336",
    anv: "anvato_mcp_anv_web_prod_791407490f4c1ef2a4bcb21103e0cb1bcb3352b3",
    gray: "anvato_mcp_gray_web_prod_4c10f067c393ed8fc453d3930f8ab2b159973900",
    hearst: "anvato_mcp_hearst_web_prod_5356c3de0fc7c90a3727b4863ca7fec3a4524a99",
    cbs: "anvato_mcp_cbs_web_prod_02f26581ff80e5bda7aad28226a8d369037f2cbe",
    telemundo: "anvato_mcp_telemundo_web_prod_c5278d51ad46fda4b6ca3d0ea44a7846a054f582",
};
/** Access key → API secret (subset used by MCP table + common web keys) */
const ANVACK_TABLE = {
    anvato_mcpqa_demo_web_stage_18b55e00db5a13faa8d03ae6e41f6f5bcb15b922: "IOaaLQ8ymqVyem14QuAvE5SndQynTcH5CrLkU2Ih",
    anvato_mcp_lin_web_prod_4c36fbfd4d8d8ecae6488656e21ac6d1ac972749: "GUXNf5ZDX2jFUpu4WT2Go4DJ5nhUCzpnwDRRUx1K",
    anvato_mcp_univision_web_prod_37fe34850c99a3b5cdb71dab10a417dd5cdecafa: "bLDYF8JqfG42b7bwKEgQiU9E2LTIAtnKzSgYpFUH",
    anvato_mcp_fs2go_web_prod_c7b90a93e171469cdca00a931211a2f556370d0a: "icgGoYGipQMMSEvhplZX1pwbN69srwKYWksz3xWK",
    anvato_mcp_sps_web_prod_54bdc90dd6ba21710e9f7074338365bba28da336: "fA2iQdI7RDpynqzQYIpXALVS83NTPr8LLFK4LFsu",
    anvato_mcp_anv_web_prod_791407490f4c1ef2a4bcb21103e0cb1bcb3352b3: "rMOUZqe9lwcGq2mNgG3EDusm6lKgsUnczoOX3mbg",
    anvato_mcp_gray_web_prod_4c10f067c393ed8fc453d3930f8ab2b159973900: "rMOUZqe9lwcGq2mNgG3EDusm6lKgsUnczoOX3mbg",
    anvato_mcp_hearst_web_prod_5356c3de0fc7c90a3727b4863ca7fec3a4524a99: "P3uXJ0fXXditBPCGkfvlnVScpPEfKmc64Zv7ZgbK",
    anvato_mcp_cbs_web_prod_02f26581ff80e5bda7aad28226a8d369037f2cbe: "mGPvo5ZA5SgjOFAPEPXv7AnOpFUICX8hvFQVz69n",
    anvato_mcp_telemundo_web_prod_c5278d51ad46fda4b6ca3d0ea44a7846a054f582: "qyT6PXXLjVNCrHaRVj0ugAhalNRS7Ee9BP7LUokD",
    X8POa4zPPaKVZHqmWjuEzfP31b1QM9VN: "Dn5vOY9ooDw7VSl9qztjZI5o0g08mA0z",
    // KTLA / LIN test access key also used as opaque id
    X8POa4zpGZMmeiq0wqiO8IP5rMqQM9VN: "Dn5vOY9ooDw7VSl9qztjZI5o0g08mA0z",
};
function md5Hex(s) {
    return (0, crypto_1.createHash)("md5").update(s).digest("hex");
}
/** Matches yt-dlp's aes_encrypt(input[:64], AUTH_KEY) with short expanded key → XOR first 8 bytes */
function anvatoAdstAuth(inputData) {
    const data = Buffer.from(inputData.slice(0, 64), "utf8");
    const out = Buffer.alloc(Math.min(8, data.length));
    for (let i = 0; i < out.length; i++) {
        out[i] = data[i] ^ AUTH_KEY[i];
    }
    return out.toString("base64");
}
function stripJsonp(body) {
    const m = body.match(/^[^{[(]*([{\[].*[}\]])[\s;]*$/s);
    return m?.[1] || body.replace(/^[^(]*\(/, "").replace(/\)\s*;?\s*$/, "");
}
class AnvatoIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "anvato";
    static IE_DESC = "Anvato MCP video (access-key URLs)";
    static _VALID_URL = /anvato:(?<access>[^:]+):(?<id>\d+)/i;
    async extract(url) {
        const m = url.match(AnvatoIE._VALID_URL);
        if (!m?.groups)
            throw new Error(`Could not parse Anvato URL: ${url}`);
        let accessKey = m.groups.access;
        const videoId = m.groups.id;
        if (!(accessKey in ANVACK_TABLE)) {
            accessKey = MCP_TO_ACCESS_KEY[accessKey.toLowerCase()] || accessKey;
        }
        const videoDataUrl = `${API_BASE}/mcp/video/${videoId}?anvack=${accessKey}`;
        let serverTime;
        try {
            const st = await this.request.json(`${API_BASE}/server_time`, { query: { anvack: accessKey } });
            serverTime = st.server_time || Math.floor(Date.now() / 1000);
        }
        catch {
            serverTime = Math.floor(Date.now() / 1000);
        }
        const inputData = `${serverTime}~${md5Hex(videoDataUrl)}~${md5Hex(String(serverTime))}`;
        const anvrid = md5Hex(String(Date.now() * Math.random())).slice(0, 30);
        const api = {
            anvrid,
            anvts: serverTime,
        };
        const secret = ANVACK_TABLE[accessKey];
        if (secret) {
            api.anvstk = md5Hex(`${accessKey}|${anvrid}|${serverTime}|${secret}`);
        }
        else {
            api.anvstk2 = "default";
        }
        const adst = anvatoAdstAuth(inputData);
        const res = await this.request.request(videoDataUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            query: {
                "X-Anvato-Adst-Auth": adst,
                rtyp: "fp",
            },
            body: JSON.stringify({ api }),
        });
        if (res.statusCode >= 400) {
            throw new Error(`Anvato MCP video ${videoId} failed (HTTP ${res.statusCode}). ` +
                `A valid Anvato access key (anvack) and matching secret are required. ` +
                `Known MCP shortcuts: ${Object.keys(MCP_TO_ACCESS_KEY).join(", ")}. ` +
                `Got access key prefix: ${accessKey.slice(0, 16)}…`);
        }
        let videoData = (0, helpers_1.tryParseJson)(stripJsonp(res.body));
        if (!videoData) {
            throw new Error(`Anvato returned non-JSON for video ${videoId}`);
        }
        const formats = [];
        for (const pub of videoData.published_urls || []) {
            let videoUrl = pub.embed_url;
            if (!videoUrl)
                continue;
            const mediaFormat = (pub.format || "").toLowerCase();
            const isM3u8 = mediaFormat.includes("m3u8") || /\.m3u8(\?|$)/i.test(videoUrl);
            if (isM3u8) {
                // Some hosts return JSON with master_m3u8
                try {
                    const manifest = await this.request.json(videoUrl);
                    if (manifest.master_m3u8)
                        videoUrl = manifest.master_m3u8;
                }
                catch {
                    /* use original */
                }
                formats.push((0, helpers_1.hlsFormat)(videoUrl, mediaFormat.includes("variant") ? "hls" : `hls-${pub.kbps || ""}`));
            }
            else if (mediaFormat === "mp3" || /\.mp3(\?|$)/i.test(videoUrl)) {
                formats.push((0, helpers_1.progressiveFormat)(videoUrl, {
                    format_id: "http-audio",
                    has_video: false,
                    vcodec: "none",
                    tbr: pub.kbps ?? null,
                }));
            }
            else if (/^https?:/i.test(videoUrl)) {
                formats.push((0, helpers_1.progressiveFormat)(videoUrl, {
                    format_id: `http-${(pub.cdn_name || "http").toLowerCase()}`,
                    width: pub.width ?? null,
                    height: pub.height ?? null,
                    tbr: pub.kbps ?? null,
                }));
            }
        }
        if (!formats.length) {
            throw new Error(`Anvato video ${videoId} has no published URLs. ` +
                `Verify the access key is valid (see Anvato access keys / MCP table).`);
        }
        return (0, helpers_1.baseInfo)(AnvatoIE.IE_NAME, url, {
            id: videoId,
            title: videoData.def_title || videoId,
            description: videoData.def_description || null,
            thumbnail: videoData.src_image_url || videoData.thumbnail,
            duration: videoData.duration ?? null,
            timestamp: videoData.ts_published || videoData.ts_added || null,
            uploader: videoData.mcp_id || null,
            formats,
        });
    }
}
exports.AnvatoIE = AnvatoIE;
//# sourceMappingURL=anvato.js.map