/**
 * 把 plugins.json 里声明的 npm 插件 + src/dsh-plugins 里的本地插件装进 vendor/dsh，
 * 使其进入 dsh 依赖闭包，运行时由 healProfilesModuleFallback 自动 symlink 到 profiles/node_modules。
 * 本地插件不走 registry：先 npm install 装 npm 插件，再把本地插件拷进 node_modules 并补进 dependencies。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "plugins.json"), "utf8"));
const dshDir = path.join(__dirname, "..", "vendor", "dsh");
const pkgPath = path.join(dshDir, "package.json");
const localPluginsDir = path.join(__dirname, "..", "src", "dsh-plugins");

// 收集本地插件（目录名 = 包名）
const localPlugins = [];
if (fs.existsSync(localPluginsDir)) {
  for (const entry of fs.readdirSync(localPluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pj = path.join(localPluginsDir, entry.name, "package.json");
    if (fs.existsSync(pj)) localPlugins.push({ name: entry.name, version: JSON.parse(fs.readFileSync(pj, "utf8")).version || "0.1.0" });
  }
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.dependencies = pkg.dependencies || {};

// 1) 移除上次运行写入的本地插件条目，避免 npm install 去 registry 抓取
for (const lp of localPlugins) delete pkg.dependencies[lp.name];
// 2) 写入 npm 插件版本
for (const p of manifest.bundles) pkg.dependencies[p.name] = p.version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

// 3) npm install（只装 registry 插件）
const spec = manifest.bundles.map((p) => `${p.name}@${p.version}`).join(" ");
console.log(`安装 npm 插件到 vendor/dsh：${spec}`);
execSync(`npm install --save --no-audit --no-fund --loglevel=error`, { cwd: dshDir, stdio: "inherit" });

// 4) 拷贝本地插件进 node_modules，并补进 dependencies（供 healProfilesModuleFallback 闭包解析）
if (localPlugins.length > 0) {
  for (const lp of localPlugins) {
    const dstDir = path.join(dshDir, "node_modules", lp.name);
    fs.rmSync(dstDir, { recursive: true, force: true });
    fs.cpSync(path.join(localPluginsDir, lp.name), dstDir, { recursive: true });
    pkg.dependencies[lp.name] = lp.version;
    console.log(`已内置本地插件：${lp.name}@${lp.version}`);
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
}

// 5) 本地插件变化会让 vendor/dsh 变化，归档缓存必须失效（否则 afterPack 复用旧归档）
fs.rmSync(path.join(dshDir, "..", "dsh.tar.gz"), { force: true });
console.log(`已内置 ${manifest.bundles.length} 个 npm 插件 + ${localPlugins.length} 个本地插件`);
