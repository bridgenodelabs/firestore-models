# Plan: Publish firestore-models via GitHub Actions

Two-phase approach: harden package identity locally with bmc before org migration, then complete the publish pipeline afterward.

---

## PHASE A: Prepare for Local Testing (Before Testing with bmc)

Setup the package identity and quality gates without moving the organization yet. This prepares hygiene that makes local testing realistic.

### A1. Transfer repository ownership

**Transfer the GitHub repository** from toddwseattle/firestore-type to bridgenodelabs/firestore-models. This determines repository URLs, org secrets, and workflow permissions for the final home. Update org access accordingly.

### A2. Set up npm organization scope

**Create or verify npm organization scope access** for @bridgenodelabs and ensure the publishing identity (human or automation) has publish rights for that scope. This is independent of the GitHub org transfer.

### A3. Lock release model

**Decide and lock release model:** tag-driven publish on push of version tags (vX.Y.Z) with immutable releases; no manual local publish path in the primary runbook.

### A4. Update package.json metadata (minimal set for local testing)

In package.json:

- Change `name` to `@bridgenodelabs/firestore-models`
- Set `author` to your name/email
- Add `repository`: `{ "type": "git", "url": "https://github.com/bridgenodelabs/firestore-models" }`
- Add `homepage`: `"https://github.com/bridgenodelabs/firestore-models"`
- Add `bugs`: `{ "url": "https://github.com/bridgenodelabs/firestore-models/issues" }`
- Add `engines`: `{ "node": ">=18.0.0", "pnpm": ">=9" }`
- Add `packageManager`: `"pnpm@9.0.0"`

### A5. Add prepublishOnly quality gate script

Add to package.json scripts:

```json
{
  "scripts": {
    "prebuild": "rm -rf dist",
    "prepublishOnly": "pnpm run lint && pnpm run test && pnpm run build"
  }
}
```

This ensures test/lint/build pass before any publish attempt.

### A6. Create .npmignore for package boundaries

Create a new `.npmignore` file in the repo root:

```
.claude/
docs/
samples/
pnpm-lock.yaml
.gitignore
.git/
.github/
.vscode/
*.test.ts
vitest.config.ts
tsup.config.ts
tsconfig.json
plan-*.prompt.md
*.debug.log
```

This excludes dev/docs artifacts while keeping dist/ and agents/ (implicitly included via package.json "files" array).

### Verification before local testing

1. `pnpm run build` succeeds and rebuilds dist/
2. `pnpm run test` passes
3. `pnpm run lint` passes
4. `npm pack --dry-run` shows only dist/, agents/, package.json, README.md, LICENSE (no docs/, samples/, .claude/)

---

## PHASE B: Local Testing with bmc

Validate library integration and behavior with a real consumer project using local file references.

### Setup

1. **Add bmc as a sibling directory** to firestore-models (or note its current path):

   ```
   /Users/toddwseattle/dev/
     firestore-models/
     bmc/
   ```

2. **In bmc/package.json**, reference firestore-models as a local file dependency:

   ```json
   {
     "dependencies": {
       "firestore-models": "file:../firestore-models"
     }
   }
   ```

3. **Install and link:**
   ```bash
   cd /Users/toddwseattle/dev/bmc
   pnpm install
   ```
   pnpm will create a local symlink to firestore-models's working directory.

### Development Workflow

- Make changes in firestore-models/src
- Run `pnpm run build` in firestore-models to rebuild dist/
- bmc automatically picks up changes (no reinstall needed)
- Test your changes in bmc with `pnpm run build` or dev server

### Validation During Local Testing

- Verify all bmc compilation passes with the local firestore-models
- Run bmc tests if applicable
- Confirm subpath imports (core, time, react, adapters) work as expected
- Check that bundled output size and tree-shaking is reasonable

---

## PHASE C: Complete Publish Pipeline After Local Validation

After bmc testing succeeds, harden the automation pipeline for production releases.

### C1. Verify agents inclusion

**Keep agents included** by confirming package.json "files" array includes both dist/ and agents/, then validate tarball contents to ensure no accidental artifacts are shipped:

```bash
npm pack --dry-run
# Confirm dist/ and agents/ are present
# Confirm docs/, samples/, .claude/ are absent
```

### C2. Add CI workflow

Create `.github/workflows/ci.yml`:

- Triggered on pull_request and push to main
- Install with pnpm
- Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`
- Optionally run `npm pack --dry-run` to verify tarball integrity
- Fail the workflow if any check fails

### C3. Add publish workflow

Create `.github/workflows/publish.yml`:

- Triggered by version tags (e.g., `v0.1.0`)
- Checkout, setup Node.js + pnpm
- Install dependencies
- Run full verification pipeline (lint, test, build)
- Publish to npm scope @bridgenodelabs with `--access=public`

### C4. Configure org/repo settings for publishing security

- Set least-privilege workflow permissions (read-only by default, explicit allowlist for publish workflow)
- Configure npm provenance/trusted publishing with GitHub OIDC (preferred), or use scoped NPM_TOKEN secret as fallback
- Enable required branch protections for main branch
- Protect release tags (prevent accidental overwrites)

### C5. Commit and merge pipeline changes to main

All Phase A and C changes should be committed to a branch, reviewed, and merged to main before attempting the first release.

---

## PHASE D: First Release

### D1. Bump version and push release tag

In firestore-models repo:

```bash
# Update version in package.json (e.g., 0.1.0)
pnpm version patch  # or minor/major

# This creates a commit and a git tag
# Push both
git push origin main
git push origin v0.1.0  # adjust tag name to match
```

Or manually:

```bash
# Edit package.json version field to 0.1.0
git add package.json
git commit -m "chore: release 0.1.0"
git tag v0.1.0
git push origin main v0.1.0
```

### D2. Monitor publish workflow

- Watch the GitHub Actions workflow triggered by the tag push
- Verify lint, test, build, and publish steps all pass
- Check npm registry: https://www.npmjs.com/package/@bridgenodelabs/firestore-models

### D3. Verify published package

```bash
npm view @bridgenodelabs/firestore-models@0.1.0
npm dist-info @bridgenodelabs/firestore-models@0.1.0  # see tarball contents
```

### D4. Validate from a clean consumer project

In a new throwaway project:

```bash
pnpm add @bridgenodelabs/firestore-models@0.1.0

# Test imports
pnpm add -D @types/node

# Create test.ts
cat > test.ts << 'EOF'
import { defineModel, readDomain } from "@bridgenodelabs/firestore-models/core";
import { dateFromTimestamp } from "@bridgenodelabs/firestore-models/time";
import { readDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-client";

console.log("✓ All imports work");
EOF

npx tsc --noEmit test.ts
```

### D5. Update README.md

Update the install section to reflect the new scoped package name:

```bash
pnpm add @bridgenodelabs/firestore-models
```

Also update peer dependency examples:

```bash
pnpm add firebase
pnpm add @bridgenodelabs/firestore-models
```

### D6. Final cleanup

After first successful publish:

1. **Update README.md** to reflect @bridgenodelabs/firestore-models namespace
2. **Remove test-fb-app branch** (or any development branches) once main is stable
3. **Archive or remove any .claude/ or local dev notes** that were temporary

---

## Switch bmc from local to published package

Once D1-D4 complete and package is published on npm, switch bmc:

### Update bmc

1. **Remove local file reference**:

   ```bash
   pnpm remove firestore-models
   ```

2. **Install from npm**:

   ```bash
   pnpm add @bridgenodelabs/firestore-models
   ```

3. **Verify resolution**:

   ```bash
   pnpm list @bridgenodelabs/firestore-models
   # Should show version from npm registry, not "file:"
   ```

4. **Test imports still work**:

   ```bash
   pnpm run build
   # Confirm no import errors
   ```

5. **Optional: lock version**:
   ```json
   {
     "dependencies": {
       "@bridgenodelabs/firestore-models": "^0.1.0"
     }
   }
   ```

---

## Quick Reference: Relevant Files

**Phase A (Prep for local testing):**

- package.json — name, author, repository, homepage, bugs, engines, packageManager, scripts

**Phase B (Local testing):**

- bmc/package.json — add firestore-models local reference

**Phase C (Publish automation):**

- .npmignore (new) — artifact exclusion
- .github/workflows/ci.yml (new) — quality gates
- .github/workflows/publish.yml (new) — release automation

**Phase D (First release):**

- package.json — version field
- README.md — install/import docs
- Git tags — vX.Y.Z

---

## Decision Summary

- **Include agents in published package:** yes
- **Release model:** tag-driven automation only (no manual local publish)
- **Package namespace:** @bridgenodelabs/firestore-models (scoped)
- **Auth method:** Prefer GitHub OIDC trusted publishing over long-lived token
- **Repo transfer:** From toddwseattle/firestore-type to bridgenodelabs/firestore-models
- **Local testing:** Use bmc as consumer before org migration

---

## Recommended Best Practices

1. **Versioning:** adopt Conventional Commits and automate changelog/release-note generation to reduce release friction.

2. **Protected branches:** require status checks on main; protect release tags from accidental overwrites.

3. **Local file references:** pnpm treats `file:` dependencies as symlinks, so repeated testing across bmc works smoothly without manual reinstalls.

4. **Tarball validation:** always run `npm pack --dry-run` before publishing to catch unintended artifacts.

5. **Registry double-check:** after publish, verify package page on npmjs.com includes correct metadata, dist-tags, and provenance status.
