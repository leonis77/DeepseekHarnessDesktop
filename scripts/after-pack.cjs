/**
 * electron-builder afterPack 钩子：把 vendor/dsh 压成单个 dsh.tar.gz 放进 resources。
 * 用单文件替代 1.2w 个小文件，大幅加快安装/便携版解压速度。
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  const projectDir = path.join(__dirname, "..");
  const src = path.join(projectDir, "vendor", "dsh");
  const dst = path.join(context.appOutDir, "resources", "dsh.tar.gz");

  if (!fs.existsSync(path.join(src, "lib", "bin.js"))) {
    console.log("afterPack: vendor/dsh 不存在，跳过自包含（需先 npm run vendor）");
    return;
  }

  fs.rmSync(dst, { force: true });

  // 缓存归档：vendor/dsh 未变时直接复用，避免每次打包都重压 ~170MB（约 10 分钟）
  const cache = path.join(projectDir, "vendor", "dsh.tar.gz");
  if (fs.existsSync(cache)) {
    fs.copyFileSync(cache, dst);
    const mb = (fs.statSync(dst).size / 1048576).toFixed(1);
    console.log(`afterPack: 复用缓存归档 → resources/dsh.tar.gz（${mb} MB）`);
    return;
  }

  // bsdtar（Win10+ 自带 tar.exe）压缩为 gzip tar
  execSync(`tar -czf "${dst}" -C "${path.dirname(src)}" "dsh"`, { stdio: "ignore" });
  fs.copyFileSync(dst, cache);
  const mb = (fs.statSync(dst).size / 1048576).toFixed(1);
  console.log(`afterPack: 已压缩 dsh → resources/dsh.tar.gz（${mb} MB，已缓存）`);
};
