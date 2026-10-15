# CI templates

Copy-paste starting points for wiring `netiegraph` into your own project's CI. Each file is a
complete, working config — rename it into your project (see the comment at the top of each file
for the target path) and swap the smoke-test / test step for whatever your project does with
NetieGraph. Each template installs `netiegraph` unconditionally and your own project's dependencies
only if a `requirements.txt` is present; if your project uses `pyproject.toml`, Poetry, or Pipenv
instead, adjust the marked install line (each file calls it out inline).

| File | Target path in your repo |
| ---- | ------------------------- |
| [`github-actions.yml`](github-actions.yml) | `.github/workflows/netiegraph.yml` |
| [`gitlab-ci.yml`](gitlab-ci.yml) | `.gitlab-ci.yml` |
| [`circleci-config.yml`](circleci-config.yml) | `.circleci/config.yml` |

If your own project is hosted on GitHub, you can skip the setup boilerplate entirely and use
NetieGraph's reusable composite action instead:

```yaml
- uses: semantica-agi/semantica/.github/actions/setup-netiegraph@main
  with:
    python-version: '3.11'
    # extras: 'explorer,all'   # optional
    # version: '==0.6.7'       # optional, pin an exact release
    # cache: 'pip'             # optional, only if your repo has a requirements.txt/pyproject.toml/etc.
```

`@main` always tracks this repo's default branch, which is convenient but — like any mutable
ref — can change out from under you between runs. For production CI, pin it to a commit SHA
instead (find one via `git rev-parse` against a tagged release, or the commit history for
[`.github/actions/setup-netiegraph/`](../../.github/actions/setup-netiegraph/)) and update the pin
deliberately when you want to pick up changes, the same way this repo's own workflows are pinned
(see [`verify-action-pins.yml`](../../.github/workflows/verify-action-pins.yml)).

It installs Python, installs `netiegraph`, and verifies the import (pip caching is opt-in via `cache: 'pip'`, since not every caller repo has a requirements file to key the cache on) — see
[`.github/actions/setup-netiegraph/action.yml`](../../.github/actions/setup-netiegraph/action.yml).
