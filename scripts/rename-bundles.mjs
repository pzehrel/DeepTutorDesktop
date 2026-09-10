/**
 * Rename Tauri bundle outputs to platform-explicit product names, one file
 * per platform (e.g. `..._aarch64.dmg` -> `..._macos-apple-silicon.dmg`).
 *
 * 将 Tauri 打包产物重命名为平台明确的产品命名, 每个平台只保留一份
 * (如 `..._aarch64.dmg` -> `..._macos-apple-silicon.dmg`), 与
 * `.github/workflows/build.yml` 的 CI 产物命名保持一致。
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

/** Tauri bundle format -> product file suffix. */
/** Tauri 打包格式 -> 产品文件后缀。 */
const formatMap = {
  dmg: name => name.replace(/_aarch64\.dmg$|_x64\.dmg$/, ext => ext.includes('aarch64') ? '_macos-apple-silicon.dmg' : '_macos-intel.dmg'),
  deb: name => name.replace(/_amd64\.deb$/, '_linux-x64.deb'),
  appimage: name => name.replace(/_amd64\.AppImage$/, '_linux-x64.AppImage'),
  nsis: name => name.replace(/_x64-setup\.exe$/, '_windows-x64_setup.exe'),
}

let renamed = 0
for (const [format, rewrite] of Object.entries(formatMap)) {
  const dir = join(bundleDir, format)
  if (!existsSync(dir)) {
    continue
  }
  for (const file of readdirSync(dir)) {
    const next = rewrite(file)
    if (next !== file && !next.includes('aarch64') && !next.includes('_x64-setup') && !next.includes('amd64')) {
      renameSync(join(dir, file), join(dir, next))
      console.log(`[rename-bundles] ${file} -> ${next}`)
      renamed += 1
    }
  }
}
console.log(`[rename-bundles] ${renamed} file(s) renamed for version ${version}`)
