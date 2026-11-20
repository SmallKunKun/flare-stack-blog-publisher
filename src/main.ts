import {
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { BlogApi, normalizeSiteUrl } from "./api/client";
import { describeApiError } from "./api/errors";
import { notePostId, parseNote, stringValue } from "./note";
import { postUrlOf, publishNote, type PublishMode } from "./publish";
import {
  DEFAULT_SETTINGS,
  PublisherSettingTab,
  type PublisherSettings,
} from "./settings";

export default class FlareStackBlogPublisher extends Plugin {
  settings: PublisherSettings = { ...DEFAULT_SETTINGS };
  private statusBarEl!: HTMLElement;
  private readonly viewActions = new Set<HTMLElement>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.register(() => {
      for (const action of this.viewActions) action.remove();
      this.viewActions.clear();
    });

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("fsb-status-bar");
    this.statusBarEl.addEventListener("click", (event) =>
      this.onStatusBarClick(event),
    );
    this.updateStatusBar();

    this.addSettingTab(new PublisherSettingTab(this.app, this));

    this.addRibbonIcon("upload", "发布当前笔记到博客", () => {
      this.publishActive("publish");
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.addPublishMenuItems(menu, file);
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, view) => {
        if (view instanceof MarkdownView && view.file) {
          this.addPublishMenuItems(menu, view.file);
        }
      }),
    );

    this.app.workspace.onLayoutReady(() => this.addViewActions());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.addViewActions()),
    );

    this.addCommand({
      id: "test-connection",
      name: "测试博客连接",
      callback: () => void this.testConnection(),
    });

    this.addCommand({
      id: "publish-current-note",
      name: "发布当前笔记到博客",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.runPublish(file, "publish");
        return true;
      },
    });

    this.addCommand({
      id: "save-current-note-draft",
      name: "保存当前笔记为博客草稿",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.runPublish(file, "draft");
        return true;
      },
    });

    this.addCommand({
      id: "open-current-post",
      name: "打开当前笔记对应的博客文章",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.openPost(file);
        return true;
      },
    });
  }

  private activeMarkdownFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return null;
    return file;
  }

  private publishActive(mode: PublishMode = "publish"): void {
    const file = this.activeMarkdownFile();
    if (!file) {
      new Notice("请先打开一篇 Markdown 笔记。");
      return;
    }
    void this.runPublish(file, mode);
  }

  private publishFile(file: TFile, mode: PublishMode = "publish"): void {
    void this.runPublish(file, mode);
  }

  private addViewActions(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      if (view.containerEl.querySelector(".fsb-publish-action")) continue;

      try {
        const action = view.addAction("upload", "发布到博客", () => {
          if (view.file) this.publishFile(view.file, "publish");
          else this.publishActive("publish");
        });
        action.addClass("fsb-publish-action");
        this.viewActions.add(action);
      } catch (error) {
        console.error("Flare Stack Blog: could not add view action", error);
      }
    }
  }

  private addPublishMenuItems(menu: Menu, file: TFile): void {
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("发布到博客")
        .setIcon("upload")
        .onClick(() => this.publishFile(file, "publish")),
    );
    menu.addItem((item) =>
      item
        .setTitle("保存为博客草稿")
        .setIcon("save")
        .onClick(() => this.publishFile(file, "draft")),
    );
    menu.addItem((item) =>
      item
        .setTitle("打开博客文章")
        .setIcon("external-link")
        .onClick(() => void this.openPost(file)),
    );
  }

  private onStatusBarClick(event: MouseEvent): void {
    if (!this.isConfigured()) {
      this.openPluginSettings();
      return;
    }

    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("发布当前笔记")
        .setIcon("upload")
        .onClick(() => this.publishActive("publish")),
    );
    menu.addItem((item) =>
      item
        .setTitle("保存为博客草稿")
        .setIcon("save")
        .onClick(() => this.publishActive("draft")),
    );
    menu.addItem((item) =>
      item
        .setTitle("打开博客文章")
        .setIcon("external-link")
        .onClick(() => {
          const file = this.activeMarkdownFile();
          if (!file) {
            new Notice("请先打开一篇 Markdown 笔记。");
            return;
          }
          void this.openPost(file);
        }),
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("测试博客连接")
        .setIcon("plug")
        .onClick(() => void this.testConnection()),
    );
    menu.addItem((item) =>
      item
        .setTitle("插件设置")
        .setIcon("settings")
        .onClick(() => this.openPluginSettings()),
    );
    menu.showAtMouseEvent(event);
  }

  private isConfigured(): boolean {
    return (
      this.settings.siteUrl.trim().length > 0 &&
      this.settings.apiKey.trim().length > 0
    );
  }

  private openPluginSettings(): void {
    const setting = (
      this.app as unknown as {
        setting?: {
          open?: () => void;
          openTabById?: (id: string) => void;
        };
      }
    ).setting;
    setting?.open?.();
    setting?.openTabById?.(this.manifest.id);
  }

  private async testConnection(): Promise<void> {
    try {
      if (!this.isConfigured()) {
        new Notice("请先在插件设置中填写博客地址和 Admin API Key。");
        this.openPluginSettings();
        return;
      }
      const api = this.createApi();
      const page = await api.listPosts({ limit: 1 });
      new Notice(`连接成功，博客共有 ${page.total} 篇文章。`);
    } catch (error) {
      new Notice(`连接失败：${describeApiError(error)}`, 8000);
    }
  }

  private async runPublish(file: TFile, mode: PublishMode): Promise<void> {
    if (!this.isConfigured()) {
      new Notice("请先在插件设置中填写博客地址和 Admin API Key。");
      this.openPluginSettings();
      return;
    }

    new Notice(mode === "publish" ? "正在发布到博客…" : "正在保存草稿…");

    try {
      const api = this.createApi();
      const outcome = await publishNote(
        { app: this.app, api, settings: this.settings },
        file,
        mode,
      );

      if (!outcome) {
        new Notice("已取消发布。");
        return;
      }

      if (outcome.published) {
        if (outcome.postUrl) {
          new Notice(`已发布《${outcome.title}》\n${outcome.postUrl}`, 8000);
          if (this.settings.openAfterPublish) {
            window.open(outcome.postUrl, "_blank");
          }
        } else {
          new Notice(`已发布《${outcome.title}》。`);
        }
      } else if (outcome.created) {
        new Notice(`已创建草稿《${outcome.title}》，可到博客后台发布。`);
      } else {
        new Notice(`已更新草稿《${outcome.title}》。`);
      }

      if (outcome.warnings.length > 0) {
        new Notice(outcome.warnings.join("\n"), 8000);
      }
    } catch (error) {
      console.error("Flare Stack Blog publish failed", error);
      new Notice(`发布失败：${describeApiError(error)}`, 10000);
    }
  }

  createApi(): BlogApi {
    return new BlogApi({
      siteUrl: this.settings.siteUrl,
      apiKey: this.settings.apiKey,
    });
  }

  private async openPost(file: TFile): Promise<void> {
    if (!this.isConfigured()) {
      new Notice("请先在插件设置中填写博客地址和 Admin API Key。");
      this.openPluginSettings();
      return;
    }

    try {
      const api = this.createApi();
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      const storedUrl = stringValue(note.frontmatter.fsb_url);
      if (storedUrl && isHttpUrl(storedUrl)) {
        window.open(storedUrl, "_blank");
        return;
      }

      const postId = notePostId(note.frontmatter);
      if (postId === undefined) {
        new Notice("这篇笔记还没有关联博客文章，请先发布一次。");
        return;
      }

      const post = await api.getPost(postId);
      const url = postUrlOf(api, post);
      if (!url) {
        new Notice("这篇文章还没有发布，暂时没有公开页面。");
        return;
      }
      window.open(url, "_blank");
    } catch (error) {
      console.error("Flare Stack Blog open post failed", error);
      new Notice(`打开失败：${describeApiError(error)}`, 8000);
    }
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<PublisherSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateStatusBar();
  }

  updateStatusBar(): void {
    if (!this.statusBarEl) return;
    if (!this.isConfigured()) {
      this.statusBarEl.setText("FSB 未配置");
      this.statusBarEl.title = "点击打开 Flare Stack Blog Publisher 设置";
      return;
    }
    try {
      const origin = normalizeSiteUrl(this.settings.siteUrl);
      this.statusBarEl.setText(`FSB · ${origin.replace(/^https?:\/\//, "")}`);
      this.statusBarEl.title = "点击打开发布菜单";
    } catch {
      this.statusBarEl.setText("FSB 地址无效");
      this.statusBarEl.title = "请检查插件设置中的博客地址";
    }
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
