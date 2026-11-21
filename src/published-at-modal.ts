import {
  ButtonComponent,
  Modal,
  Setting,
  type App,
} from "obsidian";
import {
  beijingDateTimeLocalValue,
  beijingInputToIso,
  normalizePublishedAt,
} from "./time";

export class PublishedAtModal extends Modal {
  private value: string;

  constructor(
    app: App,
    current: string | undefined,
    private readonly onSubmit: (iso: string | undefined) => void,
  ) {
    super(app);
    const normalized = current ? normalizePublishedAt(current) : undefined;
    this.value = normalized
      ? beijingDateTimeLocalValue(new Date(normalized))
      : beijingDateTimeLocalValue();
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-new-post-modal");
    this.titleEl.setText("设置发布时间");

    new Setting(this.contentEl)
      .setName("发布时间")
      .setDesc("北京时间")
      .addText((text) => {
        text.inputEl.type = "datetime-local";
        text.setValue(this.value).onChange((value) => {
          this.value = value;
        });
      });

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText("保存")
      .setCta()
      .onClick(() => this.submit());
    new ButtonComponent(actions)
      .setButtonText("清除")
      .setWarning()
      .onClick(() => {
        this.close();
        this.onSubmit(undefined);
      });
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private submit(): void {
    const iso = beijingInputToIso(this.value);
    this.close();
    this.onSubmit(iso);
  }
}
