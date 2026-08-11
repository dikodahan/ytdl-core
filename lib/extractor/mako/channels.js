"use strict";
/** Built-in Mako / Keshet live & free linear channels (mako-streaming.akamaized.net). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAKO_CHANNELS = void 0;
exports.findMakoChannel = findMakoChannel;
exports.listMakoChannels = listMakoChannels;
exports.makoChannelPageUrl = makoChannelPageUrl;
exports.makoListingUrl = makoListingUrl;
/**
 * Built-in / MediaBox fallback catalog (MAKO / mako-streaming + share-next paths).
 * Live listing prefers site discovery from mako.co.il and merges these for any
 * ids the site rail does not expose (e.g. dancing, ninja, kohav, hatuna).
 */
exports.MAKO_CHANNELS = [
    {
        id: "k12",
        name: "קשת 12",
        label: "Keshet 12",
        // Prefer DVR HD path used by share-next mako12.
        streamUrl: "https://mako-streaming.akamaized.net/stream/hls/live/2033791/k12dvr/index.m3u8",
        tokenUrl: "https://mako-streaming.akamaized.net/n12/hls/live/2103938/k12/index.m3u8?b-in-range=0-1100",
        group: "live",
    },
    {
        id: "k12-live",
        name: "קשת 12 (חי)",
        label: "Keshet 12 Live",
        streamUrl: "https://mako-streaming.akamaized.net/n12/hls/live/2103938/k12/index.m3u8",
        group: "live",
    },
    {
        id: "k12-direct",
        name: "קשת 12 (ישיר)",
        label: "Keshet 12 Direct",
        streamUrl: "https://mako-streaming.akamaized.net/direct/hls/live/2033791/k12/index.m3u8",
        group: "live",
    },
    {
        id: "k12cc",
        name: "קשת 12 — לקויי שמיעה",
        label: "Keshet 12 CC",
        streamUrl: "https://mako-streaming.akamaized.net/direct/hls/live/2035325/k12cc/index.m3u8",
        tokenUrl: "https://mako-streaming.akamaized.net/n12/hls/live/2103938/k12/index.m3u8?b-in-range=0-1100",
        group: "live",
    },
    {
        id: "ch24",
        name: "מוזיקה 24",
        label: "Channel 24",
        streamUrl: "https://mako-streaming.akamaized.net/direct/hls/live/2035340/ch24live/index.m3u8",
        tokenUrl: "https://mako-streaming.akamaized.net/direct/hls/live/2035340/ch24live/video_10801920_p_1.m3u8",
        group: "live",
    },
    {
        id: "eretz",
        name: "ארץ נהדרת",
        label: "Eretz Nehedert",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/2111419/erets/index.m3u8",
        thumbnail: "https://img.mako.co.il/2026/06/15/LinearChannel_Eretz_e.jpg",
        group: "extra",
    },
    {
        id: "savri",
        name: "סברי מרנן",
        label: "Savri Maranan",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/2111419/savri/index.m3u8",
        thumbnail: "https://img.mako.co.il/2026/06/15/LinearChannel_Savri_e.jpg",
        group: "extra",
    },
    {
        id: "free-comedy",
        name: "free קומדי",
        label: "Free Comedy",
        streamUrl: "https://mako-streaming.akamaized.net/evrideo/hls/live/20001278/free_comedy/index.m3u8",
        thumbnail: "https://img.mako.co.il/2026/06/15/LinearChannel_Comedy_e.jpg",
        group: "free",
    },
    {
        id: "free-drama",
        name: "free דרמה",
        label: "Free Drama",
        streamUrl: "https://mako-streaming.akamaized.net/evrideo/hls/live/20001278/free_drama/index.m3u8",
        thumbnail: "https://img.mako.co.il/2026/06/15/LinearChannel_Drama_e.jpg",
        group: "free",
    },
    {
        id: "free-music",
        name: "free מוזיקה",
        label: "Free Music",
        streamUrl: "https://mako-streaming.akamaized.net/evrideo/hls/live/20001278/free_music/index.m3u8",
        thumbnail: "https://img.mako.co.il/2026/06/15/LinearChannel_Music_e.jpg",
        group: "free",
    },
    {
        id: "free-food",
        name: "free אוכל",
        label: "Free Food",
        streamUrl: "https://mako-streaming.akamaized.net/evrideo/hls/live/20001278/free_food/index.m3u8",
        thumbnail: "https://img.mako.co.il/2026/06/15/LinearChannel_food_e.jpg",
        group: "free",
    },
    {
        id: "dancing",
        name: "רוקדים עם כוכבים",
        label: "Dancing with the Stars",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/2111419/dancing_with_stars/index.m3u8",
        group: "extra",
    },
    {
        id: "ninja",
        name: "נינג'ה ישראל",
        label: "Ninja Israel",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/2111419/ninja/index.m3u8",
        group: "extra",
    },
    {
        id: "kohav",
        name: "הכוכב הבא",
        label: "The Next Star",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/2111419/kohav/index.m3u8",
        group: "extra",
    },
    {
        id: "hatuna",
        name: "חתונה ממבט ראשון",
        label: "Married at First Sight",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/2111419/hatuna/index.m3u8",
        group: "extra",
    },
];
const BY_ID = new Map(exports.MAKO_CHANNELS.map(c => [c.id.toLowerCase(), c]));
function findMakoChannel(id) {
    return BY_ID.get(id.trim().toLowerCase());
}
function listMakoChannels(group) {
    if (!group)
        return [...exports.MAKO_CHANNELS];
    return exports.MAKO_CHANNELS.filter(c => c.group === group);
}
function makoChannelPageUrl(id) {
    return `mako:${id}`;
}
function makoListingUrl(group) {
    return group ? `mako:channels:${group}` : "mako:channels";
}
//# sourceMappingURL=channels.js.map