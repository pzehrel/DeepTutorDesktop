/**
 * Generate and cut the bilingual changelog from Conventional Commits.
 *
 * 从 Conventional Commits 生成并落版双语更新日志。
 *
 * Commits carry both languages: an English Conventional Commits subject plus a
 * `zh-CN:` body line holding the Chinese subject (see .agents/rules/commits.md).
 * This script turns them into the `[Unreleased]` section of CHANGELOG.md and
 * CHANGELOG.zh-CN.md.
 *
 * 提交信息同时携带两种语言: 英文 Conventional Commits 主题加一行 `zh-CN:`
 * 正文携带中文主题(见 .agents/rules/commits.md)。本脚本将其转换为
 * CHANGELOG.md 与 CHANGELOG.zh-CN.md 的 `[Unreleased]` 小节。
 *
 * Runs directly on Node >= 22.18 via built-in type stripping — no build step.
 *
 * 依赖 Node >= 22.18 内置的类型擦除直接运行, 无需构建步骤。
 *
 * Usage / 用法:
 *   node scripts/update-changelog.ts                  # refresh [Unreleased]
 *   node scripts/update-changelog.ts --release 0.1.0  # cut a version section,
 *                                                     # start a fresh [Unreleased],
 *                                                     # print bilingual release notes
 *   node scripts/update-changelog.ts --notes          # print notes only, no writes
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/** One conventional commit parsed from git log. */
/** 从 git log 解析出的一条常规提交。 */
interface Commit {
  hash: string
  type: string
  scope: string
  breaking: boolean
  en: string
  zh: string
}

/** How one language's changelog renders groups and its empty placeholder. */
/** 单个语言的 changelog 的分组渲染方式与空占位符。 */
interface ChangelogSpec {
  file: string
  placeholder: string
  breaking: string
  /** [commit type, rendered group title] pairs, in display order. */
  /** [提交类型, 渲染后的分组标题] 对, 按展示顺序排列。 */
  groups: Array<[string, string]>
}

const root = new URL('..', import.meta.url).pathname

const changelogs: ChangelogSpec[] = [
  {
    file: 'CHANGELOG.md',
    placeholder: '- Nothing notable yet.',
    breaking: 'Breaking Changes',
    groups: [
      ['feat', 'Added'],
      ['refactor', 'Changed'],
      ['perf', 'Performance'],
      ['fix', 'Fixed'],
    ],
  },
  {
    file: 'CHANGELOG.zh-CN.md',
    placeholder: '- 暂无值得关注的变更。',
    breaking: '重大变更',
    groups: [
      ['feat', '新增'],
      ['refactor', '变更'],
      ['perf', '性能'],
      ['fix', '修复'],
    ],
  },
]

/** Subject shape: type(scope)!: text — scope and ! are optional. */
/** 主题形态: type(scope)!: 文本 —— scope 与 ! 可选。 */
const conventionalRe = /^(feat|fix|perf|refactor|docs|build|ci|test|chore|style)(\([^)]*\))?(!)?: (.+)$/

const args = process.argv.slice(2)
const releaseVersion = args.includes('--release') ? args[args.indexOf('--release') + 1] : undefined
const notesOnly = args.includes('--notes')

if (releaseVersion && !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(releaseVersion)) {
  console.error(`invalid version: ${releaseVersion}`)
  process.exit(1)
}

/** Run git in the repo root and return trimmed stdout. */
/** 在仓库根目录运行 git 并返回修剪后的 stdout。 */
function git(...args_: string[]): string {
  return execFileSync('git', args_, { cwd: root, encoding: 'utf8' }).trim()
}

/** Latest v* tag preceding HEAD, or null when none exists yet. */
/** HEAD 之前最新的 v* tag, 尚不存在时返回 null。 */
function lastReleaseTag(): string | null {
  const tags = git('tag', '--list', 'v*', '--merged', 'HEAD', '--sort=-v:refname')
  return tags ? tags.split('\n')[0] : null
}

/**
 * Collect conventional commits since the last release tag (all commits when
 * no tag exists). Non-conventional or noise commits (docs/build/ci/test/
 * chore/style) are counted and skipped so the changelog stays user-facing.
 *
 * 收集自上个发布 tag 以来的常规提交(无 tag 时收集全部)。不符合规范或
 * 属于噪音类型(docs/build/ci/test/chore/style)的提交只计数并跳过,
 * 保持更新日志面向用户。
 */
function collectCommits(): { entries: Commit[], skipped: { nonConventional: number, noise: number } } {
  const tag = lastReleaseTag()
  const range = tag ? `${tag}..HEAD` : 'HEAD'
  // \x1E separates records, \x00 separates hash/subject/body within one.
  const raw = execFileSync('git', ['log', '--format=%h%x00%s%x00%b%x1E', range], { cwd: root, encoding: 'utf8' })
  const entries: Commit[] = []
  const skipped = { nonConventional: 0, noise: 0 }
  const renderedTypes = new Set(changelogs[0].groups.map(([type]) => type))
  for (const record of raw.split('\x1E')) {
    const [hash, subject, body = ''] = record.trim().split('\x00')
    if (!hash)
      continue
    const match = subject.match(conventionalRe)
    if (!match) {
      skipped.nonConventional++
      continue
    }
    const [, type, scoped, bang, text] = match
    if (!renderedTypes.has(type)) {
      skipped.noise++
      continue
    }
    const zhLine = body.match(/^zh-CN:[\t ]*(\S.*)$/im)
    if (!zhLine)
      console.error(`warn: no zh-CN subject, falling back to English: ${hash} ${subject}`)
    entries.push({
      hash,
      type,
      scope: scoped ? scoped.slice(1, -1) : '',
      breaking: Boolean(bang) || /^BREAKING CHANGE:/im.test(body),
      en: text,
      zh: zhLine ? zhLine[1] : text,
    })
  }
  return { entries, skipped }
}

/** One bullet: scope bolded when present, short hash for traceability. */
/** 单条列表项: 有 scope 时加粗, 附短哈希便于追溯。 */
function renderEntry(entry: Commit, pick: (entry: Commit) => string): string {
  const text = entry.scope ? `**${entry.scope}:** ${pick(entry)}` : pick(entry)
  return `- ${text} (\`${entry.hash}\`)`
}

/** Render one language's grouped markdown list from collected entries. */
/** 将收集到的条目按分组渲染为某种语言的 markdown 列表。 */
function renderGroups(entries: Commit[], pick: (entry: Commit) => string, breakingTitle: string, groups: Array<[string, string]>): string[] {
  const blocks: string[][] = []
  const breaking = entries.filter(e => e.breaking)
  if (breaking.length)
    blocks.push([`### ${breakingTitle}`, ...breaking.map(e => renderEntry(e, pick))])
  for (const [type, title] of groups) {
    const scoped = entries.filter(e => e.type === type && !e.breaking)
    if (scoped.length)
      blocks.push([`### ${title}`, ...scoped.map(e => renderEntry(e, pick))])
  }
  return blocks.flatMap(block => ['', ...block])
}

/**
 * Rewrite the `[Unreleased]` section of one changelog file. Existing manual
 * prose is preserved unless the run has entries to substitute (so the initial
 * hand-written history survives until conventional commits exist). When
 * `releaseVersion` is set, the section becomes `[version] - date` and a fresh
 * placeholder `[Unreleased]` opens above it.
 *
 * 重写单个 changelog 文件的 `[Unreleased]` 小节。除非本次收集到了条目,
 * 已有手写内容保持不动(因此首次发布前的手写历史会保留)。指定
 * `releaseVersion` 时, 该小节落为 `[version] - date`, 并在其上方新开一个
 * 占位的 `[Unreleased]`。
 */
function updateChangelog(cl: ChangelogSpec, lines: string[]): boolean {
  const path = join(root, cl.file)
  const content = readFileSync(path, 'utf8')
  const fileLines = content.split('\n')
  const start = fileLines.findIndex(l => l.startsWith('## [Unreleased]'))
  if (start === -1) {
    console.error(`error: no [Unreleased] section in ${cl.file}`)
    process.exit(1)
  }
  let end = fileLines.findIndex((l, i) => i > start && l.startsWith('## '))
  if (end === -1)
    end = fileLines.length
  const currentBody = fileLines.slice(start + 1, end)
  if (!lines.length && !currentBody.some(l => l.trim() === cl.placeholder)) {
    console.error(`notice: no entries and ${cl.file} has manual content; leaving [Unreleased] as-is`)
    return false
  }
  const body = lines.length ? ['', ...lines] : ['', cl.placeholder]
  const date = new Date().toISOString().slice(0, 10)
  const rebuilt = releaseVersion
    ? ['## [Unreleased]', '', cl.placeholder, '', `## [${releaseVersion}] - ${date}`, ...body]
    : ['## [Unreleased]', ...body]
  fileLines.splice(start, end - start, ...rebuilt)
  const out = fileLines.join('\n').replace(/\n{3,}/g, '\n\n')
  if (!notesOnly) {
    writeFileSync(path, `${out.trimEnd()}\n`)
    console.log(`updated ${cl.file}`)
  }
  return true
}

/** Bilingual markdown body for the GitHub Release page. */
/** 供 GitHub Release 页面使用的双语 markdown 正文。 */
function renderNotes(en: Commit[], zh: Commit[]): string {
  const enLines = renderGroups(en, e => e.en, changelogs[0].breaking, changelogs[0].groups)
  const zhLines = renderGroups(zh, e => e.zh, changelogs[1].breaking, changelogs[1].groups)
  return [
    ...enLines.length ? [`## English`, '', ...enLines] : [],
    ...zhLines.length ? [`## 中文`, '', ...zhLines] : [],
  ].join('\n\n')
}

const { entries, skipped } = collectCommits()
if (skipped.nonConventional)
  console.error(`notice: ${skipped.nonConventional} non-conventional commit(s) excluded`)
if (skipped.noise)
  console.error(`notice: ${skipped.noise} docs/build/ci/test/chore/style commit(s) excluded`)

if (notesOnly) {
  console.log(renderNotes(entries, entries))
}
else {
  const results = changelogs.map((cl, i) =>
    updateChangelog(cl, renderGroups(entries, i === 0 ? e => e.en : e => e.zh, cl.breaking, cl.groups)))
  if (releaseVersion && !results.some(Boolean)) {
    console.error('error: nothing to release — [Unreleased] has no entries in either changelog')
    process.exit(1)
  }
  if (releaseVersion)
    console.log(renderNotes(entries, entries))
}
