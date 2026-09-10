# AGENTS.md Maintenance Workflow

Read this reference when creating an instruction hierarchy, auditing or compacting multiple files,
resolving conflicting guidance, or adding compatibility for another agent tool. For a small,
unambiguous rule update, the core skill is sufficient.

## 1. Inventory the effective instruction surface

Start with a read-only inventory:

- root, nested, localized, and override variants of `AGENTS.md`;
- routed policy files under `.agents/rules/` or an established equivalent, including the exact
  pointer wording and task branches that expose each file;
- repository configuration that changes instruction discovery or size limits; and
- tool-specific instruction files only for tools the repository actually uses or the user requests.

Inspect user/global instructions only when a relevant conflict must be diagnosed and access is
permitted. Do not scan environment files, credentials, caches, arbitrary home-directory content, or
unrelated source trees merely to build an inventory.

Determine the effective chain for representative affected paths. Same-directory override behavior,
fallback filenames, import syntax, path scoping, and supported compatibility files vary by tool and
can change over time. Verify behavior against current official documentation before creating or
rewriting a compatibility file. Do not duplicate the same always-loaded rules across tools.

Treat automated discovery as an index. Open and verify the authoritative sources before persisting
their claims.

## 2. Establish evidence and confidence

Use the narrowest scan that can establish the rule. Prefer:

1. direct user requirements and the effective repository instruction chain;
2. executable scripts, CI workflows, configuration, schemas, and generated-file declarations;
3. maintained repository documentation;
4. representative source code and tests; and
5. Git history as a navigation signal, followed by confirmation in current sources.

For commands, locate the defining script, manifest, task runner, CI job, container configuration, or
wrapper. Preserve required working directories, service names, ordering, and environment wrappers.
Do not infer a framework-default command when the repository defines its own.

Use these internal confidence labels:

- `verified`: directly supported by a current authoritative source;
- `probable`: supported by multiple indirect signals but no authority; and
- `unknown`: missing or conflicting evidence.

Persist verified content. Qualify or omit probable content. Ask about unknown content only when the
choice is material. Never write confidence labels into the repository rule itself.

## 3. Reconcile rules semantically

Build an inventory of actionable rules. For each rule, record its effective scope, supporting or
contradicting evidence, authoritative home, and one action:

- `keep`: current, specific, useful, and supported;
- `update`: useful but contradicted by stronger current evidence;
- `move`: useful but owned by a narrower instruction, `.agents/rules/`, `docs/`, a skill, or an
  enforceable mechanism;
- `remove`: generic, duplicated, stale, unverifiable, transient, sensitive, or fully automated; or
- `confirm`: a genuine policy or ownership conflict that local evidence cannot resolve.

Rules with different wording but the same operational effect are duplicates. Keep the clearest,
most concrete version. Resolve conflicts from evidence where authority is clear; ask only about
`confirm` items and state each source path plus the practical effect of either choice.

Do not append a new template under existing guidance, preserve stale content in a legacy section,
or keep both sides of a conflict for later cleanup. Preserve unrelated user-authored content. When
Git tracks the file, rely on the working-tree diff for recovery rather than creating backup files or
commits.

## 4. Select the layout

- Keep broadly applicable working rules and task routes in the root `AGENTS.md`.
- Add a nested `AGENTS.md` only for a real subtree difference, and write only the delta from its
  parent.
- Put detailed repository-specific working policies in `.agents/rules/<topic>.md` and route to them
  conditionally. Name what each target governs and every distinct task branch that must read it;
  do not spend pointer text on synonyms for the same branch.
- Put product, domain, architecture, requirements, schemas, and roadmaps in `docs/`.
- Put portable capability, scripts, templates, and reusable workflows in a skill.
- Create tool-specific compatibility files only when requested or demonstrably required by the
  tools in active use. Keep shared rules authoritative in one place.

Do not generate instruction files for every monorepo package or common directory by default. A
nested file is justified by different commands, tools, safety boundaries, or conventions—not by the
directory's existence.

Within each selected file, co-locate a rule's definition, trigger, required action, exceptions, and
completion criterion. Do not scatter one obligation across an overview, a procedure, and a final
check when one focused section can carry the complete meaning.

## 5. Compact without weakening rules

Measure instead of estimating. When the repository has no documented budget, use these as soft
review triggers, not universal validity limits:

- root `AGENTS.md`: review at 200 lines or 16 KiB;
- nested `AGENTS.md`: review at 80 lines.

Compact in this order:

1. remove personas, introductions, conclusions, generic advice, empty sections, and no-op
   instructions that do not change repository-specific decisions or verification;
2. remove duplicates and rules fully enforced by automation when no agent action remains;
3. replace project-document summaries and cheap environment lookups with conditional links or the
   authoritative source, retaining only non-obvious conventions, reasons, and required actions;
4. move detailed working procedures to `.agents/rules/`;
5. move subtree-only differences to the nearest nested instruction file; and
6. combine related bullets without losing triggers, actions, exceptions, or verification criteria.

Do not raise a harness context limit as a substitute for maintaining a concise instruction layer.

## 6. Verify the final artifacts

Check the resulting effective chain, not only the editing process:

- every path exists and every command matches its current defining source;
- no unresolved placeholders, template braces, generated-marker comments, or empty boilerplate
  remains;
- no secrets, credentials, private prompts, transcript text, verbatim user request, personal home
  paths, task status, roadmap, or tool inventory entered standing guidance;
- root, nested, `.agents/rules/`, `docs/`, skills, and compatibility files have no duplicated
  authority;
- every context pointer names what its target governs and covers the distinct task branches that
  require it without becoming a catch-all;
- each rule keeps its trigger, action, material exceptions, and completion criterion together;
- nested instructions contain only scoped differences and do not silently weaken parents;
- language and localization follow repository evidence and required counterparts remain aligned;
- compatibility behavior is current for each selected tool;
- the final diff removes stale guidance instead of merely adding more text; and
- repository documentation, formatting, link, and instruction checks pass where available.

Report concise counts or lists for rules kept, updated, moved, removed, and unresolved. Mention
unverified commands, unavailable checks, compatibility assumptions, and any soft budget exceeded.
