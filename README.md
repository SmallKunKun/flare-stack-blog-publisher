# Flare Stack Blog Publisher for Obsidian

在 [Obsidian](https://obsidian.md) 里写 Markdown，一键发布到
[Flare Stack Blog](https://github.com/du2333/flare-stack-blog)。

插件只通过博客的 Admin API 通信，不修改博客源码，也不依赖博客的部署方式。

> 这不是 Flare Stack Blog 官方插件，而是一个独立的社区项目。
>
> 仓库中不包含任何站点地址、API Key 或账号信息。所有连接信息只保存在你本机的
> Obsidian 配置里。

## 功能

- 发布当前笔记，或只保存为博客草稿
- 按标题匹配博客中已存在的文章，避免重复创建；可以手动选择要更新的文章
- 把 `fsb_post_id` / `fsb_url` 写回 frontmatter，之后一键更新同一篇
- 同步 frontmatter 中的分类和标签，缺失时自动创建
- 自动上传笔记引用的本地图片到博客媒体库，并替换为博客地址
- 可选把上传的图片命名为 UUID（如 `3c9a1f7e-5b2d-4a8c-9e6f-1d4b7a2c8e90.png`），只改云端名称
- 自动上传 frontmatter 中指定的本地封面图
- 把 `[[双链]]` 转换成指向已发布文章的链接
- 发布后可直接在浏览器打开文章
- 修改过期的 `saveToken` 时自动重读并重试一次，尽量避免编辑冲突

## 安装

需要 Node.js 20 或更高版本。

### 方式一：一键安装到本机 vault（推荐）

```bash
git clone <this-repository>
cd obsidian-flare-stack-blog
npm install

# 自动查找 vault；找到多个时会提示选择
npm run install:plugin

# 也可以直接指定 vault
npm run install:plugin -- /path/to/MyVault
```

开发或经常改代码时，用符号链接模式：

```bash
npm run link:plugin
```

它只把 `main.js`、`manifest.json`、`styles.css` 三个文件链接到仓库，
`data.json` 仍留在 vault 里。配合 `npm run dev`，改完代码后在 Obsidian
执行「重新加载应用」即可。Windows 不支持文件符号链接时会自动改为复制。

安装完成后：

1. 重启 Obsidian，或在命令面板执行「重新加载应用」。
2. 设置 → 第三方插件 → 关闭安全模式 → 启用 **Flare Stack Blog Publisher**。

### 方式二：BRAT（GitHub 发布后，自动更新）

适合把仓库推到 GitHub 后使用，之后更新不用再手动复制文件。

1. 推送仓库并打一个版本 tag：

   ```bash
   git tag 0.1.0
   git push origin 0.1.0
   ```

   GitHub Actions 会构建并创建 Release，附上 `main.js`、`manifest.json`、
   `styles.css` 和安装包 zip。

2. 在 Obsidian 的社区插件中安装 **BRAT**。
3. 打开 BRAT → **Add Beta Plugin**。
4. 输入仓库地址，例如：

   ```text
   你的GitHub用户名/obsidian-flare-stack-blog
   ```

5. 启用 **Flare Stack Blog Publisher**。

仓库必须是公开的。以后发布新版本时，BRAT 会检查并自动更新。

> 长期最方便的方式是提交到 Obsidian 官方社区插件目录，但需要经过审核。

### 方式三：手动安装

1. 下载 Release 中的 `flare-stack-blog-publisher.zip` 并解压，或自行构建
   `main.js`、`manifest.json`、`styles.css`。
2. 把三个文件放进：

   ```text
   <vault>/.obsidian/plugins/flare-stack-blog-publisher/
   ```

3. 重启 Obsidian，在「设置 → 第三方插件」中启用插件。

### 从源码构建

```bash
npm install
npm run build
```

构建产物是仓库根目录的 `main.js`。

## 配置

打开「设置 → Flare Stack Blog Publisher」，填写：

| 设置 | 说明 |
| --- | --- |
| 博客地址 | 站点根地址，例如 `https://blog.example.com`，不要带 `/api` |
| Admin API Key | 在博客后台「设置 → API Key」生成，只显示一次 |
| 默认分类 | 笔记没有 `category` 时用于新建文章 |
| 默认标签 | 笔记没有 `tags` 时用于新建文章，逗号分隔 |
| 自动创建分类和标签 | 关闭后只使用博客中已有的分类和标签 |
| 默认直接发布 | 关闭后「发布当前笔记」只保存草稿 |
| 上传本地图片 | 发布时上传正文和封面中的本地图片 |
| UUID 文件名 | 上传时使用 UUID 作为云端文件名；只改云端名称，不改本地文件 |
| 转换双链 | 把 `[[笔记]]` 转换成博客链接 |
| 发布后打开网页 | 发布成功后用浏览器打开文章 |

填好后可以执行命令「测试博客连接」确认地址和 Key 是否正确。

> API Key 相当于博客管理员权限，请只在自己的设备上使用，不要提交到任何仓库。
> 插件把它保存在 Obsidian 的插件数据文件 `data.json` 中，该文件已被
> `.gitignore` 排除。

## 使用

在 Obsidian 命令面板中搜索：

| 命令 | 作用 |
| --- | --- |
| 发布当前笔记到博客 | 新建或更新文章，并按设置发布 |
| 保存当前笔记为博客草稿 | 只写入草稿，不公开 |
| 打开当前笔记对应的博客文章 | 打开 frontmatter 中记录的公开地址 |
| 测试博客连接 | 用当前配置读取一次文章列表 |

第一次发布时，如果博客中存在**标题完全相同**的文章，插件会弹出选择框，让你决定
更新已有文章还是新建一篇。选择后会把文章 id 写回 frontmatter，之后不会再询问。

## Frontmatter

插件读取以下字段，全部可选：

```yaml
---
title: 文章标题
summary: 列表页和搜索结果里显示的摘要
slug: custom-url-slug
tags:
  - Obsidian
  - 博客
category: 随笔
cover: attachments/cover.png
---
```

| 字段 | 说明 |
| --- | --- |
| `title` | 文章标题；不填时使用文件名 |
| `summary` / `description` | 摘要 |
| `slug` | 文章 URL，例如 `/post/<slug>`；不填时由博客生成 |
| `tags` / `tag` | 标签，支持 YAML 数组或逗号分隔字符串 |
| `category` / `categories` | 分类；`categories` 取第一项 |
| `cover` / `cover_image` / `image` | 封面图，支持本地图片路径或 `![[图片]]` |

发布成功后，插件会写入：

```yaml
fsb_post_id: 123
fsb_url: https://blog.example.com/post/example
fsb_updated_at: 2026-01-01T00:00:00.000Z
```

不要手动修改 `fsb_post_id`，否则可能更新到另一篇文章。如果文章在博客后台被删除，
需要删除该字段后重新发布。

分类和标签的处理规则：

- 笔记里写了 `tags`，就同步为这些标签；写成空数组会清空标签。
- 笔记里没有 `tags`，更新文章时保留博客上的原标签；新建文章时使用默认标签。
- 分类同理：写了 `category` 就同步，留空会清空分类。
- 「自动创建分类和标签」关闭时，缺失的分类或标签会被跳过并提示。

## 图片

- 支持 `![[image.png]]`、`![[image.png|alt]]` 和标准 Markdown
  `![alt](attachments/image.png)`。
- 只上传 png、jpg/jpeg、webp、gif、svg，单张不超过 10 MB。
- 图片会先进入博客媒体库，正文中替换为 `/images/...` 地址。
- 打开「UUID 文件名」后，云端文件名为
  `3c9a1f7e-5b2d-4a8c-9e6f-1d4b7a2c8e90.png` 这种形式：
  - 只改变上传到云端的文件名，本地图片和笔记里的引用不会被重命名。
  - 名称由图片内容决定，同一张图片重复发布会复用同一个云端文件。
  - 之前以原文件名上传过的图片，首次启用后会再上传一份 UUID 名称的副本；
    不需要的旧文件可以在媒体库中清理。
- 重复发布时会复用媒体库中同名且大小相同的图片，不会重复上传。
- 图片上传失败会中止本次发布，避免把本地路径发给服务端后收到 400。
- 关闭「上传本地图片」后，正文里的本地图片路径会被服务端拒绝；请改用网络地址或 `/images/...` 地址。
- 网络图片和已经是 `/images/...` 的地址不会被重复上传。
- 封面只支持本地图片；网络封面暂不支持，会保留原封面并提示。
- 代码块和行内代码中的图片语法不会被处理。

## 双链

- `[[笔记]]` → 指向该笔记已发布文章的链接。
- `[[笔记|别名]]` → 使用别名作为链接文字。
- `[[笔记#标题]]` → 链接到文章中的对应标题锚点。
- 目标笔记没有发布时，转换成纯文本并提示，避免博客正文里出现原始双链。
- `![[笔记]]` 这类笔记嵌入不会被转换。
- 代码块和行内代码中的双链不会被处理。

## 已知限制

- Flare Stack Blog 会把正文中的 H1 整体下移一级，建议正文标题从 H2 开始。
- 服务端的 Markdown 解析不支持脚注、任务列表和原始 HTML，这些内容会变成纯文本。
- frontmatter 不会进入正文；它只用于插件读取元数据。
- 修改已发布文章的 `slug` 会改变公开 URL，旧地址不会自动重定向。
- 如果另外部署了静态镜像（例如 Astro 版本），发布后仍需要重新构建镜像站点。
- 本插件只发布文章，不处理动态、评论、友链和站点设置。

## 隐私与安全

- 仓库、构建产物和示例中不包含任何真实站点或 API Key。
- 插件只向你在设置中填写的站点发送请求，不连接第三方服务。
- API Key 仅通过 `x-api-key` 请求头发送。
- 请求会带浏览器 User-Agent，以通过博客可能启用的 Cloudflare WAF。
- 请使用站点的最终地址（推荐 https），不要填写会跳转到其他域名的短链接。
- 从 frontmatter 读取的 `fsb_url` 只有 `http` / `https` 地址才会被打开。
- 不要把 `data.json`、`.env` 或个人截图提交到仓库。

如果 API Key 泄露，请立即到博客后台撤销并重新生成。

## 开发

```bash
npm install
npm run dev     # 监听并生成 main.js
npm run check   # 仅 TypeScript 类型检查
npm run build   # 类型检查 + 生产构建
```

项目结构：

```text
src/
  api/          博客 HTTP API 客户端与类型
  main.ts       插件入口、命令、状态栏
  settings.ts   设置页
  note.ts       frontmatter 与元数据解析
  publish.ts    发布流程
  media.ts      本地图片上传
  links.ts      双链转换
  taxonomy.ts   分类与标签解析
scripts/
  install.mjs   一键安装到 vault
```

发布新版本：

1. 更新 `package.json`、`manifest.json` 和 `versions.json` 中的版本号。
2. 提交并打 tag，例如 `git tag 0.1.0 && git push --tags`。
3. GitHub Actions 会构建并创建 Release，附上 `main.js`、`manifest.json` 和
   `styles.css`。

## License

[MIT](LICENSE)
