import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  extractJsonObject,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /https?:\/\/(?:[^.]+\.)?(?<service>app|ent)\.box\.com\/s\/(?<shared_name>[^/?#]+)(?:\/file\/(?<id>\d+))?/i;

interface BoxConfig {
  requestToken?: string;
}

interface BoxSharedItem {
  itemType?: string;
  itemID?: number | string;
}

interface BoxFile {
  name?: string;
  description?: string;
  authenticated_download_url?: string;
  is_download_available?: boolean;
  created_at?: string;
  created_by?: { name?: string; id?: string };
  size?: number;
  representations?: {
    entries?: Array<{
      representation?: string;
      content?: { url_template?: string };
    }>;
  };
}

function searchAssignment(html: string, assignRe: RegExp): unknown | null {
  const m = html.match(assignRe);
  if (!m || m.index == null) return null;
  const brace = html.indexOf("{", m.index + m[0].length - 1);
  if (brace < 0) return null;
  return extractJsonObject(html, brace);
}

export class BoxIE extends InfoExtractor {
  static IE_NAME = "box";
  static IE_DESC = "Box";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive download / DASH`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.shared_name) throw new Error(`Could not extract Box id from URL: ${url}`);
    const sharedName = m.groups.shared_name;
    const service = m.groups.service || "app";
    let fileId = m.groups.id;

    const webpage = await this.request.text(url);

    if (!fileId) {
      const postStream = searchAssignment(webpage, /Box\.postStreamData\s*=/) as {
        "/app-api/enduserapp/shared-item"?: BoxSharedItem;
      } | null;
      const sharedItem = postStream?.["/app-api/enduserapp/shared-item"];
      if (sharedItem?.itemType !== "file" || sharedItem.itemID == null) {
        throw new Error("The requested Box resource is not a file");
      }
      fileId = String(sharedItem.itemID);
    }

    const config = searchAssignment(webpage, /Box\.config\s*=/) as BoxConfig | null;
    const requestToken = config?.requestToken;
    if (!requestToken) throw new Error(`Could not extract Box requestToken for ${fileId}`);

    const tokens = await this.request.json<Record<string, { read?: string }>>(
      `https://${service}.box.com/app-api/enduserapp/elements/tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Token": requestToken,
          "X-Box-EndUser-API": `sharedName=${sharedName}`,
        },
        body: JSON.stringify({ fileIDs: [fileId] }),
      },
    );
    const accessToken = tokens[fileId]?.read;
    if (!accessToken) throw new Error(`Could not obtain Box access token for ${fileId}`);

    const sharedLink = `https://${service}.box.com/s/${sharedName}`;
    const file = await this.request.json<BoxFile>(
      `https://api.box.com/2.0/files/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          BoxApi: `shared_link=${sharedLink}`,
          "X-Rep-Hints": "[dash]",
        },
        query: {
          fields:
            "authenticated_download_url,created_at,created_by,description,extension,is_download_available,name,representations,size",
        },
      },
    );

    const formats: Format[] = [];
    if (file.is_download_available && file.authenticated_download_url) {
      formats.push(
        progressiveFormat(file.authenticated_download_url, {
          format_id: "source",
          filesize: file.size ?? null,
          quality: 1,
        }),
      );
    }

    for (const entry of file.representations?.entries || []) {
      if (entry.representation !== "dash" || !entry.content?.url_template) continue;
      const tmpl = entry.content.url_template.replace("{+asset_path}", "manifest.mpd");
      const manifest = new URL(tmpl);
      manifest.searchParams.set("access_token", accessToken);
      manifest.searchParams.set("shared_link", sharedLink);
      formats.push(dashFormat(manifest.toString()));
    }

    if (!formats.length) throw new Error(`No playable formats for Box file ${fileId}`);

    let timestamp: number | null = null;
    if (file.created_at) {
      const ms = Date.parse(file.created_at);
      if (!Number.isNaN(ms)) timestamp = Math.floor(ms / 1000);
    }

    return baseInfo(BoxIE.IE_NAME, url, {
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
