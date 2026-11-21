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

    this.contentEl.createEl("p", { text: `文章标题：${this.postTitle}` });
    this.contentEl.createEl("p", {
      text: this.hasRemote
        ? "将删除云端文章和本地文件，云端删除不可恢复"
        : "云端不存在该文章，仅删除本地文件",
      cls: "mod-warning",
    });

    new Setting(this.contentEl)
      .setName("输入文章标题")
      .setDesc("需与标题完全一致")
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
