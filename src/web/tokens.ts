import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ApiTokenRecord {
  id: string;
  name: string;
  /** First characters of the secret for identification (e.g. ytdl_ab12…) */
  prefix: string;
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiTokenPublic {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  active: boolean;
}

export interface CreatedApiToken extends ApiTokenPublic {
  /** Full secret — only returned once at creation time */
  token: string;
}

interface TokenFile {
  version: 1;
  tokens: ApiTokenRecord[];
}

function defaultDataDir(): string {
  if (process.env.YTDL_DATA_DIR) return path.resolve(process.env.YTDL_DATA_DIR);
  return path.join(os.homedir(), ".ytdl-core");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function newTokenSecret(): string {
  return `ytdl_${crypto.randomBytes(32).toString("base64url")}`;
}

function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function toPublic(record: ApiTokenRecord): ApiTokenPublic {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
    active: !record.revokedAt,
  };
}

export class TokenStore {
  readonly filePath: string;
  private data: TokenFile = { version: 1, tokens: [] };

  constructor(dataDir = defaultDataDir()) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, "api-tokens.json");
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.save();
      return;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as TokenFile;
      if (raw?.version === 1 && Array.isArray(raw.tokens)) {
        this.data = raw;
      }
    } catch {
      this.data = { version: 1, tokens: [] };
      this.save();
    }
  }

  private save(): void {
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch {
      /* ignore on platforms that don't support chmod */
    }
  }

  list(): ApiTokenPublic[] {
    return this.data.tokens
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublic);
  }

  create(name: string): CreatedApiToken {
    const trimmed = name.trim() || "API token";
    const token = newTokenSecret();
    const record: ApiTokenRecord = {
      id: newId(),
      name: trimmed,
      prefix: `${token.slice(0, 12)}…`,
      hash: hashToken(token),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.data.tokens.push(record);
    this.save();
    return { ...toPublic(record), token };
  }

  revoke(id: string): ApiTokenPublic | null {
    const record = this.data.tokens.find(t => t.id === id);
    if (!record) return null;
    if (!record.revokedAt) {
      record.revokedAt = new Date().toISOString();
      this.save();
    }
    return toPublic(record);
  }

  delete(id: string): boolean {
    const before = this.data.tokens.length;
    this.data.tokens = this.data.tokens.filter(t => t.id !== id);
    if (this.data.tokens.length === before) return false;
    this.save();
    return true;
  }

  /** Validate Bearer secret; updates lastUsedAt on success */
  authenticate(token: string | null | undefined): ApiTokenPublic | null {
    if (!token) return null;
    const secret = token.trim();
    if (!secret.startsWith("ytdl_")) return null;
    const digest = hashToken(secret);
    const record = this.data.tokens.find(t => t.hash === digest && !t.revokedAt);
    if (!record) return null;
    record.lastUsedAt = new Date().toISOString();
    this.save();
    return toPublic(record);
  }
}

let singleton: TokenStore | null = null;

export function getTokenStore(): TokenStore {
  singleton ??= new TokenStore();
  return singleton;
}
