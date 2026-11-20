import { Notice, Plugin, type TFile } from "obsidian";
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

  async onload(): Promise<void> {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    this.addSettingTab(new PublisherSettingTab(this.app, this));

    this.addCommand({
      id: "test-connection",
      name: "测试博客连接",
      callback: async () => {
        try {
          const api = this.createApi();
          if (!api.isConfigured) {
            new Notice("请先在设置中填写 Admin API Key。");
            return;
          }
          const page = await api.listPosts({ limit: 1 });
          new Notice(`连接成功，博客共有 ${page.total} 篇文章。`);
        } catch (error) {
          new Notice(`连接失败：${describeApiError(error)}`, 8000);
        }
      },
    });

    this.addCommand({
      id: "publish-current-note",
      name: "发布当前笔记到博客",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) {
          void this.runPublish(
            file,
            this.settings.publishByDefault ? "publish" : "draft",
          );
        }
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

  private async runPublish(file: TFile, mode: PublishMode): Promise<void> {
    const api = this.createApi();
    if (!api.isConfigured) {
      new Notice("请先在插件设置中填写 Admin API Key。");
      return;
    }

    new Notice(mode === "publish" ? "正在发布到博客…" : "正在保存草稿…");

    try {
      const outcome = await publishNote(
        { app: this.app, api, settings: this.settings },
        file,
        mode,
      );

      if (!outcome) {
        new Notice("已取消发布。");
        return;
      }

      if (outcome.published && outcome.postUrl) {
        new Notice(`已发布《${outcome.title}》\n${outcome.postUrl}`, 8000);
        if (this.settings.openAfterPublish) {
          window.open(outcome.postUrl, "_blank");
        }
      } else if (outcome.created) {
        new Notice(`已创建草稿《${outcome.title}》，可到博客后台发布。`);
      } else {
        new Notice(`已更新草稿《${outcome.title}》。`);
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
    const api = this.createApi();
    if (!api.isConfigured) {
      new Notice("请先在插件设置中填写 Admin API Key。");
      return;
    }

    try {
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      const storedUrl = stringValue(note.frontmatter.fsb_url);
      if (storedUrl) {
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
    if (!this.settings.siteUrl || !this.settings.apiKey) {
      this.statusBarEl.setText("FSB 未配置");
      this.statusBarEl.title = "打开插件设置填写博客地址和 API Key";
      return;
    }
    try {
      const origin = normalizeSiteUrl(this.settings.siteUrl);
      this.statusBarEl.setText(`FSB · ${origin.replace(/^https?:\/\//, "")}`);
      this.statusBarEl.title = "Flare Stack Blog Publisher 已配置";
    } catch {
      this.statusBarEl.setText("FSB 地址无效");
      this.statusBarEl.title = "请检查插件设置中的博客地址";
    }
  }
}
