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
export declare class TokenStore {
    readonly filePath: string;
    private data;
    constructor(dataDir?: string);
    private load;
    private save;
    list(): ApiTokenPublic[];
    create(name: string): CreatedApiToken;
    revoke(id: string): ApiTokenPublic | null;
    delete(id: string): boolean;
    /** Validate Bearer secret; updates lastUsedAt on success */
    authenticate(token: string | null | undefined): ApiTokenPublic | null;
}
export declare function getTokenStore(): TokenStore;
//# sourceMappingURL=tokens.d.ts.map