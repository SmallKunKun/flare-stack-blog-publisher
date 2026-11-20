#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "flare-stack-blog-publisher";
const FILES = ["main.js", "manifest.json", "styles.css"];
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const args = process.argv.slice(2);
const link = args.includes("--link");
const explicitVault = args.find((arg) => !arg.startsWith("--"));

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const vault = path.resolve(
    expandHome(explicitVault ?? (await chooseVault())),
  );

  if (!fs.existsSync(path.join(vault, ".obsidian"))) {
    fail(
      `${vault} 看起来不是 Obsidian vault。\n` +
        "请先在 Obsidian 中打开一次这个文件夹，或传入正确的 vault 路径。",
    );
  }

  console.log("构建插件…");
  execFileSync(npmCommand(), ["run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_update_notifier: "false",
      npm_config_fund: "false",
      npm_config_audit: "false",
    },
  });

  const pluginDir = path.join(
    vault,
    ".obsidian",
    "plugins",
    PLUGIN_ID,
  );
  fs.mkdirSync(pluginDir, { recursive: true });

  if (link) {
    installLinks(pluginDir);
  } else {
    installCopies(pluginDir);
  }

  printNextSteps(pluginDir, link);
}

function installLinks(pluginDir) {
  let copied = false;

  for (const file of FILES) {
    const source = path.join(repoRoot, file);
    const target = path.join(pluginDir, file);
    if (isSymlinkTo(target, source)) continue;

    fs.rmSync(target, { force: true });
    try {
      fs.symlinkSync(source, target, "file");
    } catch {
      // Windows may refuse file symlinks without extra privileges.
      fs.copyFileSync(source, target);
      copied = true;
    }
  }

  if (copied) {
    console.log(
      `已安装到：${pluginDir}（部分文件不支持符号链接，已改为复制）`,
    );
    console.log("修改代码后需要重新运行本命令。");
  } else {
    console.log(`已建立文件符号链接：${pluginDir}`);
    console.log("三个插件文件指向仓库；data.json 仍保存在 vault 中。");
    console.log("运行 npm run dev，修改代码后重新加载 Obsidian 即可。");
  }
}

function installCopies(pluginDir) {
  for (const file of FILES) {
    fs.copyFileSync(path.join(repoRoot, file), path.join(pluginDir, file));
  }
  console.log(`已复制插件文件到：${pluginDir}`);
}

function printNextSteps(pluginDir, linked) {
  console.log("\n下一步：");
  console.log("1. 重启 Obsidian，或在命令面板执行「重新加载应用」。");
  console.log("2. 设置 → 第三方插件 → 关闭安全模式 → 启用 Flare Stack Blog Publisher。");
  console.log("3. 在插件设置中填写博客地址和 Admin API Key。");
  if (!linked) {
    console.log("\n以后更新插件时，重新运行本命令即可。");
  }
  console.log(`\n安装位置：${pluginDir}`);
}

function printUsage() {
  console.log(`用法：
  npm run install:plugin
  npm run install:plugin -- /path/to/MyVault

  npm run link:plugin
  npm run link:plugin -- /path/to/MyVault

说明：
  不传 vault 路径时，会自动读取 Obsidian 配置并查找 vault。
  --link  只链接三个插件文件，data.json 保留在 vault 中。`);
}

function isSymlinkTo(target, source) {
  try {
    return path.resolve(path.dirname(target), fs.readlinkSync(target)) === source;
  } catch {
    return false;
  }
}

function chooseVault() {
  const vaults = detectVaults();
  if (vaults.length === 1) return vaults[0];

  if (vaults.length === 0) {
    fail(
      "没有自动找到 Obsidian vault。\n" +
        "请传入 vault 路径，例如：\n" +
        "  npm run install:plugin -- /path/to/MyVault",
    );
  }

  return pickVault(vaults);
}

async function pickVault(vaults) {
  console.log("找到多个 vault：");
  vaults.forEach((vault, index) => {
    console.log(`  ${index + 1}. ${vault}`);
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(
      `选择要安装到的 vault（1-${vaults.length}）：`,
    );
    const index = Number(answer.trim()) - 1;
    if (!Number.isInteger(index) || !vaults[index]) {
      fail("没有选择有效的 vault。");
    }
    return vaults[index];
  } finally {
    rl.close();
  }
}

function detectVaults() {
  const config = obsidianConfigPath();
  if (!config || !fs.existsSync(config)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(config, "utf8"));
    const vaults = data.vaults ?? {};
    const found = [];
    for (const entry of Object.values(vaults)) {
      if (!entry || typeof entry !== "object") continue;
      const raw = entry.path;
      if (typeof raw !== "string") continue;
      const vault = decodePath(raw);
      if (fs.existsSync(vault) && fs.existsSync(path.join(vault, ".obsidian"))) {
        found.push(vault);
      }
    }
    return [...new Set(found)];
  } catch {
    return [];
  }
}

function obsidianConfigPath() {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "obsidian",
      "obsidian.json",
    );
  }
  if (process.platform === "win32") {
    return process.env.APPDATA
      ? path.join(process.env.APPDATA, "obsidian", "obsidian.json")
      : null;
  }
  return path.join(os.homedir(), ".config", "obsidian", "obsidian.json");
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
