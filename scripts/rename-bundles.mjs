/**
 * Rename Tauri bundle outputs to platform-explicit product names, one file
 * per platform (e.g. `DeepTutor Desktop_0.1.0_aarch64.dmg` ->
 * `DeepTutor-Desktop_0.1.0_macos-apple-silicon.dmg`).
 *
 * 将 Tauri 打包产物重命名为平台明确的产品命名, 每个平台只保留一份
 * (如 `DeepTutor Desktop_0.1.0_aarch64.dmg` ->
 * `DeepTutor-Desktop_0.1.0_macos-apple-silicon.dmg`), 与
 * `.github/workflows/build.yml` 的 CI 产物命名保持一致。文件名中的空格
 * 统一替换为连字符, 便于 shell 与 URL 使用。
 *
 * Runs automatically via the `postbuild` hook; safe to re-run (renames in
 * place, replaces any earlier product-named file from a previous run).
 *
 * 通过 `postbuild` 钩子自动执行; 可重复运行 (原地重命名, 覆盖上次运行
 * 留下的同名文件)。
 */
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

const bundleDir = join(root, 'src-tauri/target/release/bundle')

/** Product prefix used in installer filenames (hyphenated, no spaces). */
/** 安装包文件名使用的产品前缀 (连字符, 无空格)。 */
const productPrefix = 'DeepTutor-Desktop'

/**
 * Tauri names bundles `<productName>_<version>_<arch>.<ext>`; our productName
 * is "DeepTutor Desktop" (with a space). Normalize the base name and swap the
 * raw arch suffix for a platform label.
 *
 * Tauri 的产物名为 `<productName>_<version>_<arch>.<ext>`, 其中
 * productName 为 "DeepTutor Desktop" (含空格)。这里归一化基础名, 并把
 * 原始架构后缀替换为平台标签。
 */
const formatMap = {
  dmg: name => name.replace(/^.*_aarch64\.dmg$/, `${productPrefix}_${version}_macos-apple-silicon.dmg`)
    .replace(/^.*_x64\.dmg$/, `${productPrefix}_${version}_macos-intel.dmg`),
  deb: name => name.replace(/^.*_amd64\.deb$/, `${productPrefix}_${version}_linux-x64.deb`),
  appimage: name => name.replace(/^.*_amd64\.AppImage$/, `${productPrefix}_${version}_linux-x64.AppImage`),
  nsis: name => name.replace(/^.*_x64-setup\.exe$/, `${productPrefix}_${version}_windows-x64_setup.exe`)
    .replace(/^.*_x64\.exe$/, `${productPrefix}_${version}_windows-x64_setup.exe`),
}

/** Files we produced ourselves (already product-named) — never touch twice. */
/** 已经是产品命名的文件(本脚本产出)不做二次处理。 */
const isProductNamed = name => name.startsWith(`${productPrefix}_${version}_`)

let renamed = 0
for (const [format, rewrite] of Object.entries(formatMap)) {
  const dir = join(bundleDir, format)
  if (!existsSync(dir)) {
    continue
  }
  for (const file of readdirSync(dir)) {
    if (isProductNamed(file)) {
      continue
    }
    const next = rewrite(file)
    if (next !== file) {
      renameSync(join(dir, file), join(dir, next))
      console.log(`[rename-bundles] ${file} -> ${next}`)
      renamed += 1
    }
  }
}
console.log(`[rename-bundles] ${renamed} file(s) renamed for version ${version}`)
