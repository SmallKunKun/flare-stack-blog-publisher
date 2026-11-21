import { FuzzySuggestModal, TFile, type App } from "obsidian";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
]);

export class ImagePickerModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onChoose: (file: TFile) => void,
  ) {
    super(app);
    this.setPlaceholder("搜索 vault 里的图片…");
  }

  getItems(): TFile[] {
    return this.app.vault
      .getFiles()
      .filter((file) =>
        IMAGE_EXTENSIONS.has(file.extension.toLocaleLowerCase()),
      )
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}
