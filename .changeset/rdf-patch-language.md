---
'@kurrawongai/codemirror-lang-turtle12': minor
---

Add RDF Patch: `rdfPatch()`, `rdfPatchLanguage` and the `RdfPatchDoc` entry point. Rows take N-Quads terms. Tokens in `A` and `PA` rows carry the `inserted` highlight tag, and tokens in `D` and `PD` rows carry `deleted`, so a style can show a patch as a diff. A transaction folds between its `TX .` and `TC .` rows.
