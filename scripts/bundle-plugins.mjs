/**
 * 把 plugins.json 里声明的插件装进 vendor/dsh，使其进入 dsh 依赖闭包，
 * 运行时由 healProfilesModuleFallback 自动 symlink 到 profiles/node_modules。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "plugins.json"), "utf8"));
const dshDir = path.join(__dirname, "..", "vendor", "dsh");

const pkgPath = path.join(dshDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.dependencies = pkg.dependencies || {};
for (const p of manifest.bundles) pkg.dependencies[p.name] = p.version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

const spec = manifest.bundles.map((p) => `${p.name}@${p.version}`).join(" ");
console.log(`安装插件到 vendor/dsh：${spec}`);
execSync(`npm install --save --no-audit --no-fund --loglevel=error`, {
  cwd: dshDir,
  stdio: "inherit",
});
console.log(`已内置 ${manifest.bundles.length} 个插件`);
