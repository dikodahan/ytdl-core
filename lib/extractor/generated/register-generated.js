"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGeneratedExtractors = registerGeneratedExtractors;
exports.generatedExtractorCount = generatedExtractorCount;
const registry_1 = require("../../core/registry");
const factory_1 = require("./factory");
const generic_1 = require("../generic/generic");
const catalog_json_1 = __importDefault(require("./catalog.json"));
let registered = false;
function registerGeneratedExtractors() {
    if (registered)
        return;
    registered = true;
    const extractors = catalog_json_1.default.extractors || [];
    for (const entry of extractors) {
        const name = entry.ieName || entry.id;
        // Hand-ported extractors are registered first — skip generated stubs with the same name.
        if (name && (0, registry_1.findExtractorByName)(name))
            continue;
        try {
            (0, registry_1.registerExtractor)((0, factory_1.createGeneratedExtractor)(entry));
        }
        catch (err) {
            console.warn(`skip generated extractor ${entry.id}:`, err);
        }
    }
    // Catch-all last (yt-dlp GenericIE ordering).
    (0, registry_1.registerExtractor)(generic_1.GenericIE);
}
function generatedExtractorCount() {
    return catalog_json_1.default.extractors?.length || 0;
}
//# sourceMappingURL=register-generated.js.map