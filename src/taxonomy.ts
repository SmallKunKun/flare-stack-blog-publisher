import type { BlogApi } from "./api/client";

export type CategoryAction =
  | { action: "keep" }
  | { action: "clear" }
  | { action: "set"; id: number };

export interface TaxonomyInput {
  categoryName: string | undefined;
  syncTags: boolean;
  tagNames: string[];
  autoCreate: boolean;
}

export interface TaxonomyResult {
  category: CategoryAction;
  tagIds: number[] | undefined;
  warnings: string[];
}

export async function resolveTaxonomy(
  api: BlogApi,
  input: TaxonomyInput,
): Promise<TaxonomyResult> {
  const warnings: string[] = [];
  const [categories, tags] = await Promise.all([
    input.categoryName !== undefined
      ? api.listCategoryOptions()
      : Promise.resolve([]),
    input.syncTags ? api.listTags() : Promise.resolve([]),
  ]);

  let category: CategoryAction = { action: "keep" };
  if (input.categoryName !== undefined) {
    const name = input.categoryName.trim();
    if (!name) {
      category = { action: "clear" };
    } else {
      const existing = categories.find(
        (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (existing) {
        category = { action: "set", id: existing.id };
      } else if (input.autoCreate) {
        const created = await api.createCategory(name);
        category = { action: "set", id: created.id };
      } else {
        warnings.push(`分类「${name}」不存在，已保留原分类。`);
      }
    }
  }

  let tagIds: number[] | undefined;
  if (input.syncTags) {
    if (input.tagNames.length === 0) {
      tagIds = [];
    } else {
      const byName = new Map(
        tags.map((tag) => [tag.name.toLocaleLowerCase(), tag.id]),
      );
      const resolved: number[] = [];
      const missing: string[] = [];

      for (const name of input.tagNames) {
        const id = byName.get(name.toLocaleLowerCase());
        if (id !== undefined) resolved.push(id);
        else missing.push(name);
      }

      if (missing.length > 0 && !input.autoCreate) {
        warnings.push(`标签不存在，已保留原标签：${missing.join("、")}`);
      } else {
        for (const name of missing) {
          const created = await api.createTag(name);
          resolved.push(created.id);
        }
        tagIds = resolved;
      }
    }
  }

  return { category, tagIds, warnings };
}

export function categoryIdFor(action: CategoryAction): number | null | undefined {
  switch (action.action) {
    case "keep":
      return undefined;
    case "clear":
      return null;
    case "set":
      return action.id;
  }
}
