import { ButtonComponent, Modal, type App } from "obsidian";
import type { PublishMode } from "./publish";
import { formatBeijingTime } from "./time";

export interface PublishConfirmation {
  mode: PublishMode;
  title: string;
  path: string;
  category: string;
  tags: string[];
  publishedAt?: string;
  postId?: number;
}

export function confirmPublish(
  app: App,
  details: PublishConfirmation,
): Promise<boolean> {
  return new Promise((resolve) => {
    new PublishConfirmModal(app, details, resolve).open();
  });
}

class PublishConfirmModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly details: PublishConfirmation,
    private readonly resolve: (value: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const publishing = this.details.mode === "publish";
    this.modalEl.addClass("fsb-confirm-modal");
    this.titleEl.setText(publishing ? "确认发布" : "确认保存草稿");
    this.contentEl.createEl("p", {
      text: publishing
        ? "发布后文章会公开到博客。"
        : "只保存到博客草稿，不会公开。",
      cls: "fsb-confirm-hint",
    });

    const list = this.contentEl.createDiv({ cls: "fsb-confirm-list" });
    this.row(list, "标题", this.details.title);
    this.row(list, "分类", this.details.category || "不设置");
    this.row(
      list,
      "标签",
      this.details.tags.length > 0 ? this.details.tags.join("、") : "无",
    );
    this.row(
      list,
      "发布时间",
      this.details.publishedAt
        ? formatBeijingTime(this.details.publishedAt)
        : "未设置，发布时自动填",
    );
    this.row(
      list,
      "云端文章",
      this.details.postId
        ? `#${this.details.postId}，会更新已有文章`
        : publishing
          ? "首次发布，会按标题查重"
          : "首次保存，会按标题查重",
    );
    this.row(list, "本地文件", this.details.path);

    const time = this.details.publishedAt
      ? new Date(this.details.publishedAt).getTime()
      : Number.NaN;
    if (Number.isFinite(time) && time > Date.now()) {
      this.contentEl.createEl("p", {
        text: "发布时间晚于现在，发布会被博客拒绝。",
        cls: "fsb-confirm-warning",
      });
    }

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText(publishing ? "发布" : "保存草稿")
      .setCta()
      .onClick(() => this.finish(true));
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.finish(false));
  }

  onClose(): void {
    if (!this.settled) this.resolve(false);
    this.contentEl.empty();
  }

  private finish(value: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.close();
    this.resolve(value);
  }

  private row(parent: HTMLElement, label: string, value: string): void {
    const row = parent.createDiv({ cls: "fsb-confirm-row" });
    row.createEl("span", { text: label, cls: "fsb-confirm-label" });
    row.createEl("span", { text: value, cls: "fsb-confirm-value" });
  }
}
