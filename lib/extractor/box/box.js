"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoxIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:[^.]+\.)?(?<service>app|ent)\.box\.com\/s\/(?<shared_name>[^/?#]+)(?:\/file\/(?<id>\d+))?/i;
function searchAssignment(html, assignRe) {
    const m = html.match(assignRe);
    if (!m || m.index == null)
        return null;
    const brace = html.indexOf("{", m.index + m[0].length - 1);
    if (brace < 0)
        return null;
    return (0, helpers_1.extractJsonObject)(html, brace);
}
class BoxIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "box";
    static IE_DESC = "Box";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive download / DASH`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.shared_name)
            throw new Error(`Could not extract Box id from URL: ${url}`);
        const sharedName = m.groups.shared_name;
        const service = m.groups.service || "app";
        let fileId = m.groups.id;
        const webpage = await this.request.text(url);
        if (!fileId) {
            const postStream = searchAssignment(webpage, /Box\.postStreamData\s*=/);
            const sharedItem = postStream?.["/app-api/enduserapp/shared-item"];
            if (sharedItem?.itemType !== "file" || sharedItem.itemID == null) {
                throw new Error("The requested Box resource is not a file");
            }
            fileId = String(sharedItem.itemID);
        }
        const config = searchAssignment(webpage, /Box\.config\s*=/);
        const requestToken = config?.requestToken;
        if (!requestToken)
            throw new Error(`Could not extract Box requestToken for ${fileId}`);
        const tokens = await this.request.json(`https://${service}.box.com/app-api/enduserapp/elements/tokens`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Request-Token": requestToken,
                "X-Box-EndUser-API": `sharedName=${sharedName}`,
            },
            body: JSON.stringify({ fileIDs: [fileId] }),
        });
        const accessToken = tokens[fileId]?.read;
        if (!accessToken)
            throw new Error(`Could not obtain Box access token for ${fileId}`);
        const sharedLink = `https://${service}.box.com/s/${sharedName}`;
        const file = await this.request.json(`https://api.box.com/2.0/files/${fileId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                BoxApi: `shared_link=${sharedLink}`,
                "X-Rep-Hints": "[dash]",
            },
            query: {
                fields: "authenticated_download_url,created_at,created_by,description,extension,is_download_available,name,representations,size",
            },
        });
        const formats = [];
        if (file.is_download_available && file.authenticated_download_url) {
            formats.push((0, helpers_1.progressiveFormat)(file.authenticated_download_url, {
                format_id: "source",
                filesize: file.size ?? null,
                quality: 1,
            }));
        }
        for (const entry of file.representations?.entries || []) {
            if (entry.representation !== "dash" || !entry.content?.url_template)
                continue;
            const tmpl = entry.content.url_template.replace("{+asset_path}", "manifest.mpd");
            const manifest = new URL(tmpl);
            manifest.searchParams.set("access_token", accessToken);
            manifest.searchParams.set("shared_link", sharedLink);
            formats.push((0, helpers_1.dashFormat)(manifest.toString()));
        }
        if (!formats.length)
            throw new Error(`No playable formats for Box file ${fileId}`);
        let timestamp = null;
        if (file.created_at) {
            const ms = Date.parse(file.created_at);
            if (!Number.isNaN(ms))
                timestamp = Math.floor(ms / 1000);
        }
        return (0, helpers_1.baseInfo)(BoxIE.IE_NAME, url, {
            id: fileId,
            title: file.name || fileId,
            description: file.description || null,
            uploader: file.created_by?.name || null,
            uploader_id: file.created_by?.id || null,
            timestamp,
            formats,
        });
    }
}
exports.BoxIE = BoxIE;
//# sourceMappingURL=box.js.map