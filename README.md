# Flare Stack Blog Publisher for Obsidian

Publish notes from [Obsidian](https://obsidian.md) to a
[Flare Stack Blog](https://github.com/du2333/flare-stack-blog) through its
Admin API.

The plugin talks to your blog over HTTP. It does not bundle, modify or require
a copy of Flare Stack Blog.

> This repository contains no site address, API key or account data. Everything
> is configured locally in Obsidian and is never committed.

## Status

Early development. Build from source for now:

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/flare-stack-blog-publisher/`, then enable the plugin
in Obsidian.

## License

MIT. See [LICENSE](LICENSE).
