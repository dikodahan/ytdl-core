"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URL_USAGE = void 0;
exports.withUrlUsage = withUrlUsage;
exports.URL_USAGE = {
    youtube: {
        usage: "Paste a watch / Shorts / youtu.be / Music / live URL, or an 11-character video id.",
        examples: [
            "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            "https://youtu.be/aqz-KE-bpKQ",
            "https://www.youtube.com/shorts/aqz-KE-bpKQ",
            "aqz-KE-bpKQ",
        ],
    },
    // Batch 0 — embeds
    brightcove: {
        usage: "Paste a Brightcove player page URL (`players.brightcove.net/.../index.html?videoId=…`).",
        examples: [
            "https://players.brightcove.net/ACCOUNT_ID/PLAYER_default/index.html?videoId=VIDEO_ID",
        ],
        notes: "Needs a public player that exposes a playback policy key.",
    },
    jwplatform: {
        usage: "Paste a JW Platform / JW Player media or player URL (8-character media id), or `jwplatform:ID`.",
        examples: [
            "https://cdn.jwplayer.com/v2/media/nPripu9l",
            "https://cdn.jwplayer.com/players/nPripu9l-ALJ3XQCI.js",
            "jwplatform:nPripu9l",
        ],
    },
    wistia: {
        usage: "Paste a Wistia iframe / medias embed URL (10-character media id), or `wistia:ID`.",
        examples: [
            "https://fast.wistia.net/embed/iframe/j38ihh83m5",
            "https://fast.wistia.com/embed/medias/j38ihh83m5",
            "wistia:j38ihh83m5",
        ],
    },
    kaltura: {
        usage: "Paste a Kaltura widget/entry URL, or the pseudo-URL `kaltura:PARTNER_ID:ENTRY_ID`.",
        examples: [
            "kaltura:269692:1_1jc2y3e4",
            "https://www.kaltura.com/index.php/kwidget/wid/_269692/entry_id/1_1jc2y3e4",
        ],
    },
    anvato: {
        usage: "Paste an Anvato MCP pseudo-URL: `anvato:ACCESS_KEY_OR_MCP:NUMERIC_VIDEO_ID`.",
        examples: ["anvato:lin:8032455", "anvato:X8POa4zpGZMmeiq0wqiO8IP5rMqQM9VN:8032455"],
        notes: "Not a public share link — access key / MCP alias is required.",
    },
    theplatform: {
        usage: "Paste a thePlatform link or player media URL (`link.theplatform.com/s/…` or `player.theplatform.com/…`).",
        examples: [
            "https://link.theplatform.com/s/kYEXFC/22d_qsQ6MIRT",
            "http://link.theplatform.com/s/dJ5BDC/e9I_cZgTgIPd",
        ],
    },
    cloudflarestream: {
        usage: "Paste a Cloudflare Stream watch / iframe / customer subdomain URL (32-hex id or signed JWT).",
        examples: [
            "https://watch.cloudflarestream.com/31c9291ab41fac05471db4e73aa11717",
            "https://iframe.videodelivery.net/31c9291ab41fac05471db4e73aa11717",
        ],
    },
    bunnycdn: {
        usage: "Paste a Bunny Stream embed or play URL from `iframe.mediadelivery.net` / `player.mediadelivery.net`.",
        examples: [
            "https://iframe.mediadelivery.net/embed/113933/e73edec1-e381-4c8b-ae73-717a140e0924",
            "https://iframe.mediadelivery.net/play/136145/32e34c4b-0d72-437c-9abb-05e67657da34",
        ],
    },
    bitmovin: {
        usage: "Paste a Bitmovin Streams share or embed URL (`streams.bitmovin.com/{id}`).",
        examples: [
            "https://streams.bitmovin.com/cgl9rh94uvs51rqc8jhg/share",
            "https://streams.bitmovin.com/cqkl1t5giv3lrce7pjbg/embed",
        ],
    },
    voxmedia: {
        usage: "Paste a Vox Media Volume embed URL (`volume.vox-cdn.com/embed/{id}`).",
        examples: ["https://volume.vox-cdn.com/embed/abcdef012"],
        notes: "Site articles on theverge.com etc. are not fully resolved yet — prefer the Volume embed.",
    },
    // Batch 1 — platforms
    vimeo: {
        usage: "Paste a Vimeo watch or player URL (`vimeo.com/{id}` or `player.vimeo.com/video/{id}`).",
        examples: [
            "https://vimeo.com/22439234",
            "https://player.vimeo.com/video/54469442",
        ],
        notes: "Private / password videos need auth; some regions need Cloudflare bypass.",
    },
    twitch: {
        usage: "Paste a Twitch VOD URL (`twitch.tv/videos/{id}` or `/v/{id}`).",
        examples: ["https://www.twitch.tv/videos/11230755"],
        notes: "Live channels and clips are out of scope for this VOD extractor.",
    },
    tiktok: {
        usage: "Paste a TikTok video URL (`tiktok.com/@user/video/{id}` or `/embed/{id}`).",
        examples: ["https://www.tiktok.com/@leenabhushan/video/6748451240264420610"],
        notes: "May fail behind WAF without impersonation / cookies.",
    },
    twitter: {
        usage: "Paste an X / Twitter status URL containing `/status/{id}`.",
        examples: [
            "https://x.com/SpaceX/status/1338404294848479232",
            "https://twitter.com/Twitter/status/1338404294848479232",
        ],
    },
    instagram: {
        usage: "Paste an Instagram post, reel, or IGTV URL (`/p/`, `/reel/`, `/tv/`).",
        examples: [
            "https://www.instagram.com/reel/AbCdEfGhIjK/",
            "https://www.instagram.com/p/AbCdEfGhIjK/",
        ],
        notes: "Anonymous access is often gated — a session cookie via agent helps.",
    },
    facebook: {
        usage: "Paste a Facebook watch or video URL (`/watch/?v=` or `/videos/{id}`).",
        examples: [
            "https://www.facebook.com/watch/?v=3676516585958356",
            "https://www.facebook.com/radiokicksfm/videos/3676516585958356/",
        ],
    },
    reddit: {
        usage: "Paste a Reddit post URL that hosts native video (`…/comments/{id}/…`).",
        examples: ["https://www.reddit.com/r/videos/comments/6rrwyj/that_small_heart_attack/"],
        notes: "Cross-posts and external embeds may not be Reddit-hosted video.",
    },
    soundcloud: {
        usage: "Paste a SoundCloud track URL (`soundcloud.com/{user}/{track}`).",
        examples: ["https://soundcloud.com/forss/flickermood"],
    },
    dailymotion: {
        usage: "Paste a Dailymotion video or `dai.ly` short URL.",
        examples: [
            "https://www.dailymotion.com/video/x5kesuj",
            "https://dai.ly/x5kesuj",
        ],
    },
    bilibili: {
        usage: "Paste a Bilibili video URL (`/video/BV…` or `/video/av…`).",
        examples: [
            "https://www.bilibili.com/video/BV13x41117TL",
            "https://www.bilibili.com/video/av1074402/",
        ],
        notes: "DASH may return separate audio/video streams.",
    },
    // Batch 2 — planned
    bandcamp: {
        usage: "Paste a Bandcamp track URL (`{artist}.bandcamp.com/track/…`).",
        examples: [
            "https://relapsealumni.bandcamp.com/track/hail-to-fire",
            "https://benprunty.bandcamp.com/track/lanius-battle",
        ],
        notes: "Uses the streamable preview (e.g. mp3-128), not paid downloads.",
    },
    rumble: {
        usage: "Paste a Rumble embed (`/embed/v…`) or video page URL (`/v…-slug.html`).",
        examples: [
            "https://rumble.com/embed/v5pv5f",
            "https://rumble.com/vdmum1-moose-the-dog-helps-girls-dig-a-snow-fort.html",
        ],
    },
    kick: {
        usage: "Paste a Kick VOD (`/{channel}/videos/{uuid}`) or clip URL (`?clip=clip_…`).",
        examples: [
            "https://kick.com/xqc/videos/5c697a87-afce-4256-b01f-3c8fe71ef5cb",
            "https://kick.com/destiny?clip=clip_01H9SKET879NE7N9RJRRDS98J3",
        ],
        notes: "May need Cloudflare bypass (enable in Network options).",
    },
    patreon: {
        usage: "Paste a Patreon post URL with a numeric post id (`patreon.com/posts/…`).",
        examples: ["https://www.patreon.com/posts/video-sketchbook-32452882"],
        notes: "Locked / members-only posts need a session cookie via agent.",
    },
    bluesky: {
        usage: "Paste a Bluesky post URL with embedded video (`bsky.app/profile/…/post/…`).",
        examples: [
            "https://bsky.app/profile/mary.my.id/post/3l6zrz6zyl2dr",
            "https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g",
        ],
    },
    bitchute: {
        usage: "Paste a BitChute video or embed URL (`bitchute.com/video/{id}`).",
        examples: [
            "https://www.bitchute.com/video/UGlrF9o9b-Q/",
            "https://www.bitchute.com/video/Yti_j9A-UZ4/",
        ],
    },
    newgrounds: {
        usage: "Paste a Newgrounds portal movie URL (`newgrounds.com/portal/view/{id}`).",
        examples: [
            "https://www.newgrounds.com/portal/view/1",
            "https://www.newgrounds.com/portal/view/297383",
        ],
        notes: "Often blocks datacenter IPs — enable Cloudflare bypass / CycleTLS if you get HTTP 403.",
    },
    ninegag: {
        usage: "Paste a 9GAG gag URL that contains video (`9gag.com/gag/{id}`).",
        examples: ["https://9gag.com/gag/ae5Ag7B", "https://9gag.com/gag/ajgp66G"],
        notes: "Only animated/video posts; still images are rejected.",
    },
    coub: {
        usage: "Paste a Coub view/embed URL (`coub.com/view/{id}`), or `coub:{id}`.",
        examples: ["https://coub.com/view/5u5n1", "coub:5u5n1"],
    },
    peertube: {
        usage: "Paste a PeerTube watch/embed URL from any instance (`/w/{uuid}` or `/videos/watch/{uuid}`), or `peertube:host:uuid`.",
        examples: [
            "https://framatube.org/videos/watch/9c9de5e8-0a1e-484a-b099-e80766180a6d",
            "https://peertube2.cpy.re/w/122d093a-1ede-43bd-bd34-59d2931ffc5e",
        ],
    },
    // Batch 3 — regional
    niconico: {
        usage: "Paste a niconico watch/shorts URL (`nicovideo.jp/watch/sm…` or numeric id).",
        examples: [
            "https://www.nicovideo.jp/watch/sm8628149",
            "https://www.nicovideo.jp/watch/1173108780",
        ],
        notes: "Guest HLS path; premium/PPV/sensitive may need login. Often JP geo.",
    },
    afreecatv: {
        usage: "Paste a Soop / AfreecaTV VOD URL (`vod.sooplive.com/player/{id}`).",
        examples: [
            "https://vod.sooplive.com/player/192805325",
            "https://vod.sooplive.com/PLAYER/STATION/20515605",
        ],
        notes: "Adult / subscriber VODs may require login cookies.",
    },
    naver: {
        usage: "Paste a Naver TV video URL (`tv.naver.com/v/{id}`).",
        examples: ["https://tv.naver.com/v/81652", "https://tv.naver.com/v/67838091"],
    },
    iqiyi: {
        usage: "Paste an iQIYI video page URL ending in `.html`.",
        examples: ["http://www.iqiyi.com/v_19rrojlavg.html"],
        notes: "Free streams only; often China-geo restricted.",
    },
    youku: {
        usage: "Paste a Youku / Tudou watch URL (`v.youku.com/v_show/id_…`), or `youku:{id}`.",
        examples: [
            "http://v.youku.com/v_show/id_XOTUxMzg4NDMy.html",
            "youku:XOTUxMzg4NDMy",
        ],
        notes: "Often China-geo / copyright restricted outside CN.",
    },
    fc2: {
        usage: "Paste an FC2 video URL (`video.fc2.com/.../content/{id}`), or `fc2:{id}`.",
        examples: [
            "https://video.fc2.com/content/20121209FP73fxDx",
            "https://video.fc2.com/en/content/20121103kUan1KHs",
        ],
    },
    weibo: {
        usage: "Paste a Weibo status URL (`weibo.com/{uid}/{mid}` or `m.weibo.cn/status/{id}`).",
        examples: [
            "https://weibo.com/7827771738/N4xlMvjhI",
            "https://m.weibo.cn/status/4189191225395228",
        ],
    },
    xiaohongshu: {
        usage: "Paste a Xiaohongshu (RED) note URL (`/explore/{id}` or `/discovery/item/{id}`).",
        examples: [
            "https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9",
            "https://www.xiaohongshu.com/discovery/item/674051740000000007027a15",
        ],
    },
    vk: {
        usage: "Paste a VK video URL (`vk.com/video{owner}_{id}`).",
        examples: ["https://vk.com/video205387401_165548505"],
        notes: "Some videos need login; anti-bot challenges may block datacenter IPs.",
    },
    odnoklassniki: {
        usage: "Paste an OK.ru / Odnoklassniki video URL (`ok.ru/video/{id}`).",
        examples: ["https://ok.ru/video/20079905452", "http://ok.ru/video/63567059965189"],
    },
    // Batch 4 — audio / podcasts
    audiomack: {
        usage: "Paste an Audiomack song URL (`/song/{artist}/{slug}` or `/{artist}/song/{slug}`).",
        examples: [
            "https://www.audiomack.com/song/roosh-williams/extraordinary",
            "https://audiomack.com/roosh-williams/song/extraordinary",
        ],
    },
    applepodcasts: {
        usage: "Paste an Apple Podcasts episode URL that includes `?i={episodeId}`.",
        examples: [
            "https://podcasts.apple.com/us/podcast/urbana-podcast-724-by-david-penn/id1531349107?i=1000748574256",
        ],
    },
    mixcloud: {
        usage: "Paste a Mixcloud cloudcast URL (`mixcloud.com/{user}/{slug}`).",
        examples: ["https://www.mixcloud.com/dholbach/cryptkeeper/"],
        notes: "Exclusive / geo-locked mixes may require a Mixcloud login.",
    },
    soundgasm: {
        usage: "Paste a Soundgasm track URL (`soundgasm.net/u/{user}/{slug}`).",
        examples: ["https://soundgasm.net/u/ytdl/Piano-sample"],
    },
    acast: {
        usage: "Paste an Acast show episode URL (`shows.acast.com/{show}/episodes/{slug}`).",
        examples: [
            "https://shows.acast.com/sparpodcast/episodes/2.raggarmordet-rosterurdetforflutna",
            "https://embed.acast.com/adambuxton/ep.12-adam-joeschristmaspodcast2015",
        ],
    },
    art19: {
        usage: "Paste an ART19 episode URL or direct `rss.art19.com/episodes/{uuid}.mp3` link.",
        examples: [
            "https://art19.com/shows/scamfluencers/episodes/8319b776-4153-4d22-8630-631f204a03dd",
            "https://rss.art19.com/episodes/5ba1413c-48b8-472b-9cc3-cfd952340bdb.mp3",
        ],
    },
    yandexmusic: {
        usage: "Paste a Yandex Music track URL (`music.yandex.*/album/{album}/track/{id}`).",
        examples: ["https://music.yandex.ru/album/540508/track/4878838"],
        notes: "Captcha / cookie blocks are common outside RU.",
    },
    audius: {
        usage: "Paste an Audius track URL (`audius.co/{artist}/{track}`).",
        examples: ["https://audius.co/voltra/radar-103692"],
    },
    bandlab: {
        usage: "Paste a BandLab track, post, or revision URL.",
        examples: [
            "https://www.bandlab.com/track/04b37e88dba24967b9dac8eb8567ff39_07d7f906fc96ee11b75e000d3a428fff",
        ],
    },
    reverbnation: {
        usage: "Paste a ReverbNation song URL (`…/song/{id}-slug`).",
        examples: ["https://www.reverbnation.com/alkilados/song/16965047-mona-lisa"],
    },
    // Batch 5 — planned
    archiveorg: {
        usage: "Paste an Internet Archive details or download URL for a media item.",
        examples: ["https://archive.org/details/item-identifier"],
    },
    bbc: {
        usage: "Paste a BBC iPlayer / Sounds programme URL.",
        examples: ["https://www.bbc.co.uk/iplayer/episode/…"],
        notes: "Often geo-restricted to the UK.",
    },
    ard: {
        usage: "Paste an ARD Mediathek video URL.",
        examples: ["https://www.ardmediathek.de/video/…"],
    },
    arte: {
        usage: "Paste an Arte video URL (`arte.tv/…/videos/…`).",
        examples: ["https://www.arte.tv/en/videos/…"],
    },
    pbs: {
        usage: "Paste a PBS / PBS video URL.",
        examples: ["https://www.pbs.org/video/…"],
    },
    cnn: {
        usage: "Paste a CNN video page URL.",
        examples: ["https://www.cnn.com/videos/…"],
    },
    nbc: {
        usage: "Paste an NBC video / show URL.",
        examples: ["https://www.nbc.com/…/video/…"],
    },
    abc: {
        usage: "Paste an ABC (US or AU) video URL.",
        examples: ["https://abcnews.go.com/…/video/…"],
    },
    bloomberg: {
        usage: "Paste a Bloomberg video URL.",
        examples: ["https://www.bloomberg.com/news/videos/…"],
    },
    reuters: {
        usage: "Paste a Reuters video URL.",
        examples: ["https://www.reuters.com/video/…"],
    },
    // Batch 6 — planned
    googledrive: {
        usage: "Paste a Google Drive file URL (`drive.google.com/file/d/{id}`).",
        examples: ["https://drive.google.com/file/d/FILE_ID/view"],
        notes: "File must be shared for anyone with the link.",
    },
    dropbox: {
        usage: "Paste a Dropbox shared file URL.",
        examples: ["https://www.dropbox.com/s/…/video.mp4"],
    },
    imgur: {
        usage: "Paste an Imgur image/album URL that contains a video or GIFV.",
        examples: ["https://imgur.com/abc1234"],
    },
    redgifs: {
        usage: "Paste a RedGifs watch URL.",
        examples: ["https://www.redgifs.com/watch/…"],
    },
    streamable: {
        usage: "Paste a Streamable URL (`streamable.com/{id}`).",
        examples: ["https://streamable.com/abc123"],
    },
    box: {
        usage: "Paste a Box shared file URL.",
        examples: ["https://app.box.com/s/…"],
    },
    yandexdisk: {
        usage: "Paste a Yandex Disk public link.",
        examples: ["https://disk.yandex.com/d/…"],
    },
    mediafire: {
        usage: "Paste a MediaFire file URL.",
        examples: ["https://www.mediafire.com/file/…/video.mp4"],
    },
    pixeldrain: {
        usage: "Paste a Pixeldrain file URL (`pixeldrain.com/u/{id}`).",
        examples: ["https://pixeldrain.com/u/abc123"],
    },
    streamja: {
        usage: "Paste a Streamja clip URL.",
        examples: ["https://streamja.com/abc12"],
    },
};
function fallbackUsage(info) {
    return {
        usage: `Paste a URL accepted by the ${info.name} extractor${info.description ? ` (${info.description})` : ""}.`,
        examples: [],
        notes: info.validUrl ? `Matcher: ${info.validUrl}` : undefined,
    };
}
/** Attach urlUsage / examples / notes onto extractor meta. */
function withUrlUsage(info) {
    const guide = exports.URL_USAGE[info.name] || fallbackUsage(info);
    return {
        ...info,
        urlUsage: guide.usage,
        examples: guide.examples,
        notes: guide.notes,
    };
}
//# sourceMappingURL=url-usage.js.map