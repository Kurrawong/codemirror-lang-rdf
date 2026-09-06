/**
 * One sample document per language, each written to show the 1.2 vocabulary
 * that a 1.1 grammar cannot see.
 *
 * They double as the thing you edit to check a grammar change by hand, so each
 * one is a plausible document rather than a list of constructs: the point is to
 * see the additions *in* something, next to the ordinary syntax they sit
 * beside.
 */
export interface Sample {
  label: string;
  mediaType: string;
  doc: string;
}

export const SAMPLES = {
  turtle: {
    label: 'Turtle',
    mediaType: 'text/turtle',
    doc: `# RDF 1.2 Turtle. Try folding the [ … ] and the ( … ).
VERSION "1.2"
PREFIX ex:   <http://example.org/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
@prefix dct: <http://purl.org/dc/terms/> .

ex:mona-lisa
  a               ex:Painting ;
  dct:title       "La Joconde"@fr , "Mona Lisa"@en ;
  ex:description  "الموناليزا"@ar--rtl ;
  ex:height       77.0 ;
  ex:width        "53"^^xsd:decimal ;
  ex:onDisplay    true ;
  ex:painter      [ a ex:Person ; ex:name "Leonardo" ] ;
  ex:pigments     ( ex:lead-white ex:vermilion ex:ochre ) .

# A reified triple: the statement itself is a subject.
<< ex:mona-lisa ex:painter ex:leonardo >>
  dct:source  ex:vasari ;
  ex:certain  true .

# The same thing as an inline annotation, with a named reifier.
ex:mona-lisa ex:painter ex:leonardo ~ex:attribution {|
  dct:source ex:vasari ;
  ex:certain true
|} .

# A triple term: an object that *is* a triple, not a statement about one.
ex:vasari ex:asserts <<( ex:mona-lisa ex:painter ex:leonardo )>> .
`,
  },

  trig: {
    label: 'TriG',
    mediaType: 'application/trig',
    doc: `# RDF 1.2 TriG. Each graph block folds on its own.
PREFIX ex:  <http://example.org/>
PREFIX dct: <http://purl.org/dc/terms/>

GRAPH ex:louvre {
  ex:mona-lisa  a          ex:Painting ;
                dct:title  "Mona Lisa"@en .
}

ex:vasari {
  ex:mona-lisa ex:painter ex:leonardo ~ex:claim {| dct:date "1550" |} .

  # A triple term is an object, never a subject — Turtle [10] has no
  # tripleTerm in \`subject\`. Move it to the front and the editor says so.
  ex:vasari ex:asserts <<( ex:mona-lisa ex:painter ex:leonardo )>> .
}

# The default graph needs no label.
{
  ex:louvre  a  ex:Museum .
}
`,
  },

  ntriples: {
    label: 'N-Triples',
    mediaType: 'application/n-triples',
    doc: `# RDF 1.2 N-Triples: a strict subset with its own entry point.
# A prefixed name or a ";" list here is an error, not a tolerated shorthand —
# uncomment the last line to see it flagged.
<http://example.org/mona-lisa> <http://purl.org/dc/terms/title> "Mona Lisa"@en .
<http://example.org/mona-lisa> <http://example.org/description> "الموناليزا"@ar--rtl .
<http://example.org/vasari> <http://example.org/asserts> <<( <http://example.org/mona-lisa> <http://example.org/painter> <http://example.org/leonardo> )>> .
_:b0 <http://example.org/note> "blank subjects are fine" .

# ex:mona-lisa ex:painter ex:leonardo .
`,
  },

  nquads: {
    label: 'N-Quads',
    mediaType: 'application/n-quads',
    doc: `# RDF 1.2 N-Quads: N-Triples plus a graph label.
<http://example.org/mona-lisa> <http://purl.org/dc/terms/title> "Mona Lisa"@en <http://example.org/louvre> .
<http://example.org/mona-lisa> <http://example.org/height> "77.0"^^<http://www.w3.org/2001/XMLSchema#decimal> <http://example.org/louvre> .
<http://example.org/vasari> <http://example.org/asserts> <<( <http://example.org/mona-lisa> <http://example.org/painter> <http://example.org/leonardo> )>> _:g1 .
`,
  },

  sparql: {
    label: 'SPARQL 1.2 (query)',
    mediaType: 'application/sparql-query',
    doc: `# SPARQL 1.2. Keywords are case-insensitive and not reserved:
# ?select is a variable and select:p would be a prefixed name.
VERSION "1.2"
PREFIX ex:   <http://example.org/>
PREFIX dct:  <http://purl.org/dc/terms/>

SELECT ?painting ?title (COUNT(?source) AS ?sources)
WHERE {
  ?painting a ex:Painting ;
            dct:title ?title .

  # A reified triple in a pattern, with its reifier bound to a variable.
  # The reifier goes inside the << >>; an annotation would follow an object.
  << ?painting ex:painter ?painter ~?claim >> dct:source ?source .

  # A triple term in an expression, and the 1.2 term built-ins.
  BIND( <<( ?painting ex:painter ?painter )>> AS ?statement )
  FILTER( isTRIPLE(?statement) && SUBJECT(?statement) = ?painting )

  # Directional language tags have their own accessors.
  OPTIONAL {
    ?painting ex:description ?text .
    FILTER( hasLANGDIR(?text) && LANGDIR(?text) = "rtl" )
  }

  ?painting ex:influencedBy+/ex:school ?school .

  VALUES (?school ?era) {
    ( ex:florentine "renaissance" )
    ( ex:venetian   UNDEF )
  }
}
GROUP BY ?painting ?title
HAVING (COUNT(?source) > 1)
ORDER BY DESC(?sources)
LIMIT 10
`,
  },

  'sparql-update': {
    label: 'SPARQL 1.2 (update)',
    mediaType: 'application/sparql-update',
    doc: `# The same grammar covers update. A trailing ";" is allowed; ";;" is not.
PREFIX ex:  <http://example.org/>
PREFIX dct: <http://purl.org/dc/terms/>

INSERT DATA {
  GRAPH ex:louvre {
    ex:mona-lisa a ex:Painting ;
                 dct:title "Mona Lisa"@en .
    <<( ex:mona-lisa ex:painter ex:leonardo )>> dct:source ex:vasari .
  }
} ;

WITH ex:louvre
DELETE { ?painting ex:status "draft" }
INSERT { ?painting ex:status "published" }
WHERE  { ?painting a ex:Painting ; ex:status "draft" } ;

COPY GRAPH ex:louvre TO ex:archive ;
DROP SILENT GRAPH ex:staging
`,
  },

  srl: {
    label: 'SRL',
    mediaType: 'application/srl',
    doc: `# SRL, on the same grammar as SPARQL — entered at a second @top rule,
# so a term can never mean two things. Note ":=" is one token.
PREFIX ex:   <http://example.org/>
PREFIX dct:  <http://purl.org/dc/terms/>

DATA {
  ex:mona-lisa  a          ex:Painting ;
                ex:height  77.0 ;
                ex:width   53.0 .
}

RULE ex:area {
  ?painting ex:area ?area
}
WHERE {
  ?painting a ex:Painting ;
            ex:height ?h ;
            ex:width  ?w .
  SET ( ?area := ?h * ?w )
}

RULE ex:unattributed {
  ?painting ex:needsAttribution true
}
WHERE {
  ?painting a ex:Painting .

  # Bare NOT is SRL's negation. It does not collide with NOT EXISTS or NOT IN.
  NOT DATA { ?painting ex:painter ?anyone }
  FILTER( ?painting NOT IN ( ex:unknown-work ) )
}

# The rule-tuples extension. Switch it off in the toolbar to see the grammar
# still parse it while the editor stops recommending it.
RULE {
  TUPLE( ?painting, ?area )
}
WHERE {
  ?painting ex:area ?area .
  FILTER( ?area > 1000 )
}
`,
  },
} as const satisfies Record<string, Sample>;

export type LanguageKey = keyof typeof SAMPLES;

export const LANGUAGE_KEYS = Object.keys(SAMPLES) as LanguageKey[];
