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

/**
 * Latest v* tag preceding HEAD, or null when none exists yet. The tag for the
 * version currently being released is skipped: a release tag normally points
 * at (or before) the commit being released, and counting it as the "last
 * release" would leave an empty commit range and an empty changelog section.
 *
 * HEAD 之前最新的 v* tag, 尚不存在时返回 null。当前正在发布的版本对应的
 * tag 会被跳过: 发布 tag 通常就指向 (或早于) 正在发布的提交, 若把它当作
 * 「上次发布」, 提交区间与 changelog 小节都会是空的。
 */
function lastReleaseTag(excludeVersion?: string): string | null {
  const excluded = excludeVersion ? `v${excludeVersion}` : undefined
  const tags = git('tag', '--list', 'v*', '--merged', 'HEAD', '--sort=-v:refname')
    .split('\n')
    .filter(tag => tag && tag !== excluded)
  return tags.length ? tags[0] : null
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
function collectCommits(excludeVersion?: string): { entries: Commit[], skipped: { nonConventional: number, noise: number } } {
  const tag = lastReleaseTag(excludeVersion)
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
 * prose is preserved unless the run has entries to substitute, or a release is
 * being cut — in which case the hand-written section itself becomes the
 * released version and the file gets a fresh placeholder `[Unreleased]`.
 * Returns whether a version section was actually released, plus the body that
 * went into it (used verbatim as the Release notes when there are no generated
 * entries).
 *
 * 重写单个 changelog 文件的 `[Unreleased]` 小节。除非本次收集到了条目、或正在
 * 落版本发布, 已有手写内容保持不动 —— 落版本时手写小节本身即成为该版本内容,
 * 文件上方新开占位 `[Unreleased]`。返回是否真的落了一个版本小节, 以及写入
 * 其中的正文 (没有自动生成条目时直接用作 Release 正文)。
 */
function updateChangelog(cl: ChangelogSpec, lines: string[]): { released: boolean, body: string[] } {
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
  // Hand-written prose keeps its interior blank lines (they separate groups);
  // only leading/trailing blanks and placeholder lines are dropped.
  // 手写正文保留内部空行 (它们分隔各分组), 仅去掉首尾空行与占位行。
  const manualBody = [...currentBody]
  while (manualBody.length && !manualBody[0].trim())
    manualBody.shift()
  while (manualBody.length && !manualBody[manualBody.length - 1].trim())
    manualBody.pop()
  const manualLines = manualBody.filter(l => l.trim() && l.trim() !== cl.placeholder)
  const releaseManual = Boolean(releaseVersion) && manualLines.length > 0
  if (!lines.length && !releaseManual && !currentBody.some(l => l.trim() === cl.placeholder)) {
    console.error(`notice: no entries and ${cl.file} has manual content; leaving [Unreleased] as-is`)
    return { released: false, body: [] }
  }
  // A release keeps any hand-written prose and appends the generated entries
  // that it does not already contain, so a curated summary is never dropped
  // by the generator and generated bullets are never duplicated.
  // 落版本时保留手写内容, 并追加其中尚未包含的自动条目 —— 既不会让生成器
  // 丢掉人工整理的摘要, 也不会重复生成同一条目。
  const merged = lines.length && releaseManual
    ? [...manualBody, '', ...subtractEntries(lines, manualLines)]
    : lines.length ? lines : manualBody
  const body = (lines.length || releaseManual) ? ['', ...merged] : ['', cl.placeholder]
  const date = new Date().toISOString().slice(0, 10)
  const rebuilt = releaseVersion
    ? ['## [Unreleased]', '', cl.placeholder, '', `## [${releaseVersion}] - ${date}`, ...body, '']
    : ['## [Unreleased]', ...body]
  fileLines.splice(start, end - start, ...rebuilt)
  const out = fileLines.join('\n').replace(/\n{3,}/g, '\n\n')
  if (!notesOnly) {
    writeFileSync(path, `${out.trimEnd()}\n`)
    // Progress belongs on stderr: stdout is redirected into the release notes.
    // 进度信息走 stderr: stdout 会被重定向为 Release 正文。
    console.error(`updated ${cl.file}`)
  }
  return { released: lines.length > 0 || releaseManual, body: body.filter(l => l.trim()) }
}

/**
 * Generated entries minus the bullets the manual section already lists, with a
 * group heading kept only when at least one of its bullets survives. Bullets
 * are compared without their trailing `(hash)` — a hand-written line usually
 * names the same change but may carry an older hash — and a heading already
 * present in the manual section is not repeated.
 *
 * 从自动条目中去掉手写小节已列出的条目; 仅当某分组仍有条目保留时才保留其
 * 标题。比较条目时忽略结尾的 `(hash)` —— 手写行通常描述同一变更但可能带
 * 旧哈希; 手写小节已有的标题不会重复添加。
 */
function subtractEntries(lines: string[], manualBody: string[]): string[] {
  const normalize = (line: string): string => line.trim().replace(/\s*\(`[0-9a-f]+`\)\s*$/, '')
  const seen = new Set(manualBody.map(normalize))
  const headings = new Set(manualBody.map(l => l.trim()).filter(l => l.startsWith('### ')))
  const kept: string[] = []
  let heading: string | null = null
  let headingUsed = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) {
      heading = trimmed
      headingUsed = false
      continue
    }
    if (!trimmed || seen.has(normalize(line)))
      continue
    if (heading && !headingUsed) {
      if (!headings.has(heading))
        kept.push(heading)
      headingUsed = true
    }
    kept.push(line)
  }
  return kept
}

/** Bilingual markdown body for the GitHub Release page. */
/** 供 GitHub Release 页面使用的双语 markdown 正文。 */
function renderNotes(en: Commit[], zh: Commit[]): string {
  const enLines = renderGroups(en, e => e.en, changelogs[0].breaking, changelogs[0].groups)
  const zhLines = renderGroups(zh, e => e.zh, changelogs[1].breaking, changelogs[1].groups)
  return [
    ...enLines.length ? [`## English`, '', ...enLines] : [],
    ...zhLines.length ? [`## 中文`, '', ...zhLines] : [],
  ].join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

const { entries, skipped } = collectCommits(releaseVersion)
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
  if (releaseVersion && !results.some(r => r.released)) {
    console.error('error: nothing to release — [Unreleased] has no entries in either changelog')
    process.exit(1)
  }
  if (releaseVersion) {
    // With generated entries the notes are rendered from commits; for a
    // hand-written [Unreleased] section the released body is the notes.
    // 有自动生成条目时由提交渲染正文; 手写的 [Unreleased] 小节则以落版正文
    // 作为 Release 正文。
    if (entries.length) {
      console.log(renderNotes(entries, entries))
    }
    else {
      console.log(results
        .map((r, i) => r.body.length ? `## ${i === 0 ? 'English' : '中文'}\n\n${r.body.join('\n')}` : '')
        .filter(Boolean)
        .join('\n\n'))
    }
  }
}
