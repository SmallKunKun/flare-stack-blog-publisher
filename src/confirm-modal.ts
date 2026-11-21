import { ButtonComponent, Modal, type App } from "obsidian";

export interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText?: string;
}

export function confirmAction(
  app: App,
  options: ConfirmActionOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmActionModal(app, options, resolve).open();
  });
}

class ConfirmActionModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly options: ConfirmActionOptions,
    private readonly resolve: (value: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-confirm-modal");
    this.titleEl.setText(this.options.title);
    this.contentEl.createEl("p", { text: this.options.message });

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText(this.options.confirmText ?? "确定")
      .setWarning()
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
}
