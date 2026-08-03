/**
 * Playerjs (#1 / #F) decode helpers used by Ontivi's packed player (`p13.js`).
 * Site config sets enc2="F", file3_separator="F", and fpv1/fpv2 → kodk/kos.
 */

const ABC = String.fromCharCode(
  65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 97, 98, 99, 100, 101, 102, 103, 104, 105,
  106, 107, 108, 109, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121, 122,
);

/** Default sugar key observed in Ontivi's Playerjs build. */
export const DEFAULT_PLAYER_Y = "xx???x=xx?xx?=";

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
export const DEFAULT_ONTIVI_PLAYER_CONFIG: OntiviPlayerConfig = {
  enc2: "F",
  file3_separator: "F",
  bk0: "556G3",
  bk1: "556G3D",
  bk2: "556G3DQ",
  bk3: "556G3DQ1",
  bk4: "556G3DQ1V",
  fpv1: "js:kodk",
  fpv2: "js:kos",
  fpv3: "js:tims",
  fpv4: "js:time",
  fpv5: "js:kan",
  fplace: 1,
};

function sugar(y: string): number {
  const parts = y.split("=");
  let result = "";
  for (const part of parts) {
    let bits = "";
    for (const ch of part) bits += ch === "x" ? "1" : "0";
    result += String.fromCharCode(parseInt(bits, 2));
  }
  return Number(result.slice(0, -1));
}

function pepper(s: string, n: number, y: string): string {
  let rotated = s.replace(/\+/g, "#").replace(/#/g, "+");
  let a = sugar(y) * n;
  if (n < 0) a += ABC.length / 2;
  const alphabet = ABC.slice(a * 2) + ABC.slice(0, a * 2);
  return rotated.replace(/[A-Za-z]/g, c => alphabet.charAt(ABC.indexOf(c)));
}

function saltDecode(input: string): string {
  const key = ABC + "0123456789+/=";
  let e = input.replace(/[^A-Za-z0-9+/=]/g, "");
  let out = "";
  for (let f = 0; f < e.length; ) {
    const s = key.indexOf(e.charAt(f++));
    const o = key.indexOf(e.charAt(f++));
    const u = key.indexOf(e.charAt(f++));
    const a = key.indexOf(e.charAt(f++));
    const n = (s << 2) | (o >> 4);
    const r = ((o & 15) << 4) | (u >> 2);
    const i = ((u & 3) << 6) | a;
    out += String.fromCharCode(n);
    if (u !== 64) out += String.fromCharCode(r);
    if (a !== 64) out += String.fromCharCode(i);
  }
  return utf8Decode(out);
}

function utf8Decode(e: string): string {
  let t = "";
  let n = 0;
  while (n < e.length) {
    const r = e.charCodeAt(n);
    if (r < 128) {
      t += String.fromCharCode(r);
      n++;
    } else if (r > 191 && r < 224) {
      const c2 = e.charCodeAt(n + 1);
      t += String.fromCharCode(((r & 31) << 6) | (c2 & 63));
      n += 2;
    } else {
      const c2 = e.charCodeAt(n + 1);
      const c3 = e.charCodeAt(n + 2);
      t += String.fromCharCode(((r & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      n += 3;
    }
  }
  return t;
}

/** Decode Playerjs `#0` / `#1` protected strings. */
export function decodePlayerjsString(encoded: string, y = DEFAULT_PLAYER_Y): string {
  if (encoded.startsWith("#1")) return saltDecode(pepper(encoded.slice(2), -1, y));
  if (encoded.startsWith("#0")) return saltDecode(encoded.slice(2));
  return encoded;
}

function btoaUtf8(str: string): string {
  return Buffer.from(str, "utf8").toString("base64");
}

function atobUtf8(str: string): string {
  return Buffer.from(str, "base64").toString("utf8");
}

/** Decode a Playerjs `#F` / `#2` file payload (junk markers + base64). */
export function decodePlayerjsFile2(encoded: string, config: OntiviPlayerConfig): string {
  const enc2 = config.enc2 || "F";
  if (!encoded.startsWith(`#${enc2}`) && !encoded.startsWith("#2") && !encoded.startsWith("#F")) {
    return encoded;
  }
  let a = encoded.slice(2);
  const sep = config.file3_separator || "F";
  for (let i = 4; i >= 0; i--) {
    const bk = config[`bk${i}` as keyof OntiviPlayerConfig];
    if (typeof bk === "string" && bk) {
      a = a.split(sep + btoaUtf8(bk)).join("");
    }
  }
  try {
    return atobUtf8(a);
  } catch {
    return "";
  }
}

export function applyPlayerjsPlaceholders(
  template: string,
  vars: Record<string, string>,
  config: OntiviPlayerConfig,
): string {
  let out = template;
  for (let i = 1; i <= 5; i++) {
    const fpv = config[`fpv${i}` as keyof OntiviPlayerConfig];
    if (!out.includes(`{v${i}}`) || typeof fpv !== "string" || !fpv) continue;
    const value = fpv.startsWith("js:") ? vars[fpv.slice(3)] ?? "" : fpv;
    out = out.replace(new RegExp(`\\{v${i}\\}`, "gi"), value);
  }
  return out;
}

/** Fully resolve Ontivi Playerjs `file` into one or more stream URL candidates. */
export function resolveOntiviPlayerFile(
  file: string,
  vars: { kodk: string; kos: string; tims?: string; time?: string; kan?: string },
  config: OntiviPlayerConfig = DEFAULT_ONTIVI_PLAYER_CONFIG,
): string[] {
  let cur = file.trim();
  for (let round = 0; round < 4; round++) {
    const enc2 = config.enc2 || "F";
    if (!cur.startsWith(`#${enc2}`) && !cur.startsWith("#2") && !cur.startsWith("#F")) break;
    const next = decodePlayerjsFile2(cur, config);
    if (!next || next === cur) break;
    cur = next;
    if (/https?:\/\//i.test(cur) && !cur.startsWith("#")) break;
  }

  if (cur.startsWith("#")) {
    const m = cur.match(/aHR0cHM6Ly[A-Za-z0-9+/=]+/);
    if (m) {
      for (let len = m[0].length; len > 24; len--) {
        try {
          const chunk = m[0].slice(0, len);
          const padded = chunk + "=".repeat((4 - (chunk.length % 4)) % 4);
          const decoded = Buffer.from(padded, "base64").toString("utf8");
          if (/^https?:\/\//i.test(decoded) && !decoded.includes("\0")) {
            cur = decoded;
            break;
          }
        } catch {
          /* try shorter */
        }
      }
    }
  }

  const globals = {
    kodk: vars.kodk,
    kos: vars.kos,
    tims: vars.tims ?? "",
    time: vars.time ?? String(Math.floor(Date.now() / 1000)),
    kan: vars.kan ?? "",
  };
  const placed = applyPlayerjsPlaceholders(cur, globals, config);
  return placed
    .split(/\s+or\s+/i)
    .map(s => s.trim())
    .filter(s => /^https?:\/\//i.test(s));
}

/** Unpack Dean Edwards–style packer used by Playerjs builds. */
export function unpackPacker(source: string): string {
  const m = source.match(/\}\('([\s\S]+)',(\d+),(\d+),'([\s\S]+)'\.split\('\|'\)/);
  if (!m) throw new Error("Not a packed Playerjs script");
  let payload = m[1];
  const radix = Number(m[2]);
  const count = Number(m[3]);
  const keywords = m[4].split("|");
  const encode = (c: number): string =>
    (c < radix ? "" : encode(Math.floor(c / radix))) +
    (c % radix > 35 ? String.fromCharCode((c % radix) + 29) : (c % radix).toString(36));
  const dict: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const key = encode(i);
    dict[key] = keywords[i] || key;
  }
  return payload.replace(/\b\w+\b/g, w => dict[w] || w);
}

function extractEscapedString(source: string, marker: string): string | null {
  const idx = source.indexOf(marker);
  if (idx < 0) return null;
  const start = idx + marker.length;
  const end = source.indexOf("\\'", start);
  if (end < 0) return null;
  return source.slice(start, end);
}

/** Parse Ontivi player script into stream-decode config. */
export function parseOntiviPlayerConfig(playerJs: string): OntiviPlayerConfig {
  const unpacked = unpackPacker(playerJs);
  const y =
    extractEscapedString(unpacked, "y:\\'") ||
    unpacked.match(/y:'(xx\?\?\?x=xx\?xx\?=)'/)?.[1] ||
    DEFAULT_PLAYER_Y;
  const uEnc =
    extractEscapedString(unpacked, "u:\\'") ||
    unpacked.match(/u:'(#1[^']+)'/)?.[1];
  if (!uEnc) return { ...DEFAULT_ONTIVI_PLAYER_CONFIG };

  const raw = decodePlayerjsString(uEnc, y);
  const cfg = JSON.parse(raw) as Record<string, unknown>;
  return {
    enc2: typeof cfg.enc2 === "string" ? cfg.enc2 : DEFAULT_ONTIVI_PLAYER_CONFIG.enc2,
    file3_separator:
      typeof cfg.file3_separator === "string"
        ? cfg.file3_separator
        : DEFAULT_ONTIVI_PLAYER_CONFIG.file3_separator,
    bk0: typeof cfg.bk0 === "string" ? cfg.bk0 : DEFAULT_ONTIVI_PLAYER_CONFIG.bk0,
    bk1: typeof cfg.bk1 === "string" ? cfg.bk1 : DEFAULT_ONTIVI_PLAYER_CONFIG.bk1,
    bk2: typeof cfg.bk2 === "string" ? cfg.bk2 : DEFAULT_ONTIVI_PLAYER_CONFIG.bk2,
    bk3: typeof cfg.bk3 === "string" ? cfg.bk3 : DEFAULT_ONTIVI_PLAYER_CONFIG.bk3,
    bk4: typeof cfg.bk4 === "string" ? cfg.bk4 : DEFAULT_ONTIVI_PLAYER_CONFIG.bk4,
    fpv1: typeof cfg.fpv1 === "string" ? cfg.fpv1 : DEFAULT_ONTIVI_PLAYER_CONFIG.fpv1,
    fpv2: typeof cfg.fpv2 === "string" ? cfg.fpv2 : DEFAULT_ONTIVI_PLAYER_CONFIG.fpv2,
    fpv3: typeof cfg.fpv3 === "string" ? cfg.fpv3 : DEFAULT_ONTIVI_PLAYER_CONFIG.fpv3,
    fpv4: typeof cfg.fpv4 === "string" ? cfg.fpv4 : DEFAULT_ONTIVI_PLAYER_CONFIG.fpv4,
    fpv5: typeof cfg.fpv5 === "string" ? cfg.fpv5 : DEFAULT_ONTIVI_PLAYER_CONFIG.fpv5,
    fplace: typeof cfg.fplace === "number" ? cfg.fplace : 1,
  };
}
