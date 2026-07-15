import type { CategoryListEntry } from "../extractor/_shared/page-links";
export interface CategoryListResult {
    extractor: string;
    webpage_url: string;
    entries: CategoryListEntry[];
}
export interface ListCategoriesOptions {
    limit?: number;
}
//# sourceMappingURL=category-list.d.ts.map