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
  // 2) 已知全局安装位置 + npm root -g（兼容 CI/其他机器）
  const candidates = ["D:\\node\\node_modules\\@deepseek-ai\\dsh"];
  try {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    candidates.push(path.join(root, "@deepseek-ai", "dsh"));
  } catch {
    /* ignore */
  }
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
// 减重：排除运行时用不到的文件（sourcemap / TS 源码 / 文档 / 测试），
// 文件数 3.3w → ~1.2w，体积 255MB → ~170MB，便携版解压提速约 3 倍。
const EXCLUDE_FILES = "*.map *.ts *.tsx *.mts *.cts *.md *.mdx *.log";
const EXCLUDE_DIRS = "test tests __tests__ __mocks__ examples docs .github benchmark benchmarks";
try {
  execSync(
    `robocopy "${src}" "${dst}" /E /XF ${EXCLUDE_FILES} /XD ${EXCLUDE_DIRS} /NFL /NDL /NJH /NJS /NP`,
    { stdio: "ignore" }
  );
  // robocopy 退出码 0-7 均为成功（1=复制了文件）
} catch (e) {
  if (e && e.status >= 8) throw e;
}
if (!fs.existsSync(marker)) {
  fs.cpSync(src, dst, { recursive: true });
}
const count = (() => {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else n++;
    }
  };
  walk(dst);
  return n;
})();
// vendor 重建后让归档缓存失效，afterPack 下次会重新压缩
fs.rmSync(path.join(__dirname, "..", "vendor", "dsh.tar.gz"), { force: true });
console.log(`已复制并减重 dsh → vendor/dsh（${count} 文件，来源：${src}）`);
