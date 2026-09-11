/**
 * Set the application version across every manifest that carries it.
 *
 * 将应用版本写入所有携带版本号的清单文件。
 *
 * A release is triggered by pushing a `v<version>` tag; this script is what
 * turns that tag into the version recorded in the repository, so no manual
 * edit is needed before tagging:
 *   - package.json / frontend/package.json  (npm package version)
 *   - src-tauri/tauri.conf.json             (Tauri product version)
 *   - src-tauri/Cargo.toml                  (Rust crate version)
 *   - src-tauri/Cargo.lock                  (locked entry for our own crate)
 * The embedded runtime's deeptutor pin is a separate dependency version and is
 * never touched here.
 *
 * 发布由推送 `v<version>` tag 触发; 本脚本把该 tag 转换为仓库中记录的
 * 版本, 因此打 tag 前无需手工修改文件:
 *   - package.json / frontend/package.json  (npm 包版本)
 *   - src-tauri/tauri.conf.json             (Tauri 产品版本)
 *   - src-tauri/Cargo.toml                  (Rust crate 版本)
 *   - src-tauri/Cargo.lock                  (本 crate 的锁定条目)
 * 内嵌 runtime 的 deeptutor 锁定版本属于依赖版本, 不在此处修改。
 *
 * Runs directly on Node >= 22.18 via built-in type stripping — no build step.
 *
 * 依赖 Node >= 22.18 内置的类型擦除直接运行, 无需构建步骤。
 *
 * Usage / 用法:
 *   node scripts/set-version.ts 0.0.2        # set 0.0.2 everywhere
 *   node scripts/set-version.ts v0.0.2       # the leading "v" is accepted
 *   node scripts/set-version.ts --check 0.0.2  # verify without writing
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/** Repository root, derived from this script's location. / 仓库根目录, 由脚本位置推导。 */
const root = join(import.meta.dirname, '..')

/** A single version rewrite: a file plus the exact text to replace. */
interface VersionEdit {
  file: string
  match: RegExp
  label: string
}

/**
 * Every place the app version is recorded, with the regex that captures its
 * current value. Each pattern must match exactly one occurrence so a silent
 * partial update is impossible.
 *
 * 应用版本的所有记录位置, 以及捕获当前值的正则。每个模式必须恰好匹配一处,
 * 以避免悄无声息的部分更新。
 */
const edits: VersionEdit[] = [
  { file: 'package.json', match: /("version"\s*:\s*)"[^"]*"/, label: 'package.json' },
  { file: 'frontend/package.json', match: /("version"\s*:\s*)"[^"]*"/, label: 'frontend/package.json' },
  { file: 'src-tauri/tauri.conf.json', match: /("version"\s*:\s*)"[^"]*"/, label: 'src-tauri/tauri.conf.json' },
  { file: 'src-tauri/Cargo.toml', match: /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]*"/m, label: 'src-tauri/Cargo.toml' },
  {
    file: 'src-tauri/Cargo.lock',
    match: /(\[\[package\]\]\nname = "deeptutor-desktop"\nversion = )"[^"]*"/,
    label: 'src-tauri/Cargo.lock',
  },
]

/**
 * Validate a version string: plain `x.y.z` with optional pre-release/build
 * metadata, as accepted by npm, Cargo and Tauri alike.
 *
 * 校验版本字符串: 形如 `x.y.z` 并可带预发布/构建元数据, npm、Cargo 与
 * Tauri 均接受该形式。
 */
function normalizeVersion(raw: string): string {
  const version = raw.startsWith('v') ? raw.slice(1) : raw
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`invalid version: ${raw} (expected e.g. 0.0.2 or v0.0.2)`)
  }
  return version
}

const args = process.argv.slice(2)
const checkOnly = args[0] === '--check'
const rawVersion = checkOnly ? args[1] : args[0]

if (!rawVersion) {
  console.error('usage: node scripts/set-version.ts [--check] <version>')
  process.exit(2)
}

const version = normalizeVersion(rawVersion)
const changed: string[] = []
const unchanged: string[] = []

for (const { file, match, label } of edits) {
  const path = join(root, file)
  const contents = readFileSync(path, 'utf8')
  const matches = contents.match(new RegExp(match.source, match.flags.includes('g') ? match.flags : `${match.flags}g`))
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}: expected exactly one version occurrence, found ${matches?.length ?? 0}`)
  }
  const next = contents.replace(match, `$1"${version}"`)
  if (next === contents) {
    unchanged.push(label)
    continue
  }
  if (!checkOnly) {
    writeFileSync(path, next)
  }
  changed.push(label)
}

console.log(`version ${version}: ${changed.length ? `updated ${changed.join(', ')}` : 'already up to date'}`)
if (unchanged.length) {
  console.log(`already at ${version}: ${unchanged.join(', ')}`)
}
if (checkOnly && changed.length) {
  process.exit(1)
}
