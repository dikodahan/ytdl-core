/**
 * Playerjs (#1 / #F) decode helpers used by Ontivi's packed player (`p13.js`).
 * Site config sets enc2="F", file3_separator="F", and fpv1/fpv2 → kodk/kos.
 */
/** Default sugar key observed in Ontivi's Playerjs build. */
export declare const DEFAULT_PLAYER_Y = "xx???x=xx?xx?=";
export interface OntiviPlayerConfig {
    enc2: string;
    file3_separator: string;
    bk0?: string;
    bk1?: string;
    bk2?: string;
    bk3?: string;
    bk4?: string;
    fpv1?: string;
    fpv2?: string;
    fpv3?: string;
    fpv4?: string;
    fpv5?: string;
    fplace?: number;
}
/** Fallback when p13.js cannot be fetched/decoded — values from live Ontivi player config. */
export declare const DEFAULT_ONTIVI_PLAYER_CONFIG: OntiviPlayerConfig;
/** Decode Playerjs `#0` / `#1` protected strings. */
export declare function decodePlayerjsString(encoded: string, y?: string): string;
/** Decode a Playerjs `#F` / `#2` file payload (junk markers + base64). */
export declare function decodePlayerjsFile2(encoded: string, config: OntiviPlayerConfig): string;
export declare function applyPlayerjsPlaceholders(template: string, vars: Record<string, string>, config: OntiviPlayerConfig): string;
/** Fully resolve Ontivi Playerjs `file` into one or more stream URL candidates. */
export declare function resolveOntiviPlayerFile(file: string, vars: {
    kodk: string;
    kos: string;
    tims?: string;
    time?: string;
    kan?: string;
}, config?: OntiviPlayerConfig): string[];
/** Unpack Dean Edwards–style packer used by Playerjs builds. */
export declare function unpackPacker(source: string): string;
/** Parse Ontivi player script into stream-decode config. */
export declare function parseOntiviPlayerConfig(playerJs: string): OntiviPlayerConfig;
//# sourceMappingURL=playerjs.d.ts.map