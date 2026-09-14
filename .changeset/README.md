# Changesets

Add a changeset for changes to package behaviour or public APIs:

```sh
pnpm changeset
```

Select the affected packages and describe the change users will see.
Documentation-only edits do not normally need a release.

SPARQL and SRL are a fixed version group in
[config.json](config.json), because SRL depends on the SPARQL grammar.

For a spec revision, use a minor release and name the revision in the
changeset. See [development](../docs/development.md) for checks to run
before submitting a change.
