export { YoutubeDL, extractInfo, listVideos } from "./core/youtube-dl";
export {
  registerExtractor,
  listExtractors,
  listExtractorInfo,
  listListCapableExtractors,
  findExtractor,
  findExtractorByName,
  resolveExtractor,
  resolveListExtractor,
} from "./core/registry";
export { InfoExtractor } from "./core/info-extractor";
export type {
  ExtractorInfo,
  ExtractorOptionDef,
  MigrationStatus,
  VideoLister,
  ListCapableExtractorConstructor,
} from "./core/info-extractor";
export type { VideoListEntry, VideoListResult, ListVideosOptions } from "./core/video-list";
export { registerBuiltInExtractors } from "./extractor/register";
export { URL_USAGE, LIST_URL_USAGE, withUrlUsage } from "./extractor/url-usage";
export type { UrlUsageGuide } from "./extractor/url-usage";
export { loadMigrationTracker, migrationStatusBySite } from "./migration/tracker";
export { chooseFormat, filterFormats, selectFormats, sortFormats } from "./core/format-select";
export type { Format, InfoDict, YoutubeDLParams, Agent, PoTokenMap } from "./core/types";
export { createAgent, createProxyAgent, RequestClient } from "./networking/request";
export {
  isCloudflareChallenge,
  isImpersonateAvailable,
  createImpersonateTransport,
  browserHeadersFor,
  JA3_PROFILES,
} from "./networking/cloudflare";
export type { ImpersonateProfile } from "./networking/cloudflare";
export { downloadFormat } from "./downloader/http";
export { YoutubeIE } from "./extractor/youtube/video";
export {
  validateID,
  validateURL,
  getVideoID,
  getURLVideoID,
} from "./extractor/youtube/base";
export { INNERTUBE_CLIENTS, DEFAULT_CLIENTS, VLC_CLIENTS } from "./extractor/youtube/clients";
export { EJS_SCRIPT_VERSION } from "./extractor/youtube/jsc/solver";
export { PoTokenDirector, ManualPoTokenProvider, attachGvsPoToken } from "./extractor/youtube/pot";
export { createWebServer, startWebServer } from "./web/server";
export { TokenStore, getTokenStore } from "./web/tokens";
export type { ApiTokenPublic, CreatedApiToken } from "./web/tokens";

import { YoutubeDL } from "./core/youtube-dl";
export default YoutubeDL;
