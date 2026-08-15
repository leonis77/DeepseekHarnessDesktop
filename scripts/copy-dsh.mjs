/**
 * 把全局安装的 @deepseek-ai/dsh 整个复制进 vendor/dsh，
 * 供 electron-builder 的 extraResources 打进 exe（自包含分发）。
 * 已存在则跳过；加 --force 强制重拷。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes("--force");
const dst = path.join(__dirname, "..", "vendor", "dsh");

function resolveSrc() {
  // 1) 环境变量指向 bin.js → 包根是其上一级
  if (process.env.DSH_DESKTOP_DSH_BIN) {
    const pkg = path.join(path.dirname(process.env.DSH_DESKTOP_DSH_BIN), "..");
    if (fs.existsSync(path.join(pkg, "package.json"))) return path.resolve(pkg);
  }
  // 2) 已知全局安装位置
  const candidates = ["D:\\node\\node_modules\\@deepseek-ai\\dsh"];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "package.json"))) return c;
  }
  throw new Error("未找到 dsh 安装目录：请先 `npm i -g @deepseek-ai/dsh` 或设置 DSH_DESKTOP_DSH_BIN");
}

const src = resolveSrc();
const marker = path.join(dst, "lib", "bin.js");

if (!force && fs.existsSync(marker)) {
  console.log(`vendor/dsh 已存在，跳过（--force 强制重拷）。来源：${src}`);
  process.exit(0);
}

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dst), { recursive: true });

// Windows 用 robocopy（快、稳、处理 junction），失败回退 fs.cpSync
try {
  execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS /NP`, { stdio: "ignore" });
  // robocopy 退出码 0-7 均为成功（1=复制了文件）
} catch (e) {
  if (e && e.status >= 8) throw e;
}
if (!fs.existsSync(marker)) {
  fs.cpSync(src, dst, { recursive: true });
}
console.log(`已复制 dsh → vendor/dsh（来源：${src}）`);
