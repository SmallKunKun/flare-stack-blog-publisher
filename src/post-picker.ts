import { SuggestModal, type App } from "obsidian";
import type { AdminPostListItem } from "./api/types";

export type PostPickerChoice =
  | { kind: "new" }
  | { kind: "post"; post: AdminPostListItem }
  | null;

interface PickerItem {
  kind: "new" | "post";
  post?: AdminPostListItem;
}

export class PostPickerModal extends SuggestModal<PickerItem> {
  private settled = false;

  constructor(
    app: App,
    private readonly matches: AdminPostListItem[],
    private readonly resolve: (choice: PostPickerChoice) => void,
  ) {
    super(app);
    this.setPlaceholder("选一篇更新，或者新建");
    this.setInstructions([
      { command: "↵", purpose: "选择" },
      { command: "esc", purpose: "取消" },
    ]);
  }

  getSuggestions(query: string): PickerItem[] {
    const needle = query.trim().toLocaleLowerCase();
    const posts = this.matches
      .filter((post) => {
        if (!needle) return true;
        return (
          post.title.toLocaleLowerCase().includes(needle) ||
          post.slug.toLocaleLowerCase().includes(needle)
        );
      })
      .map<PickerItem>((post) => ({ kind: "post", post }));

    return [{ kind: "new" }, ...posts];
  }

  renderSuggestion(item: PickerItem, el: HTMLElement): void {
    if (item.kind === "new") {
      el.createDiv({ text: "新建文章", cls: "fsb-picker-title" });
      el.createDiv({
        text: "忽略上面的匹配，重新建一篇",
        cls: "fsb-picker-meta",
      });
      return;
    }

    const post = item.post;
    if (!post) return;
    el.createDiv({ text: post.title, cls: "fsb-picker-title" });
    const state = post.status === "published" ? "已发布" : "草稿";
    const slug = post.publicSlug ?? post.slug;
    el.createDiv({
      text: `${state} · ${slug} · 更新于 ${formatDate(post.updatedAt)}`,
      cls: "fsb-picker-meta",
    });
  }

  onChooseSuggestion(item: PickerItem): void {
    this.settled = true;
    if (item.kind === "new" || !item.post) {
      this.resolve({ kind: "new" });
      return;
    }
    this.resolve({ kind: "post", post: item.post });
  }

  onClose(): void {
    if (!this.settled) this.resolve(null);
    super.onClose();
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
