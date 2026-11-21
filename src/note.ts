import { getFrontMatterInfo, parseYaml } from "obsidian";
import { PROPERTY_KEYS } from "./properties";
import { normalizePublishedAt } from "./time";

function hasOwn(
  frontmatter: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(frontmatter, key);
}

export interface ParsedNote {
  frontmatter: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

export function parseNote(content: string): ParsedNote {
  const info = getFrontMatterInfo(content);
  let frontmatter: Record<string, unknown> = {};

  if (info.exists) {
    try {
      const parsed = parseYaml(info.frontmatter);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      // A malformed frontmatter block must not stop a publish; the body is
      // still readable, and the plugin writes metadata back as YAML.
    }
  }

  const rawBody = info.exists ? content.slice(info.contentStart) : content;
  return {
    frontmatter,
    body: rawBody.replace(/^\r?\n/, ""),
    hasFrontmatter: info.exists,
  };
}

export function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

export function stringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of values) {
    const raw = stringValue(item);
    if (!raw) continue;
    for (const part of raw.split(/[,，]/)) {
      const name = part.trim().replace(/^#/, "");
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(name);
    }
  }

  return result;
}

export function noteTitle(
  frontmatter: Record<string, unknown>,
  fallback: string,
): string {
  const value = hasOwn(frontmatter, PROPERTY_KEYS.title)
    ? frontmatter[PROPERTY_KEYS.title]
    : frontmatter.title;
  return stringValue(value) ?? fallback;
}

export function noteSummary(
  frontmatter: Record<string, unknown>,
): string | undefined {
  const value = hasOwn(frontmatter, PROPERTY_KEYS.summary)
    ? frontmatter[PROPERTY_KEYS.summary]
    : (frontmatter.summary ?? frontmatter.description);
  return stringValue(value);
}

export function noteSlug(
  frontmatter: Record<string, unknown>,
): string | undefined {
  const value = hasOwn(frontmatter, PROPERTY_KEYS.slug)
    ? frontmatter[PROPERTY_KEYS.slug]
    : frontmatter.slug;
  return stringValue(value);
}

export function notePostId(
  frontmatter: Record<string, unknown>,
): number | undefined {
  return numberValue(frontmatter.fsb_post_id);
}

export function notePublishedAt(
  frontmatter: Record<string, unknown>,
): string | undefined {
  const value = hasOwn(frontmatter, PROPERTY_KEYS.publishedAt)
    ? frontmatter[PROPERTY_KEYS.publishedAt]
    : frontmatter.publishedAt;
  return normalizePublishedAt(value);
}

export function noteTags(frontmatter: Record<string, unknown>): string[] {
  const source = hasOwn(frontmatter, PROPERTY_KEYS.tags)
    ? [frontmatter[PROPERTY_KEYS.tags]]
    : [frontmatter.tags, frontmatter.tag];
  const merged = source.flatMap((value) => stringList(value));
  const seen = new Set<string>();
  return merged.filter((tag) => {
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function noteCategory(
  frontmatter: Record<string, unknown>,
): string | undefined {
  const value = hasOwn(frontmatter, PROPERTY_KEYS.category)
    ? frontmatter[PROPERTY_KEYS.category]
    : (frontmatter.category ?? frontmatter.categories);
  if (Array.isArray(value)) return stringValue(value[0]);
  return stringValue(value);
}

export function hasTagField(
  frontmatter: Record<string, unknown>,
): boolean {
  return (
    hasOwn(frontmatter, PROPERTY_KEYS.tags) ||
    hasOwn(frontmatter, "tags") ||
    hasOwn(frontmatter, "tag")
  );
}

export function hasCategoryField(
  frontmatter: Record<string, unknown>,
): boolean {
  return (
    hasOwn(frontmatter, PROPERTY_KEYS.category) ||
    hasOwn(frontmatter, "category") ||
    hasOwn(frontmatter, "categories")
  );
}
