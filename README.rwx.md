# Releasing

## Bump version

```
node scripts/abqSetVersion 29.3.100-alpha.0
```

Commit the version change.

## Publish packages

Get a fresh checkout. Then, in order:

```
yarn
yarn build
node scripts/abqPrepare.mjs
yarn

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
