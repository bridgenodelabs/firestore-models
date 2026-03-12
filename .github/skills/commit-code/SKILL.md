---
name: commit-code
description: 'Create a clean git commit for the current branch. Use when a user or agent needs to check status, summarize changes, decide if the work should be split, and draft conventional commit messages.'
argument-hint: 'Optional: focus area or issue ID (e.g., "issue: 1234" or "docs")'
---

# Commit Code

Create a clear, scoped commit on the current local branch with a short summary of the work.

## When to Use

- You need to commit local changes on the current branch.
- You want a quick, repeatable checklist for staging, splitting, and messaging.

## Procedure

1. Check status to see if there are uncommitted changes.
   - Run: `git status -sb`
2. Summarize the current changes in bullets (max 60 lines).
   - Use `git diff --stat` for uncommitted changes.
   - Use `git log --stat -1` to summarize the most recent committed changes on this branch for context.
   - Output a bullet list, keeping it under 60 lines total.
3. Decide if the changes should be split.
   - if there are major features or fixes that can be logically separated, consider splitting into multiple commits for clarity.
   - If more than 10 files changed or more than 1000 lines changed, consider splitting into two commits.
   - If unsure, ask the user or calling agent before splitting.
4. Review new files to decide whether to add or ignore.
   - If a file looks like a new feature or documentation, stage it.
   - If a path or name includes `.log`, `.env`, `temp`, `temporary`, `api_key`, or `key`, consider adding it to `.gitignore` instead.
   - Ask the user or calling agent if there is any doubt.
5. Stage changes intentionally.
   - Prefer `git add -p` to split related changes.
   - Use `git add <path>` for straightforward additions.
6. Draft commit message options using the standard format.
   - First line format: `(type): summary of change`
   - Allowed types: `(feat):`, `(issue: XXXX):`, `(docs):`, `(test):`
   - Generate 3-5 sample messages tailored to the summary.
7. Confirm with the user or calling agent before running `git commit`.

## Commit Message Examples

- `(feat): add parent recall grouping rules`
- `(issue: 1234): handle missing manufacturer IDs`
- `(docs): clarify yearly recall pipeline steps`
- `(test): add coverage for recall normalization`

## Output Expectations

- A short bullet summary of changes (max 60 lines).
- A recommendation on whether to split the commit.
- 3-5 commit message samples using the standard format.
- A prompt asking for confirmation before committing.
