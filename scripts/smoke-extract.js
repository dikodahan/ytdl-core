/**
 * Network smoke test: extract formats for a known public video.
 * Usage: node scripts/smoke-extract.js [videoIdOrUrl]
 */
const ytdl = require("../lib/compat/ytdl-core");
const { extractInfo, VLC_CLIENTS } = require("../lib/index");
const { request } = require("undici");

const target = process.argv.slice(2).find(a => a && a !== "--") || "aqz-KE-bpKQ";

(async () => {
  console.log("typeof ytdl:", typeof ytdl, "getInfo:", typeof ytdl.getInfo);
  console.log("compat getInfo:", target);
  const info = await ytdl.getInfo(target);
  console.log("title:", info.videoDetails.title);
  console.log("formats:", info.formats.length);

  console.log("\ncore extractInfo VLC clients:", VLC_CLIENTS);
  const core = await extractInfo(target, { vlcOnly: true });
  console.log("core title:", core.title);
  console.log("core formats:", core.formats?.length);
  const best = core.formats?.find(f => f.has_video && f.has_audio && f.url);
  if (best?.url) {
    const res = await request(best.url, {
      method: "GET",
      headers: { Range: "bytes=0-1023", "User-Agent": "VLC/3.0.20", Referer: "https://www.youtube.com/" },
    });
    const buf = Buffer.from(await res.body.arrayBuffer());
    console.log("VLC probe", best.itag || best.format_id, res.statusCode, buf.length, "bytes");
    if (res.statusCode >= 400 || buf.length < 64) {
      process.exitCode = 1;
      console.error("FAIL: stream not readable by VLC");
      return;
    }
  }

  if (!info.formats.length || !core.formats?.length) {
    process.exitCode = 1;
    console.error("FAIL: no formats");
  } else {
    console.log("\nOK");
  }
})().catch(err => {
  console.error("FAIL:", err);
  process.exitCode = 1;
});
