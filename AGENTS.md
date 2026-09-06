This monorepo uses `pnpm`.

**IMPORTANT:** Always use kebab-case for file names, even if it is not the usual convention.

The `skills/koota` directory contains a skill with reference documentation for the koota project. When updating the README, the skill should be updated as well to keep documentation in sync. Follow best practices for agent skills.

## Benchmarks

Benchmarks live in `benches/`. Benches should be run only for the relevant set using the tags or names and then compared to look for regressions or to optimize code.

```sh
# Run suites using tags or by name and name with -n
pnpm bench "@relation @graph" -n "Name"

# Set baseline
pnpm bench baseline "Name"

# Compare baseline to a test by name
pnpm bench compare "Name"
```

## neko fork development

Read docs-fork/Development/fork-workflow.md and docs-fork/Development/fork-audit.md before multi-step fork work. Preserve upstream layout, style and build transforms. Keep changes focused; do not apply neko-wide class or formatting migrations here. Record evidence and next actions in the audit. Do not introduce game-state rollback or accept runtime performance regressions for maintainability. Preserve cleanup and lifetime checks.

Fork documentation entry point: docs-fork/Development/index.md. Follow docs-fork/Development/development-rules.md and docs-fork/Development/audit-workflow.md. Use main, develop and feature/*; do not add develop-fork. Japanese commit messages are welcome; upstream PRs are not part of the workflow.

Keep fork-owned documentation under docs-fork/, separate from upstream docs/. Use the same API, Architecture, Development and Guides categories as neko-threejs; put design history in Development/History and measurements in Development/Performance. Create categories only when they have content. Update local links when moving pages.
