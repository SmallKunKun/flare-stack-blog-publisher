<div align="center">

# Flare Stack Blog Publisher

**An Obsidian plugin for publishing blog posts directly to Flare Stack Blog**

Publish & drafts · Cloud post sync · Media library · Chinese note properties

[![Obsidian](https://img.shields.io/badge/Obsidian-1.5.7%2B-7C3AED?logo=obsidian&logoColor=white&style=flat-square)](https://obsidian.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white&style=flat-square)](https://nodejs.org)
[![GitHub release](https://img.shields.io/github/v/release/SmallKunKun/flare-stack-blog-publisher?style=flat-square)](https://github.com/SmallKunKun/flare-stack-blog-publisher/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

[功能特性](#-功能特性) · [安装](#-安装) · [配置](#-配置) · [使用](#-使用) · [开发](#-本地开发)

</div>

---

## 📖 简介

Flare Stack Blog Publisher 通过 API Key 将 Obsidian 笔记发布到
[Flare Stack Blog](https://github.com/du2333/flare-stack-blog)。插件支持新建文章、发布与草稿、
取消发布、删除文章、拉取云端文章和媒体库管理，不修改博客代码，也不依赖博客的部署方式。

所有请求直接发送到用户在插件中配置的博客地址，不经过第三方服务。

> [!NOTE]
> 本项目是第三方插件，不是 Flare Stack Blog 官方项目。仓库中不包含站点地址、API Key
> 或账号信息，连接信息只保存在本机 Obsidian。

## ✨ 功能特性

**发布与文章状态**

- 发布当前笔记，或保存为云端草稿。
- 状态栏菜单、右键菜单和命令面板均可操作。
- 发布前显示文章属性、封面预览和新建/更新状态。
- 已发布文章支持取消发布，公开页面下线，草稿内容保留。
- 打开文章按钮仅在文章已发布且存在公开链接时可用。
- 删除文章时，云端存在则同时删除云端与本地；仅存在本地时只删除本地。
- 删除前必须输入完整文章标题，本地文件移入 Obsidian 回收站。

**内容与属性**

- 新建文章时生成完整 frontmatter，包括标题、封面、分类、标签、链接、日期和摘要。
- 分类为单选，标签支持多选。
- 分类和标签可从云端已有项中选择，也可直接输入新名称。
- 云端不存在的分类和标签可在发布时自动创建。
- 笔记属性使用中文名称，旧英文属性仍可读取，并在发布时自动转换。
- 首次发布按标题匹配已有文章，后续通过 `fsb_post_id` 更新同一篇。
- 从云端拉取文章到本地，每篇文章使用独立文件夹。
- `[[双链]]` 可转换为指向已发布文章的博客链接。

**媒体与图片**

- 媒体库支持查看云端图片、按文件名搜索和分页加载。
- 可从设备选择图片上传，上传后可直接插入当前笔记或复制链接。
- 正文中的本地图片会在发布时上传到博客媒体库，并替换为博客地址。
- 封面可从 vault 选择本地图片，也可从云端媒体库选择。
- 可选 UUID 文件名：上传时仅修改云端文件名，本地文件保持不变。
- 相同内容的图片复用同一个云端文件，避免重复上传。

**体验与兼容**

- 左侧栏、笔记右上角、状态栏和右键菜单均提供入口。
- 所有展示时间统一使用北京时间（UTC+8）。
- `fsb_` 内部属性默认在属性面板隐藏。
- 侧边栏与工具栏布局适配桌面端和移动端。
- 编辑冲突（HTTP 409）会自动重读并重试一次。

## 🧭 工作原理

```text
Obsidian note
  ├─ frontmatter
  └─ Markdown body
        │
        ▼
Flare Stack Blog Publisher
  ├─ /api/admin/posts
  ├─ /api/admin/media
  ├─ /api/admin/tags
  └─ /api/admin/categories
        │
        ▼
Flare Stack Blog
```

插件使用 API Key 通过 `x-api-key` 请求头访问博客 API，并在每个请求中携带浏览器
User-Agent，以兼容可能启用的 Cloudflare WAF。

## 🚀 安装

### 前置条件

| 依赖 | 要求 |
| :--- | :--- |
| Obsidian | 1.5.7 或更高版本 |
| Flare Stack Blog | 已部署并启用 Admin API |
| Node.js | 20 或更高版本，仅从源码构建时需要 |

### 方式一：BRAT（推荐）

1. 在 Obsidian 社区插件中安装 **BRAT**。
2. 打开 BRAT，点击 **Add Beta Plugin**。
3. 输入仓库地址：

   ```text
   SmallKunKun/flare-stack-blog-publisher
   ```

4. 启用 **Flare Stack Blog Publisher**。

仓库已公开，并包含 `0.1.0` Release。BRAT 会读取最新 Release 并在后续版本自动更新。

Release 页面：

```text
https://github.com/SmallKunKun/flare-stack-blog-publisher/releases
```

### 方式二：手动安装

从 Release 下载 `flare-stack-blog-publisher.zip`，解压到：

```text
<vault>/.obsidian/plugins/flare-stack-blog-publisher/
```

重启 Obsidian，在「设置 → 第三方插件」中启用 **Flare Stack Blog Publisher**。

### 方式三：从源码安装

```bash
git clone https://github.com/SmallKunKun/flare-stack-blog-publisher.git
cd flare-stack-blog-publisher
npm install

# 自动查找 vault；多个 vault 时会提示选择
npm run install:plugin

# 也可以直接指定
npm run install:plugin -- /path/to/MyVault
```

开发模式：

```bash
npm run link:plugin
npm run dev
```

符号链接模式只链接 `main.js`、`manifest.json`、`styles.css`，`data.json` 保留在 vault 中。
修改代码后，在 Obsidian 执行「重新加载应用」即可。Windows 不支持文件符号链接时会自动
改为复制。

## ⚙️ 配置

| 设置 | 说明 |
| :--- | :--- |
| 博客地址 | 例如 `https://blog.example.com`，不要带 `/api` |
| API Key | 在博客后台的 API Key 页面生成，只显示一次 |
| 拉取文章目录 | 拉取文章的存放目录，每篇文章独立文件夹 |
| 新建文章目录 | 新建文章的存放目录，每篇文章独立文件夹 |
| 自动填写发布时间 | 新建文章时填入当前北京时间 |
| 自动创建分类和标签 | 分类或标签不存在时自动创建 |
| 上传本地图片 | 发布时上传本地图片并替换为博客地址 |
| UUID 文件名 | 上传时使用 UUID 文件名，仅改云端名称 |
| 转换双链 | 将 `[[笔记]]` 转为博客链接，未发布时保留文字 |
| 发布后打开网页 | 发布后用浏览器打开文章 |
| 显示内部字段 | 在属性面板显示 `fsb_` 内部字段 |

完成后点击「测试连接」验证地址与 Key。

> [!IMPORTANT]
> API Key 具备管理员权限，请仅在个人设备使用，勿提交到仓库。插件将其保存在
> Obsidian 的 `data.json`，该文件已在 `.gitignore` 中。

## 🛠 使用

### 入口

| 位置 | 作用 |
| :--- | :--- |
| 左侧栏加号 | 新建文章 |
| 左侧栏下载 | 拉取云端文章 |
| 左侧栏图片 | 媒体库 |
| 左侧栏信息 | 文章信息 |
| 左侧栏上传 | 选择保存草稿或发布文章 |
| 笔记右上角上传 | 选择保存草稿或发布文章 |
| 笔记右上角信息 | 文章信息 |
| 笔记右上角图片 | 媒体库 |
| 底部状态栏 | 打开操作菜单 |
| 文件列表右键 | 发布文章、保存草稿、取消发布、打开文章、文章信息、删除文章 |
| 编辑器右键 | 发布文章、保存草稿、取消发布、打开文章、文章信息、删除文章 |

### 命令

| 命令 | 作用 |
| :--- | :--- |
| 发布当前笔记 | 新建或更新文章并发布 |
| 保存为草稿 | 仅写入云端草稿，不公开 |
| 取消发布 | 已发布文章转为草稿，公开页面下线 |
| 删除文章 | 云端存在则删除云端与本地，否则仅删除本地 |
| 打开博客文章 | 打开文章公开地址 |
| 拉取云端文章 | 打开云端文章列表 |
| 媒体库 | 查看云端图片、上传本地图片、插入或复制链接 |
| 新建博客文章 | 填写属性并创建本地草稿 |
| 文章信息 | 修改当前笔记的文章属性 |
| 属性改成中文 | 将旧英文属性转换为中文属性 |
| 测试连接 | 读取文章列表，验证配置 |

### 新建文章

新建文章窗口提供标题、封面、分类和标签、链接、日期和摘要。

- 标题必填，其余字段可选。
- 封面支持 vault 本地图片和云端媒体库图片，并显示预览。
- 分类为单选，标签为多选。
- 日期留空时，发布后由博客自动填入。
- 创建后自动打开笔记，可直接开始写作。

默认目录：

```text
FlareStackBlog/
└── Drafts/
    └── 文章标题/
        └── 文章标题.md
```

同名文件夹已存在时会自动追加 `-2`、`-3`。

### 文章信息

已有笔记可通过左侧栏、笔记右上角、状态栏菜单、右键菜单或命令打开「文章信息」。

可以修改：

- 标题
- 封面
- 分类和标签
- 链接
- 日期
- 摘要

保存后写回笔记属性。清除封面仅清除本地 `封面` 字段，不会删除云端封面。

分类和标签可从云端已有项中选择，也可删除云端项。删除会影响所有使用该项的文章，
分类或标签页面地址也会失效。

### 发布、取消发布与删除

- 左侧栏与笔记右上角的发布按钮会先选择「保存草稿」或「发布文章」。
- 发布前会显示文章属性、封面预览、摘要、分类、标签、链接、日期和本地文件。
- 状态栏菜单、右键菜单和命令中的「保存草稿」「发布文章」保持独立。
- 已发布且有公开链接的文章可取消发布，公开页面下线，文章转为草稿。
- 删除文章前必须输入完整文章标题，云端删除不可恢复，本地文件移入 Obsidian 回收站。

### 拉取云端文章

点击左侧栏下载图标，或从状态栏菜单选择「拉取文章」。

默认目录：

```text
FlareStackBlog/
└── hello-world/
    └── Hello World.md
```

- 每篇文章使用独立文件夹。
- 分类、标签、日期和封面会写入文章属性。
- 本地已存在同一篇时，可选择打开本地或使用云端覆盖。
- 正文中的 `/images/...` 和站内链接会转换为完整博客地址。
- 图片不会下载到本地，仍使用博客媒体库。

### 媒体库

媒体库支持文件名搜索、分页加载和瀑布流预览。

- 「上传本地图片」打开系统文件选择器，选择图片上传。
- UUID 文件名开启时，上传后的云端文件名使用 UUID；关闭时使用原文件名。
- 「插入」将完整图片地址插入当前笔记光标位置。
- 「复制链接」将完整图片地址复制到剪贴板。
- 未打开笔记时，「插入」自动改为复制链接。
- 支持的格式为 png、jpg、jpeg、webp、gif、svg。

### 图片与封面

- 正文支持 `![[image.png]]`、`![[image.png|alt]]` 和 `![alt](attachments/image.png)`。
- 单张图片最大 10 MB。
- 上传后正文会替换为 `/images/...` 地址。
- 网络图片和已有 `/images/...` 地址不会重复上传。
- 关闭「上传本地图片」后，正文中的本地路径会被服务端拒绝。
- 封面支持本地图片和云端媒体库图片，两处均可预览。
- 从云端拉取的文章会保留原封面地址。

### 双链

- `[[笔记]]` → 指向已发布文章的链接。
- `[[笔记|别名]]` → 使用别名作为链接文字。
- `[[笔记#标题]]` → 带标题锚点。
- 目标笔记未发布时，转换为纯文本。
- `![[笔记]]` 笔记嵌入不会转换。
- 代码块和行内代码中的双链不会处理。

## 📋 笔记属性

插件读取以下属性，均为可选：

```yaml
---
标题: 文章标题
封面: attachments/cover.png
分类: 随笔
标签:
  - Obsidian
  - 博客
链接: custom-url-slug
日期: 2026-11-21T14:30:00+08:00
摘要: 一段摘要
---
```

| 属性 | 说明 |
| :--- | :--- |
| `标题` / `title` | 不填时使用文件名 |
| `封面` / `cover` | 本地图片路径或云端封面地址 |
| `分类` / `category` | 分类，仅支持一个 |
| `标签` / `tags` / `tag` | 标签，支持多个 |
| `链接` / `slug` | 文章地址，例如 `/post/<slug>` |
| `日期` / `publishedAt` | 发布时间，采用北京时间 |
| `摘要` / `summary` / `description` | 文章摘要 |

新笔记和拉取的文章使用中文属性。旧英文属性仍可读取，并在发布或保存草稿时自动转换。
也可执行命令「属性改成中文」手动转换当前笔记。

发布后插件会写入：

```yaml
fsb_post_id: 123
fsb_url: https://blog.example.com/post/example
fsb_updated_at: 2026-01-01T00:00:00+08:00
fsb_cover_media_id: 45
```

这些 `fsb_` 字段默认在属性面板隐藏，仅插件内部使用。可在设置中打开「显示内部字段」查看。

## ⚠️ 注意事项

- Flare Stack Blog 会将正文 H1 降为 H2，建议正文标题从 H2 开始。
- 脚注、任务列表和原始 HTML 会转为纯文本。
- 修改已发布文章的「链接」会改变公开 URL，旧地址不会重定向。
- 发布时间不能晚于当前时间，否则发布会失败。
- 如果部署了静态镜像，发布后需要重新构建镜像站点。
- 插件仅管理文章，不处理动态、评论、友链和站点设置。
- 删除云端文章不可恢复；本地文件会进入 Obsidian 回收站。
- 删除分类或标签会影响所有使用该项的文章，请谨慎操作。

## 💻 本地开发

### 环境要求

- Node.js 20 或更高版本
- npm

### 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 监听并生成 `main.js` |
| `npm run build` | 类型检查并执行生产构建 |
| `npm run check` | 仅执行 TypeScript 类型检查 |
| `npm run install:plugin` | 构建并复制插件到 vault |
| `npm run link:plugin` | 构建并以符号链接安装 |

### 发布版本

1. 更新 `package.json`、`manifest.json` 和 `versions.json` 中的版本号。
2. 提交并创建标签：

   ```bash
   git tag 0.2.0
   git push origin 0.2.0
   ```

3. GitHub Actions 会构建并创建 Release。

## 📁 项目结构

```text
.
├── .github/workflows/          # CI 与 Release
├── scripts/
│   └── install.mjs             # 一键安装到 vault
├── src/
│   ├── api/                    # API Key 客户端与类型
│   ├── main.ts                 # 插件入口、命令、菜单
│   ├── settings.ts             # 设置页
│   ├── note.ts                 # frontmatter 解析
│   ├── properties.ts           # 中英文属性映射
│   ├── publish.ts              # 发布流程
│   ├── publish-confirm-modal.ts
│   ├── media.ts                # 图片上传
│   ├── media-library.ts        # 云端媒体库
│   ├── media-url.ts            # 媒体地址处理
│   ├── image-picker.ts         # 本地图片选择
│   ├── cover.ts                # 封面路径解析
│   ├── pull.ts                 # 云端文章拉取
│   ├── pull-modal.ts           # 云端文章选择
│   ├── pull-conflict-modal.ts  # 本地覆盖确认
│   ├── post-picker.ts          # 标题匹配选择
│   ├── links.ts                # 双链转换
│   ├── taxonomy.ts             # 分类与标签解析
│   ├── taxonomy-modal.ts       # 分类与标签选择
│   ├── create-post.ts          # 新文章属性模板
│   ├── new-post-modal.ts       # 新建/文章信息窗口
│   ├── delete-post-modal.ts    # 删除确认
│   ├── confirm-modal.ts        # 通用确认窗口
│   ├── time.ts                 # 北京时间格式化
│   ├── uuid.ts                 # UUID 文件名
│   └── vault-paths.ts          # vault 路径与文件名工具
├── esbuild.config.mjs
├── manifest.json
├── styles.css
├── LICENSE
└── package.json
```

## 🙏 致谢

- **[Flare Stack Blog](https://github.com/du2333/flare-stack-blog)**：博客后端、内容模型与 API。
- **[Obsidian](https://obsidian.md)**：插件运行环境与 API。

## 📄 许可

本项目采用 MIT License，详见 [LICENSE](./LICENSE)。
