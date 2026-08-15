/**
 * electron-builder afterPack 钩子：把 vendor/dsh 整个（含 node_modules）拷进
 * 打包产物的 resources/dsh，实现自包含。extraResources 会排除 node_modules，
 * 所以这里直接用 Node 拷贝绕开过滤。
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  const projectDir = path.join(__dirname, "..");
  const src = path.join(projectDir, "vendor", "dsh");
  const dst = path.join(context.appOutDir, "resources", "dsh");

  if (!fs.existsSync(path.join(src, "lib", "bin.js"))) {
    console.log("afterPack: vendor/dsh 不存在，跳过自包含拷贝（需先 npm run vendor）");
    return;
  }

  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });

  try {
    execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS /NP`, { stdio: "ignore" });
    // robocopy 退出码 0-7 均为成功
  } catch (e) {
    if (e && e.status >= 8) throw e;
  }
  if (!fs.existsSync(path.join(dst, "lib", "bin.js"))) {
    fs.cpSync(src, dst, { recursive: true });
  }
  console.log("afterPack: 已拷贝 dsh → resources/dsh");
};
