"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenStore = void 0;
exports.getTokenStore = getTokenStore;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function defaultDataDir() {
    if (process.env.YTDL_DATA_DIR)
        return path.resolve(process.env.YTDL_DATA_DIR);
    return path.join(os.homedir(), ".ytdl-core");
}
function hashToken(token) {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
function newTokenSecret() {
    return `ytdl_${crypto.randomBytes(32).toString("base64url")}`;
}
function newId() {
    return crypto.randomBytes(8).toString("hex");
}
function toPublic(record) {
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
class TokenStore {
    filePath;
    data = { version: 1, tokens: [] };
    constructor(dataDir = defaultDataDir()) {
        fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, "api-tokens.json");
        this.load();
    }
    load() {
        if (!fs.existsSync(this.filePath)) {
            this.save();
            return;
        }
        try {
            const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
            if (raw?.version === 1 && Array.isArray(raw.tokens)) {
                this.data = raw;
            }
        }
        catch {
            this.data = { version: 1, tokens: [] };
            this.save();
        }
    }
    save() {
        const tmp = `${this.filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
        fs.renameSync(tmp, this.filePath);
        try {
            fs.chmodSync(this.filePath, 0o600);
        }
        catch {
            /* ignore on platforms that don't support chmod */
        }
    }
    list() {
        return this.data.tokens
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(toPublic);
    }
    create(name) {
        const trimmed = name.trim() || "API token";
        const token = newTokenSecret();
        const record = {
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
    revoke(id) {
        const record = this.data.tokens.find(t => t.id === id);
        if (!record)
            return null;
        if (!record.revokedAt) {
            record.revokedAt = new Date().toISOString();
            this.save();
        }
        return toPublic(record);
    }
    delete(id) {
        const before = this.data.tokens.length;
        this.data.tokens = this.data.tokens.filter(t => t.id !== id);
        if (this.data.tokens.length === before)
            return false;
        this.save();
        return true;
    }
    /** Validate Bearer secret; updates lastUsedAt on success */
    authenticate(token) {
        if (!token)
            return null;
        const secret = token.trim();
        if (!secret.startsWith("ytdl_"))
            return null;
        const digest = hashToken(secret);
        const record = this.data.tokens.find(t => t.hash === digest && !t.revokedAt);
        if (!record)
            return null;
        record.lastUsedAt = new Date().toISOString();
        this.save();
        return toPublic(record);
    }
}
exports.TokenStore = TokenStore;
let singleton = null;
function getTokenStore() {
    singleton ??= new TokenStore();
    return singleton;
}
//# sourceMappingURL=tokens.js.map