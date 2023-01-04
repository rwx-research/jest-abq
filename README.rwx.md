# Releasing

## Bump version

```
node scripts/abqSetVersion 29.3.100-alpha.0
```

Commit the version change.

## Publish packages

Get a fresh checkout. Then, in order:

```
node scripts/abqPrepare.mjs   # set rwx-exposed versions of abq-patched jest packages
yarn         # update the lockfile to point to rwx-exposed versions
yarn build   # set rwx-exposed versions of abq-patched jest packages

# For each rwx-published package, IN ORDER:
#  packages/jest-runner
#  packages/jest-config
#  packages/jest-core
pushd <package>

# Dry run
yarn pack
# Inspect, remove contents of tarball
rm package.tgz

# Publish
yarn npm publish
```

Make sure not to check the artifacts here in.
