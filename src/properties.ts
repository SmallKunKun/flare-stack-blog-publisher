export const PROPERTY_KEYS = {
  title: "标题",
  summary: "摘要",
  slug: "链接",
  tags: "标签",
  category: "分类",
  cover: "封面",
  publishedAt: "日期",
} as const;

const ENGLISH_TO_CHINESE: ReadonlyArray<[string, string]> = [
  ["title", PROPERTY_KEYS.title],
  ["summary", PROPERTY_KEYS.summary],
  ["slug", PROPERTY_KEYS.slug],
  ["tags", PROPERTY_KEYS.tags],
  ["category", PROPERTY_KEYS.category],
  ["cover", PROPERTY_KEYS.cover],
  ["publishedAt", PROPERTY_KEYS.publishedAt],
];

/**
 * Moves the plugin's old English frontmatter keys to Chinese ones. Returns
 * true when something changed.
 */
export function migrateProperties(
  frontmatter: Record<string, unknown>,
): boolean {
  let changed = false;

  for (const [english, chinese] of ENGLISH_TO_CHINESE) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, english)) continue;
    if (!Object.prototype.hasOwnProperty.call(frontmatter, chinese)) {
      frontmatter[chinese] = frontmatter[english];
    }
    delete frontmatter[english];
    changed = true;
  }

  return changed;
}
