# Contributing

Thanks for your interest in improving this plugin! For the technical map of the
codebase, see [`AGENTS.md`](AGENTS.md).

## Local development

```sh
npm install
npm run build
npm test
```

- Source lives in `src/**/*.ts` — one entry file per half (`src/index.ts`,
  `src/client/index.ts`) states the surface, everything behind it is
  implementation detail; `lib/` is build output (`npm run clean` wipes it)
  and is never hand-edited.
- Tests are plain `node:assert` scripts (`test/*.test.mjs`) that drive the
  emitted `lib/client.js`, run through `npm test` (which builds first).
- End-to-end host behavior is exercised manually against a real DSH host —
  see *Smoke check* in [`AGENTS.md`](AGENTS.md).

## Releases (git-flow)

Setup git hook:

```sh
chmod +x .githooks/*
git config core.hooksPath .githooks
```

[Tag](https://semver.org/) and branch conventions:

| Item | Value |
| --- | --- |
| Development branch | `develop` |
| Master branch | `main` |
| Release branch | `release/X.Y.Z` |
| Version tag | `vX.Y.Z` |

### One-time setup per clone

The version in `package.json` is stamped automatically by a git hook when a `release/X.Y.Z` branch is created (see `.githooks/post-checkout`):

```bash
git config core.hooksPath .githooks
```

The hook derives `X.Y.Z` from the branch name, writes it to `package.json` and commits it, so the version is set before any release work starts. It is a no-op on all other branches and idempotent when re-checking out an existing release branch. If the hook is not active, do the bump manually on the release branch:

```bash
npm version X.Y.Z --no-git-tag-version
git commit -am "chore(release): version X.Y.Z"
```

### Release flow (Sourcetree or CLI)

1. **Start release** — `git flow release start X.Y.Z` (Sourcetree: *Git Flow → Start Release*). The version bump commit is created automatically by the `post-checkout` hook.
2. **Finish release** — `git flow release finish vX.Y.Z` (Sourcetree: *Git Flow → Finish Release*, tag name `vX.Y.Z`). Merges `release/X.Y.Z` into `main` and `develop` and tags the `main` merge commit.

    The tag name **must include the `v` prefix**: git-flow's default tag name is the bare `X.Y.Z`, which does not match the `v*` tag convention.
3. **Push** the tag (and the updated branches) to GitHub.
4. **Publish** — on a checkout of the `vX.Y.Z` tag: `npm publish`. The published package carries the version stamped by the hook in step 1 (`npm pkg get version`).
