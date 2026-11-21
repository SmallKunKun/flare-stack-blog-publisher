import { Modal, TextComponent, type App } from "obsidian";
import type { BlogApi } from "./api/client";
import { describeApiError } from "./api/errors";
import type { AdminPostListItem } from "./api/types";
import { formatBeijingTime } from "./time";

export class PullPostModal extends Modal {
  private query = "";
  private timer: number | null = null;
  private requestId = 0;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;

  constructor(
    app: App,
    private readonly api: BlogApi,
    private readonly isLocal: (postId: number) => boolean,
    private readonly onChoose: (post: AdminPostListItem) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-pull-modal");
    this.titleEl.setText("拉取文章");
    this.contentEl.empty();

    const searchWrap = this.contentEl.createDiv({ cls: "fsb-pull-search-wrap" });
    const search = new TextComponent(searchWrap);
    search
      .setPlaceholder("搜索标题或 slug…")
      .onChange((value) => {
        this.query = value;
        if (this.timer !== null) window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => void this.load(), 250);
      });
    search.inputEl.addClass("fsb-pull-search");

    this.statusEl = this.contentEl.createDiv({ cls: "fsb-pull-status" });
    this.listEl = this.contentEl.createDiv({ cls: "fsb-pull-list" });

    window.setTimeout(() => search.inputEl.focus(), 0);
    void this.load();
  }

  onClose(): void {
    this.requestId += 1;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.contentEl.empty();
  }

  private async load(): Promise<void> {
    const requestId = ++this.requestId;
    this.statusEl.setText("加载中…");
    this.listEl.empty();

    try {
      const page = await this.api.listPosts({
        search: this.query.trim() || undefined,
        limit: 50,
      });
      if (requestId !== this.requestId) return;
      this.render(page.items, page.total);
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.statusEl.setText(`加载失败：${describeApiError(error)}`);
    }
  }

  private render(items: AdminPostListItem[], total: number): void {
    if (items.length === 0) {
      this.statusEl.setText("没找到文章。");
      return;
    }

    this.statusEl.setText(
      total > items.length
        ? `共 ${total} 篇，先显示最近 ${items.length} 篇。输入关键词继续筛。`
        : `共 ${total} 篇`,
    );

    for (const post of items) {
      this.renderItem(post);
    }
  }

  private renderItem(post: AdminPostListItem): void {
    const row = this.listEl.createDiv({ cls: "fsb-pull-item" });
    row.tabIndex = 0;

    const titleRow = row.createDiv({ cls: "fsb-pull-title-row" });
    titleRow.createDiv({ text: post.title, cls: "fsb-pull-title" });
    if (this.isLocal(post.id)) {
      titleRow.createSpan({ text: "已拉取", cls: "fsb-pull-badge" });
    }

    const state = post.hasUnpublishedChanges
      ? "已发布（有改动）"
      : post.status === "published"
        ? "已发布"
        : "草稿";
    const slug = post.publicSlug ?? post.slug;
    const date = formatBeijingTime(post.updatedAt);
    const taxonomy = [
      post.category?.name,
      post.tags.map((tag) => tag.name).join("、"),
    ]
      .filter(Boolean)
      .join(" · ");

    row.createDiv({
      text: `${state} · /${slug} · ${date}${taxonomy ? ` · ${taxonomy}` : ""}`,
      cls: "fsb-pull-meta",
    });

    row.addEventListener("click", () => this.choose(post));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.choose(post);
      }
    });
  }

  private choose(post: AdminPostListItem): void {
    this.close();
    this.onChoose(post);
  }
}
