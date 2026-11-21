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
    new PublishActionModal(app, details, false, (mode) => {
      resolve(mode === details.mode);
    }).open();
  });
}

export function choosePublishMode(
  app: App,
  details: PublishConfirmation,
): Promise<PublishMode | null> {
  return new Promise((resolve) => {
    new PublishActionModal(app, details, true, resolve).open();
  });
}

class PublishActionModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly details: PublishConfirmation,
    private readonly allowChoice: boolean,
    private readonly resolve: (mode: PublishMode | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const publishing = this.details.mode === "publish";
    this.modalEl.addClass("fsb-confirm-modal");

    if (this.allowChoice) {
      this.titleEl.setText("保存还是发布？");
      this.contentEl.createEl("p", {
        text: "保存草稿不会公开，发布后会直接上线",
        cls: "fsb-confirm-hint",
      });
    } else {
      this.titleEl.setText(publishing ? "确认发布" : "确认保存草稿");
      this.contentEl.createEl("p", {
        text: publishing
          ? "发布后文章会公开到博客"
          : "只保存到博客草稿，不会公开",
        cls: "fsb-confirm-hint",
      });
    }

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
      "日期",
      this.details.publishedAt
        ? formatBeijingTime(this.details.publishedAt)
        : "未设置，发布时自动填",
    );
    this.row(
      list,
      "云端文章",
      this.details.postId
        ? `#${this.details.postId}，会更新已有文章`
        : this.allowChoice
          ? "首次操作，会按标题查重"
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
        text: "日期晚于现在，发布会被博客拒绝",
        cls: "fsb-confirm-warning",
      });
    }

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    if (this.allowChoice) {
      new ButtonComponent(actions)
        .setButtonText("保存草稿")
        .onClick(() => this.finish("draft"));
      new ButtonComponent(actions)
        .setButtonText("发布文章")
        .setCta()
        .onClick(() => this.finish("publish"));
    } else {
      new ButtonComponent(actions)
        .setButtonText(publishing ? "发布" : "保存草稿")
        .setCta()
        .onClick(() => this.finish(this.details.mode));
    }
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.finish(null));
  }

  onClose(): void {
    if (!this.settled) this.resolve(null);
    this.contentEl.empty();
  }

  private finish(mode: PublishMode | null): void {
    if (this.settled) return;
    this.settled = true;
    this.close();
    this.resolve(mode);
  }

  private row(parent: HTMLElement, label: string, value: string): void {
    const row = parent.createDiv({ cls: "fsb-confirm-row" });
    row.createEl("span", { text: label, cls: "fsb-confirm-label" });
    row.createEl("span", { text: value, cls: "fsb-confirm-value" });
  }
}
