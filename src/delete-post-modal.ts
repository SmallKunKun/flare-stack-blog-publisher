import {
  ButtonComponent,
  Modal,
  Setting,
  type App,
} from "obsidian";

export class DeletePostModal extends Modal {
  private value = "";
  private deleteButton: ButtonComponent | null = null;

  constructor(
    app: App,
    private readonly postTitle: string,
    private readonly hasRemote: boolean,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-confirm-modal");
    this.titleEl.setText("删除文章");

    this.contentEl.createEl("p", { text: `文章：${this.postTitle}` });
    this.contentEl.createEl("p", {
      text: this.hasRemote
        ? "远端和本地都会删除，删除后不能恢复"
        : "云端没有这篇文章，只删除本地文件",
      cls: "mod-warning",
    });

    new Setting(this.contentEl)
      .setName("输入标题确认")
      .setDesc("要和文章标题完全一致")
      .addText((text) => {
        text.setPlaceholder(this.postTitle).onChange((value) => {
          this.value = value;
          this.updateButton();
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && this.value.trim() === this.postTitle) {
            event.preventDefault();
            this.confirm();
          }
        });
      });

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    this.deleteButton = new ButtonComponent(actions)
      .setButtonText("删除")
      .setWarning()
      .setDisabled(true)
      .onClick(() => this.confirm());
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private updateButton(): void {
    this.deleteButton?.setDisabled(this.value.trim() !== this.postTitle);
  }

  private confirm(): void {
    if (this.value.trim() !== this.postTitle) return;
    this.close();
    this.onConfirm();
  }
}
