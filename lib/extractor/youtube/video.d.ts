import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class YoutubeIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static suitable(url: string): boolean;
    static getInfo(): ExtractorInfo;
    extract(url: string): Promise<InfoDict>;
    private resolveClients;
    private parseStreamingFormat;
}
//# sourceMappingURL=video.d.ts.map