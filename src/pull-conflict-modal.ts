import { ButtonComponent, Modal, type App } from "obsidian";

export class PullConflictModal extends Modal {
  constructor(
    app: App,
    private readonly postTitle: string,
    private readonly onOpenLocal: () => void,
    private readonly onOverwrite: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("文章已在本地");
    this.contentEl.createEl("p", {
      text: `《${this.postTitle}》已经拉取过。`,
    });
    this.contentEl.createEl("p", {
      text: "用云端内容覆盖会丢失本地尚未发布的修改。",
      cls: "mod-warning",
    });

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText("打开本地版本")
      .setCta()
      .onClick(() => {
        this.close();
        this.onOpenLocal();
      });
    new ButtonComponent(actions)
      .setButtonText("用云端覆盖")
      .setWarning()
      .onClick(() => {
        this.close();
        this.onOverwrite();
      });
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
