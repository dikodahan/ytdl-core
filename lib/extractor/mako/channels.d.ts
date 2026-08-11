/** Built-in Mako / Keshet live & free linear channels (mako-streaming.akamaized.net). */
export interface MakoChannel {
    /** Stable slug used in `mako:{id}` URLs. */
    id: string;
    /** Display title (Hebrew). */
    name: string;
    /** English / ASCII label for tooling. */
    label: string;
    /** Playback playlist URL (token is appended). */
    streamUrl: string;
    /**
     * Optional entitlement `lp` URL when it differs from `streamUrl`
     * (some Keshet feeds mint a ticket against one path and play another).
     */
    tokenUrl?: string;
    thumbnail?: string;
    /** Listing group. */
    group: "live" | "free" | "extra";
}
/**
 * Built-in / MediaBox fallback catalog (MAKO / mako-streaming + share-next paths).
 * Used only when live discovery from mako.co.il fails or returns no channels.
 */
export declare const MAKO_CHANNELS: MakoChannel[];
export declare function findMakoChannel(id: string): MakoChannel | undefined;
export declare function listMakoChannels(group?: MakoChannel["group"]): MakoChannel[];
export declare function makoChannelPageUrl(id: string): string;
export declare function makoListingUrl(group?: string): string;
//# sourceMappingURL=channels.d.ts.map