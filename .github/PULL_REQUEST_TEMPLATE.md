<!--
  Thanks for sending a pull request to Mc-Git! Please fill in the sections below
  so reviewers have the context they need. Delete sections that do not apply.
-->

## Summary

<!-- One or two sentences: what does this PR do and why? -->

## Related issue / User Story

<!--
  - Link the GitHub issue with `Fixes #123`, `Closes #123`, or `Refs #123`.
  - If this PR implements a User Story, mention its ID, e.g. `US-0042`.
-->

Fixes #

## Type of change

<!-- Check all that apply. -->

- [ ] `feat` — new feature (user-visible)
- [ ] `fix` — bug fix
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `chore` — tooling / dependencies / build
- [ ] `perf` — performance improvement
- [ ] `ci` — CI/CD configuration

## How was it tested?

<!--
  - Did you run `cargo test`? `npx tsc --noEmit`? `npm run tauri build`?
  - Did you test on Linux / macOS / Windows? Which versions?
  - Manual test plan if applicable.
-->

- [ ] `cargo test` passes locally
- [ ] `npx tsc --noEmit` passes locally
- [ ] `npm run tauri build` passes locally
- [ ] Manually tested the affected feature

## Checklist — before requesting review

- [ ] Branch is `feat/US-NNNN-<slug>` or `fix/<short-slug>` and based on `dev`.
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
- [ ] **Version bumped** in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` (if applicable per the [Versioning policy](../CONTRIBUTING.md#versioning-policy)).
- [ ] **`CHANGELOG.md` updated** with an entry under the bumped version (Added / Changed / Fixed / Removed).
- [ ] No `// TODO` or `dbg!` / `console.log` left behind.
- [ ] Clean Architecture respected — only `TauriGitRepository.ts` imports `@tauri-apps/api`; new Git commands follow the 6-step recipe in `docs/add-command.md`.
- [ ] `git` CLI guard (`crate::git::git_available()`) used before any `Command::new("git")` if applicable.
- [ ] Documentation updated in `docs/specifications/` if behavior changed.
- [ ] No secrets, credentials, or personal data added.

## Screenshots / Recordings

<!-- Optional but appreciated for UI changes. Use a `<details>` block for long media. -->

## Additional notes

<!-- Anything reviewers should pay particular attention to: trade-offs, follow-ups, known gaps. -->
