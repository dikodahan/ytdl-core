import { registerExtractor } from "../../core/registry";
import { createGeneratedExtractor, type GeneratedCatalogEntry } from "./factory";
import { GenericIE } from "../generic/generic";
import catalogJson from "./catalog.json";

let registered = false;

export function registerGeneratedExtractors(): void {
  if (registered) return;
  registered = true;

  const extractors = (catalogJson as { extractors?: GeneratedCatalogEntry[] }).extractors || [];
  for (const entry of extractors) {
    try {
      registerExtractor(createGeneratedExtractor(entry));
    } catch (err) {
      console.warn(`skip generated extractor ${entry.id}:`, err);
    }
  }

  // Catch-all last (yt-dlp GenericIE ordering).
  registerExtractor(GenericIE);
}

export function generatedExtractorCount(): number {
  return (catalogJson as { extractors?: GeneratedCatalogEntry[] }).extractors?.length || 0;
}
