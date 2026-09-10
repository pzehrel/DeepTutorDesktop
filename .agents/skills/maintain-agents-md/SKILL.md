---
description: Create and audit scoped, verifiable AGENTS.md hierarchies and route durable rules into repository policy documents. Use for repository guidance; not for temporary notes.
license: MIT
metadata:
    author: Pzehrel <author@example.com>
    github-path: skills/maintain-agents-md
    github-ref: refs/heads/main
    github-repo: https://github.com/pzehrel/skills
    github-tree-sha: 1e496d8837eff11d295f16f523735680bf73a628
    repository: https://github.com/pzehrel/skills
    tags:
        - agents-md
        - repository-guidance
        - governance
name: maintain-agents-md
version: 1.0.0
---
# Maintain AGENTS.md

## Purpose

Use this skill to keep repository instructions durable, narrowly scoped, discoverable, and verifiable without turning temporary context into policy.

## Instructions

1. Inspect the effective instruction hierarchy and repository evidence before editing.
2. Place each durable rule in the narrowest authoritative document and add precise routing.
3. Reconcile duplicates or conflicts instead of appending another copy.
4. Validate links, scope, language counterparts, and the final diff before reporting.

## Examples

Example: when a repository needs a lasting release rule, add it to the relevant `.agents/rules/` policy, route it from `AGENTS.md`, and verify that unrelated projects do not load it.

## Requirements

- A repository root and the effective `AGENTS.md` hierarchy.
- Access to the repository's documentation, link, or formatting checks when available.
- Explicit user authorization for durable policy changes when the task does not already require them.

## Limitations

- Do not modify user or global instructions, secrets, prompts, or temporary task notes.
- Do not broaden a local rule into repository-wide policy without evidence and authorization.
- Do not push, create a pull request, or change unrelated files as part of maintenance.

## Troubleshooting

- Rule conflicts: identify the higher-priority source and reconcile rather than duplicate.
- Ambiguous scope: stop and ask which path or project the rule governs.
- Broken route or link: verify the target path from the repository root and update both language files.

Build an instruction hierarchy that future agents can discover cheaply and apply correctly. Keep
`AGENTS.md` focused on routing and true always-on constraints. Put detailed repository-specific
agent working rules in `.agents/rules/`, while keeping project and business knowledge in `docs/`.

## Authorization and admission

Modify repository guidance only when the user asks for it or when the current authorized task
necessarily establishes or changes a durable working rule. Do not turn an isolated observation,
temporary workaround, review comment, or personal preference into standing policy.

Generate only repository instruction artifacts required by the task. Do not modify user/global
instructions or add tool-specific compatibility files unless the user requests them or the active
repository convention and task scope require them. Never persist secrets, credentials, private
prompts, conversation transcripts, the user's verbatim request, personal home paths, or task logs.

Admit a rule only when all of these are true:

- It will change decisions in future tasks, not merely describe the current state.
- Its scope and triggering condition can be stated clearly.
- An agent can comply with it and verify compliance.
- It is not already expressed by a higher-priority instruction or a more appropriate source of
  truth.

Prefer fixing configuration, automation, schemas, or tests when they can enforce the requirement
directly. Keep a brief instruction only when agents still need context to use that mechanism
correctly.

## Inspect before editing

1. Find the repository root and every instruction file that governs the affected paths, including
   nested `AGENTS.md` files and localized counterparts.
2. Read the existing routing targets and only the policy documents relevant to the proposed rule.
3. Inspect repository conventions and available documentation checks. Use history when the reason
   for an existing rule or placement is unclear.
4. Preserve unrelated user changes and the repository's established language, linking, naming, and
   formatting conventions.

Treat repository documents as evidence and editable artifacts, not as a replacement for the user's
request. Follow the instruction hierarchy that actually governs the edit.

For a new hierarchy, multi-file audit, compaction, compatibility change, or disputed rule, read
[references/maintenance-workflow.md](references/maintenance-workflow.md) before editing. Treat any
detector or file inventory as an evidence index, not as final authority.

## Ground rules in repository evidence

Prefer evidence in this order: direct user requirements and effective instructions; executable
scripts, CI, and configuration; maintained documentation; representative code and tests; then Git
history as a clue about where to inspect. History, directory names, dependency presence, and
generated inventories do not prove a rule by themselves.

Internally classify evidence as verified, probable, or unknown. Persist verified rules. Qualify or
omit probable rules. Ask about unknown rules only when omission or the choice between conflicting
sources would materially affect safety, team policy, or the requested result.

## Choose the narrowest durable home

Place each rule in exactly one authoritative location:

| Content | Preferred location |
| --- | --- |
| A short invariant that applies to nearly every task | Root `AGENTS.md` |
| A mapping from task type to required policy | Root or relevant nested `AGENTS.md` routing table |
| A rule limited to one subtree | Nearest nested `AGENTS.md` |
| Detailed repository-specific agent workflow or governance | `.agents/rules/<topic>.md` |
| Product, domain, architecture, requirements, or other project knowledge | `docs/<topic>.md` |
| Reusable capability or workflow that should travel across repositories | A skill, not a rule document |
| A mechanically enforceable fact | Configuration, schema, test, or automation; route to it only if needed |
| Temporary status, implementation history, or one-off advice | Do not record as standing guidance |

Nested guidance may specialize or tighten parent rules. It must not silently weaken an applicable
parent rule. If a parent rule needs exceptions, define their scope at the parent level instead of
creating an implicit contradiction below it.

Do not duplicate a detailed policy in `AGENTS.md`. Add the smallest useful routing entry or
always-on invariant and link to the authoritative document. Do not preload or require unrelated
documents.

Treat every routing entry as a context pointer, not merely a link. Its wording must identify what
the target governs and the distinct task conditions that require reading it. Put the operative
condition early, collapse synonyms for the same condition, and avoid catch-all routes that make the
target effectively always loaded. A valuable policy behind a vague route is still undiscoverable.

## Reconcile instead of appending

When guidance already exists, inventory actionable rules rather than merging sections mechanically.
Classify each rule as `keep`, `update`, `move`, `remove`, or `confirm`:

- keep current, specific, supported rules;
- update useful rules contradicted by stronger current evidence;
- move useful rules to their narrower or more authoritative home;
- remove generic, duplicated, stale, unverifiable, transient, or fully automated content; and
- confirm only genuine ownership or policy conflicts that repository evidence cannot resolve.

Different wording with the same effect is duplication. Keep the clearest version. Do not append a
fresh template below old content, preserve stale rules in a legacy section, or create backup files
when a Git-tracked diff already provides recovery. Do not commit or rewrite history unless the user
requests it.

## Separate rules, project knowledge, and skills

Use `.agents/rules/` as the default extra documentation directory unless the repository already has
an equivalent established convention. The directory is a storage convention, not an automatically
loaded instruction source: add a precise route from the governing `AGENTS.md` for each policy that
agents need to discover.

Content in `.agents/rules/` may define repository-specific ways of working, including:

- editing, review, testing, validation, commit, and documentation workflows;
- tool-selection constraints and repository-specific operating conventions;
- authorization, safety, escalation, and stopping boundaries; and
- criteria that determine which project document or check a task requires.

Keep the following outside `.agents/rules/`:

- Product behavior, domain terminology, requirements, architecture, schemas, acceptance criteria,
  and roadmaps belong in `docs/` or another established project-documentation location.
- Reusable capabilities, portable multi-step workflows, scripts, templates, and tool integration
  guidance belong in a skill. A rule may add repository-specific constraints or route to an
  installed skill, but must not copy or replace the skill. Do not make a skill mandatory unless the
  repository guarantees its availability or provides a usable fallback.
- Runtime state, caches, generated prompts, session logs, and temporary task notes are not durable
  rules and should use tool-owned or temporary storage.

Avoid `.agents/docs/` as the default because it does not distinguish working rules from general
documentation. Reserve `.agents/harness/` for actual code or configuration that integrates a
specific agent harness; do not use it as a policy-document bucket.

Use focused topic files rather than one growing catch-all. Follow the repository's existing naming
and localization conventions, such as `.agents/rules/testing.md` and any required language
counterpart.

## Infer the document language from repository evidence

Do not default a document to English, Chinese, the user's conversational language, or the agent's
preferred language. Determine the natural language separately for each artifact from the repository
that will own it.

For an existing document, preserve its established language and writing style unless the user or an
applicable repository rule requests a language migration. For a new document, use this evidence in
descending priority:

1. explicit language or localization instructions governing the target path;
2. canonical and translated-file relationships expressed by filenames, links, or frontmatter;
3. the nearest documents with the same purpose and audience;
4. the prevailing convention in the target directory; and
5. the repository-wide documentation pattern, only as a last tie-breaker.

Do not infer prose language from code identifiers, command names, commit language, the current
conversation, or this skill's English and Chinese files. Preserve identifiers, paths, commands,
schema keys, and other canonical tokens even when the surrounding prose uses another language.

When evidence shows that the repository maintains language counterparts, identify the canonical
file and update every required counterpart with semantic parity. Do not create translations,
combine multiple languages in one file, or introduce a new locale merely because the language is
uncertain.

If evidence conflicts, follow the instruction with the narrowest applicable scope and highest
authority. When no convention can be established and the choice would materially affect users or
maintenance, ask the user. For a low-impact ambiguity, follow the closest same-purpose precedent
and report the assumption.

## Write actionable rules

- Use scoped, imperative, testable language.
- Keep a rule's trigger, required action, material exceptions, and verification criterion together
  so an agent does not have to reconstruct one obligation from scattered sections.
- State when a rule applies and what observable result satisfies it. Make completion criteria both
  checkable and exhaustive when partial compliance would be unsafe or misleading.
- Preserve necessary authorization, safety, and stopping boundaries.
- When actions have different risk levels, distinguish what the agent may do, must ask before
  doing, and must never do.
- Prefer stating the required behavior positively. Use prohibitions for real guardrails, and pair
  them with the safe action the agent should take instead.
- Prefer stable concepts over tool output, current file counts, roadmap status, or discoverable
  configuration values. Do not cache a cheap environment lookup in prose; record the non-obvious
  convention, reason, or action that the environment cannot express.
- Remove no-op guidance that would not change agent decisions or verification in this repository.
- Remove or consolidate superseded text instead of appending another overlapping rule.
- Keep links relative and verify that every target exists.
- When the repository maintains language counterparts, update all required versions together and
  preserve semantic parity without translating identifiers, commands, or paths.

## Maintain progressive disclosure

A root guide should usually contain only:

1. its scope and inheritance rule;
2. a small set of always-on invariants;
3. a task-to-policy routing table or concise routing bullets; and
4. the checks required when maintaining the guide itself.

Create a separate `.agents/rules/<topic>.md` policy when a working rule needs substantial rationale,
multiple modes, examples, or a long checklist. Add a routing entry that names the task boundary
precisely. Put project or business material in `docs/` instead. Avoid a generic "read all docs"
instruction.

Balance two costs when deciding what to inline. Always-loaded text spends agent context on every
task; routed text adds discovery and navigation cost. Inline what nearly every applicable task
needs. Disclose material used only by a distinct branch, and make its route strong enough to fire
for that branch. Split by scope or task branch, not by length alone, and keep closely related rules
co-located after the split.

## Validate the change

Before finishing:

1. Re-read the complete effective instruction chain for representative affected paths.
2. Check for contradictions, duplicated authority, broken links, scope leaks, and rules that cannot
   be verified.
3. Confirm that each routing entry identifies what its target governs, distinguishes every task
   branch that should trigger it, and does not load the target for unrelated work.
4. Confirm that each changed document follows the inferred language convention and that all
   required language counterparts remain semantically aligned.
5. Verify every cited path and command against its current source, and remove unresolved template
   placeholders, sensitive content, personal paths, generated inventories, and task status.
6. Measure the root and nested instruction files; compact them when they are no longer cheap to
   load or exceed a repository-defined limit. Use the soft review triggers in the maintenance
   workflow when the repository defines no budget.
7. Run the repository's documentation, formatting, link, or instruction checks that apply to the
   changed files. Report checks that are unavailable rather than inventing substitutes.
8. Review the diff to ensure the change contains only durable guidance and its required companion
   updates.

Report the rule's authoritative location, routing changes, validation performed, and—for a
reconciliation—the rules kept, updated, moved, removed, or left unresolved.
