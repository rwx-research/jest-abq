# Releasing

## Bump version

Update the root `version` in `abq.json`:

```json
{
  "version": "29.4.100",
  "packages": [ ... ]
}
```

Commit the version change in a branch and apply via pull request.

## Publish packages

**After** merging a PR with a version change, checkout `main` and tag:

```bash
git tag v29.4.100
git push --tags
```

The `abq-release` GitHub Actions workflow will build and publish to NPM.
