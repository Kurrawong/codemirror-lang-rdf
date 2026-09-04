# Changesets

Every change that affects a published package needs a changeset:

```
pnpm changeset
```

`codemirror-lang-sparql12` and `codemirror-lang-srl` are a **fixed** group.
They share one grammar — SRL is `parser.configure({ top: 'SrlUnit' })` on the
SPARQL parser — so a grammar change that bumps one has to bump the other, and a
released pair that disagreed about a term would be worse than no release.

A spec revision counts as a minor release with a changelog entry naming the
revision, per §8 of the plan: both SPARQL 1.2 and RDF 1.2 are still Working
Drafts, and a reader needs to know which one a version was built against.
