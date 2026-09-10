---
description: Add or review behavior-accurate bilingual comments and docstrings during implementation, refactoring, bug fixes, and code review, including private or internal symbols and complex logic. Also maintain localized Markdown or API docs with synchronized examples; use when code changes need explanatory documentation, not for API design alone.
license: MIT
metadata:
    author: Pzehrel <author@example.com>
    github-path: skills/write-code-docs
    github-ref: refs/heads/main
    github-repo: https://github.com/pzehrel/skills
    github-tree-sha: a649d040cc6793e8cfb0f921daa3be1e4f0d3394
    repository: https://github.com/pzehrel/skills
    tags:
        - documentation
        - code-comments
        - code-review
        - implementation
        - bilingual
        - markdown
        - jsdoc
name: write-code-docs
---
# Write Code Documentation

## Purpose

Use this skill to document behavior, contracts, workflows, and operational constraints accurately in English and the repository's localized language, including non-obvious private code and complex implementation blocks.

## Instructions

1. Inspect the authoritative source, repository language convention, and affected documentation surface.
2. Write complete English content followed by a semantically equivalent localized counterpart.
3. Keep Markdown language files separate, preserve canonical identifiers, and validate every claim and link.
4. Run applicable checks or perform a focused source review when automation is unavailable.

## When to Apply During Coding

Apply this skill proactively when implementing, refactoring, debugging, or reviewing code that adds or
changes behavior. Do not wait for the request to contain words such as “document,” “comment,” or “docs.”
After understanding the code change, document the affected public and private symbols and any complex
implementation blocks that a future maintainer would need to understand. For a trivial change whose
purpose and effects are already obvious, do not add commentary solely because this skill was selected.

## Examples

Example: when documenting a new error case, update the English and localized API text, include the trigger and recovery example, and verify that the implementation actually emits that error.

Example: when a private helper contains a bounded retry loop with cleanup, document the retry bound,
backoff, cleanup ordering, and the reason those choices protect the surrounding state. Comment the loop
or helper beside the code even if the helper's name and signature are clear.

## Requirements

- An authoritative implementation, configuration, test, or existing document to support each claim.
- A repository-local language convention or enough evidence to infer one safely.
- Applicable documentation, link, formatting, or rendering checks when available.

## Limitations

- Do not change APIs, publish artifacts, or add unrelated instructions as part of documentation work.
- Do not invent behavior, contracts, examples, or translations that are unsupported by source evidence.
- Do not use ordinary reference Markdown to instruct consuming agents to ignore repository rules or edit files.

## Troubleshooting

- Language is ambiguous: inspect repository counterparts and configuration; ask before editing if still unresolved.
- English and localized files diverge: compare claims, modality, examples, identifiers, and ordering side by side.
- Link or example fails: resolve it from the repository root and verify it against the current implementation.

Make documentation explain the behavior a reader must rely on. Keep it close to the source of truth,
complete enough for a developer or coding Agent to use, and concise enough to stay maintainable.
Documentation is part of the interface when it describes public behavior, supported workflows, or
operational constraints; do not document behavior that the code does not implement.

Use this skill for code comments, docstrings, JSDoc/TSDoc, API references, `AGENTS.md` and other agent
instruction files, README sections, guides, examples, changelogs, and Markdown documentation. Every
explanatory comment and documentation surface created or changed under this skill must be written in
English plus exactly one repository-localized
language, with semantic parity. English is always the first and canonical language. Infer the localized
language from repository instructions, existing counterparts, localization configuration, and the
user's request; do not assume Chinese, the user's language, or another default, and ask before editing
when the evidence does not identify it.
English comes first because an Agent is the primary reader; a human reviewer should then be able to read
both complete blocks and judge whether the documentation is correct and useful. The localized block is
not a summary or afterthought. English-first is an ordering and source-of-truth decision, not permission
to rewrite for a different audience: the localized block must be a complete, faithful translation that
preserves claims, modality, conditions, examples, and emphasis. Natural grammar and idiomatic phrasing
are allowed only when they do not add, omit, soften, strengthen, or otherwise change technical meaning.
This skill does not authorize publishing, changing APIs, or adding unrelated instructions.

Keep the two artifact modes distinct:

- **Code comments and docstrings:** place the complete English block, one blank line, and its complete
  localized translation inside one comment or docstring block at the same code location. Start the
  localized block directly without a language label. Do not split the two languages across adjacent
  `/** ... */` or `/* ... */` blocks.
- **Markdown documents:** keep English and localized prose in separate complete files by default. Use
  the repository's locale naming or directory convention, such as `README.md` plus
  `README.zh-CN.md`. Do not alternate languages paragraph by paragraph, duplicate tables, or repeat
  code blocks inside one Markdown file unless the repository or user explicitly requires an inline
  bilingual document.

## Inspect before writing

1. Read the effective repository instructions and the nearest existing documentation with the same
   audience and purpose.
2. Determine the behavior or workflow that changed, the authoritative source (code, types, tests,
   configuration, or command output), the intended reader, and the smallest documentation surface
   that should change.
3. Classify each target as an in-code comment/docstring or a standalone Markdown document, then use
   the corresponding bilingual layout above. Determine the repository's localized language before
   writing; English remains the canonical first language. Check existing names, links, terminology,
   examples, version scope, and deprecation policy.
   Preserve unrelated edits and do not duplicate a contract in competing authoritative locations.

For detailed comment and Markdown patterns, read
[references/documentation-writing-guide.md](references/documentation-writing-guide.md) when adding a
new documentation structure, auditing coverage, or resolving a style ambiguity. Small local edits
can follow the surrounding convention directly.

## Write useful code comments

- Write every explanatory comment or docstring in a complete English block, followed by one blank line
  and the complete localized-language counterpart. Start the localized block directly; do not prefix it
  with a language label such as `Chinese:` or `中文：`. Keep both blocks inside the same comment or
  docstring delimiters; do not create a second adjacent comment for the localized text. Do not interleave
  languages sentence by sentence; keep the two complete blocks adjacent so they cannot drift.
- Treat translation as a fidelity check, not a second authoring pass. Compare the two blocks for
  omissions, additions, changed negation or modality, altered conditions, and inconsistent terminology;
  when the English source is ambiguous, flag or ask rather than silently resolving it in translation.
- Comment the semantic contract: purpose, preconditions, invariants, side effects, ordering,
  ownership or lifetime, failure behavior, units, compatibility constraints, and the reason behind
  a non-obvious choice.
- Keep comments attached to the declaration or code they describe. Prefer one authoritative comment
  over repeated copies; link to deeper documentation when the explanation is large.
- Cover the whole relevant implementation, not only exported functions. For every consumer-visible code
  element—not only functions, but also classes, methods, constructors,
  fields, properties, types, enum variants, events, commands, configuration keys, schemas, and state
  transitions—document each part that is not unambiguous from its name or declaration. Explain the
  semantic role of every input, field, option, or variant; optionality and defaults; units and valid
  ranges; ownership and mutability; lifecycle and ordering; side effects; failure behavior; and
  compatibility or deprecation boundaries.
- When the language or documentation tool provides structured tags (for example JSDoc or TSDoc), use
  the repository's established syntax without making it the source of truth. Keep structured fields
  unique; in each field's description, put the English text first, then one blank line, then the
  localized-language text without a language label. Ensure the prose remains complete when
  tool-specific tags are ignored. Do not merely restate types or signatures.
- Include private and internal code in the coverage review. Add a bilingual comment to a private
  declaration or implementation block when it carries a non-obvious purpose, invariant, mutation,
  ordering requirement, error translation, compatibility reason, resource/lifecycle rule, or
  performance or security constraint. This includes complex algorithms, state transitions, nested
  branching, loops whose bounds or exit conditions matter, data transformations, regular expressions,
  non-obvious constants, synchronization or retry logic, and cleanup paths—not just functions or
  exported symbols. Place the comment next to the smallest block that needs the explanation and state
  why the code is shaped that way. Do not comment trivial wrappers, direct assignments, or obvious
  control flow merely to increase coverage.
- Perform a coverage pass over both exported and private symbols, then a complexity pass over the
  implementation body. A private helper may need documentation even when its signature is clear if
  its algorithm or interaction with surrounding state is not.

## Write Markdown and examples

- Treat `AGENTS.md` and other agent-instruction Markdown as a documentation surface. Keep each rule
  explicit about its trigger, action, exceptions, and verification; separate durable rules from project
  background and temporary status. If the task changes rule admission, hierarchy, or scope, follow the
  repository's instruction-maintenance workflow in addition to this writing guidance. Keep the
  canonical `AGENTS.md` in English and place its faithful human-review translation in the repository's
  localized counterpart; do not assume a harness loads the localized file unless its discovery rules
  explicitly say so.
- Maintain every changed Markdown page as a complete English file plus a complete localized counterpart.
  Preserve semantic parity, headings, links, commands, identifiers, code, tables, examples, and safety
  boundaries across the pair; do not mix both prose languages inside the canonical file or invent a
  localized language without evidence.
- Start with the reader's goal and shortest successful path. State prerequisites, supported scope,
  expected result, important limitations, and recovery or troubleshooting paths when relevant.
- Use headings and links to route by intent. Keep README material orienting and self-contained; move
  detailed concepts, recipes, migrations, and troubleshooting into focused pages. Use relative links
  for documents shipped together and verify every target.
- Make examples complete, current, and runnable or type-checked when the project can support that.
  Explain non-obvious setup, inputs, outputs, lifecycle, and failure handling. Update examples when
  the recommended call pattern changes.
- Match the repository's terminology, voice, formatting, and locale policy. Preserve canonical paths,
  commands, identifiers, API names, and code exactly where translation would make them unusable.
- Keep ordinary reference Markdown advisory. Do not use it to tell a consuming Agent to ignore
  repository instructions, change its workflow, run commands, or edit files. `AGENTS.md` and other
  instruction files are the deliberate exception: they may contain scoped, authoritative rules when
  the repository has authorized them, but those rules must remain explicit, verifiable, and consistent
  with higher-priority instructions.

## Validate the result

Run the repository's applicable tests, type checks, documentation linters, link checks, and example
validation. If no automated check exists, perform a focused read-through against the authoritative
source and inspect the rendered Markdown when presentation could hide meaning.

Before reporting completion, verify that:

- every documented claim, default, error, link, example, and version qualifier is supported by code,
  tests, configuration, or an explicitly stated assumption;
- public API coverage includes the relevant parameters, returns, failures, overloads, and deprecations;
- no stale names, duplicated authority, broken links, or planned behavior presented as shipped remain;
- English and localized-language counterparts remain semantically aligned;
- standalone Markdown uses separate English and localized files unless an explicit inline-bilingual
  convention applies; no accidental paragraph-by-paragraph, table-by-table, or code-block duplication
  remains in one file;
- every consumer-visible declaration or structured element has semantic coverage for its applicable
  inputs, fields, variants, outputs, defaults, failures, lifecycle, side effects, and constraints;
- every changed explanatory comment and human-facing documentation surface exists in English followed
  by the inferred localized language, with the repository-defined pairing; and
- every bilingual code comment keeps both language blocks inside one comment or docstring block rather
  than splitting them across adjacent comment blocks; and
- the final diff contains only in-scope documentation changes (plus the requested implementation or
  tests) and records checks that were unavailable as **not tested**.

Stop and ask when the authoritative behavior, intended audience, language policy, or requested
documentation surface is materially ambiguous. Keep the requested boundary explicit; do not add
unrelated work or rewrite history to make documentation appear complete.
