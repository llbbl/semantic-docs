---
title: Semantic Search - AI-Powered Search
tags: [semantic-search, embeddings, ai, vector-search]
---

# Semantic Search - AI-Powered Search

Semantic search uses AI to understand the *meaning* of queries and documents, not just keywords. It's powered by vector embeddings that represent text as points in high-dimensional space, enabling searches based on conceptual similarity.

## How Semantic Search Works

### Vector Embeddings

Text is converted to high-dimensional vectors (arrays of numbers):

```javascript
// Text to embedding
"javascript async programming" → [0.2, 0.8, 0.1, ..., 0.4]  // 384 dimensions

// Similar concepts have similar vectors
"javascript async programming" → [0.2, 0.8, 0.1, ..., 0.4]
"js asynchronous code"         → [0.3, 0.7, 0.2, ..., 0.5]  // Close in vector space

// Different concepts are far apart
"javascript async programming" → [0.2, 0.8, 0.1, ..., 0.4]
"cooking pasta recipes"        → [0.9, 0.1, 0.8, ..., 0.2]  // Far in vector space
```

### Cosine Similarity

Measures how similar two vectors are:

```javascript
// Calculate similarity (-1 to 1, higher is more similar)
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Example
queryVector = [0.2, 0.8, 0.1];
doc1Vector  = [0.3, 0.7, 0.2];  // similarity: 0.95 (very similar)
doc2Vector  = [0.9, 0.1, 0.8];  // similarity: 0.20 (not similar)
```

### Search Process

1. **Indexing** (done once):
```javascript
// Convert documents to embeddings
const documents = [
  "How to deploy a JavaScript application",
  "Deploying apps to production servers",
  "Best practices for async JavaScript"
];

const embeddings = await Promise.all(
  documents.map(doc => generateEmbedding(doc))
);

// Store in database with vector index
await db.execute(`
  INSERT INTO articles (content, embedding)
  VALUES (?, vector(?))
`, [documents[0], embeddings[0]]);
```

2. **Searching** (realtime):
```javascript
// User query
const query = "how do I push my app to production?";

// Convert query to embedding
const queryEmbedding = await generateEmbedding(query);

// Find similar documents
const results = await db.execute(`
  SELECT
    content,
    vector_distance_cos(embedding, vector(?)) as similarity
  FROM articles
  ORDER BY similarity DESC
  LIMIT 10
`, [queryEmbedding]);

// Results ranked by semantic similarity:
// 1. "Deploying apps to production servers" (0.89)
// 2. "How to deploy a JavaScript application" (0.82)
// 3. "Best practices for async JavaScript" (0.45)
```

## Embedding Generation

### Repo Default

semantic-docs delegates embedding generation to libsql-search. The current repo
configuration uses `provider: 'local'` with 384-dimension vectors, while
keeping the provider implementation out of the application code. The repo
depends on that contract, not on a specific underlying embedding engine:

```typescript
import { generateEmbedding } from '@logan/libsql-search';

const embedding = await generateEmbedding('javascript async programming', {
  provider: 'local',
  dimensions: 384,
});

console.log(embedding); // [0.123, -0.456, 0.789, ...]
```

## Implementation in semantic-docs

### Indexing Content

Simplified example of the indexing flow. The real implementation also uses
shared constants from `src/lib/searchConfig.ts` and routes the work through
`runContentIndexing`:

```typescript
// Simplified example
import { createTable, indexContent } from '@logan/libsql-search';
import { getTursoClient } from '../src/lib/turso';

const client = getTursoClient();
await createTable(client, 'articles_local_384', 384);

await indexContent({
  client,
  contentPath: './content',
  tableName: 'articles_local_384',
  embeddingOptions: {
    provider: 'local',
    dimensions: 384,
  },
});
```

### Searching

Simplified example of the semantic search call. The real
`src/pages/api/search.json.ts` also validates input, applies rate limiting,
uses centralized constants, and returns the current API response shape:

```typescript
// Simplified example
import { search } from '@logan/libsql-search';
import { getTursoClient } from '../../lib/turso';

export async function POST({ request }) {
  const { query } = await request.json();
  const client = getTursoClient();

  const results = await search({
    client,
    query,
    limit: 10,
    tableName: 'articles_local_384',
    embeddingOptions: {
      provider: 'local',
      dimensions: 384,
    },
  });

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Semantic vs Full-Text Search

### Example Queries

**Query: "how do I deploy my app?"**

Full-Text Search:
```sql
-- Looks for keywords: "deploy", "app"
SELECT * FROM articles
WHERE content LIKE '%deploy%' AND content LIKE '%app%';

-- Results (keyword matching):
1. "Deploy your application to production"
2. "App deployment best practices"
3. "Deploying Docker apps"
```

Semantic Search:
```typescript
// Understands: user wants to publish/release software
const results = await search({
  client,
  query: 'how do I deploy my app?',
  tableName: 'articles_local_384',
  limit: 10,
  embeddingOptions: {
    provider: 'local',
    dimensions: 384,
  },
});

// Results (meaning-based):
1. "Pushing to production servers" (0.91 similarity)
2. "Publishing your application" (0.88)
3. "CI/CD deployment pipelines" (0.85)
4. "Deploy your application to production" (0.83)
```

### Feature Comparison

| Feature | Full-Text | Semantic |
|---------|-----------|----------|
| **Speed** | 10-20ms | 50-100ms |
| **Setup** | Built-in DB | Requires embeddings |
| **Synonyms** | Manual dictionary | Automatic |
| **Typos** | Poor | Better |
| **Concept match** | No | Yes |
| **Natural queries** | Poor | Excellent |
| **Resource usage** | Low | Medium |
| **Index size** | Small | Large |

## Benefits of Semantic Search

### 1. Understanding Synonyms
```javascript
// Query: "car"
// Full-text: Only finds "car"
// Semantic: Finds "car", "automobile", "vehicle", "auto"
```

### 2. Natural Language
```javascript
// Query: "how to make my site faster?"
// Full-text: "how", "to", "make", "my", "site", "faster"
// Semantic: Understands user wants performance optimization
//          Finds "speed up website", "optimize performance", etc.
```

### 3. Conceptual Understanding
```javascript
// Query: "best laptop for coding"
// Full-text: Finds documents with those exact words
// Semantic: Understands "laptop for coding" = "developer laptop",
//          "programming computer", "development machine"
```

### 4. Typo Tolerance
```javascript
// Query: "javascrpt async"  (typo)
// Full-text: No results (exact match only)
// Semantic: Still finds JavaScript async content (similar embedding)
```

### 5. Cross-Language Concepts
```javascript
// Query in English: "error handling"
// Can find similar concepts even if expressed differently
// "exception management", "dealing with failures", etc.
```

## Limitations

### 1. Slower Than Full-Text
```
Full-text search:  10ms
Semantic search:   50-100ms

Reason: Vector distance calculations and embedding generation are more
expensive than keyword-only matching
```

### 2. Requires Vector Index
```sql
-- LibSQL/SQLite
CREATE INDEX idx_embedding ON articles(libsql_vector_idx(embedding));

-- Index size for 10,000 documents with 384-dim embeddings:
-- ~15 MB (vs 5 MB for full-text index)
```

### 3. Cold Start Problem
```javascript
// First query in a fresh process or cache
const embedding = await generateEmbedding(query);
// Often slower while the configured provider warms up

// Subsequent queries
const embedding2 = await generateEmbedding(query2);
// Usually faster once provider resources are ready
```

### 4. Context Window Limits
```javascript
// Most models have token limits
const maxTokens = 512;  // ~400 words

// Long documents need chunking
const chunks = splitIntoChunks(longDocument, maxTokens);
const embeddings = await Promise.all(
  chunks.map(chunk => generateEmbedding(chunk))
);
```

### 5. Exact Match Can Be Worse
```javascript
// Query: "React.useState"
// Full-text: Finds exact "React.useState"
// Semantic: Might return general React state management docs
//          (less precise for exact API names)
```

## Hybrid Search (Best of Both)

Combine full-text and semantic search:

```typescript
async function hybridSearch(query: string) {
  // Full-text search
  const fulltextResults = await db.execute(`
    SELECT id, ts_rank(search_vector, to_tsquery(?)) * 2 as score
    FROM articles
    WHERE search_vector @@ to_tsquery(?)
  `, [query, query]);

  // Semantic search
  const queryEmbedding = await generateEmbedding(query);
  const semanticResults = await db.execute(`
    SELECT id, vector_distance_cos(embedding, vector(?)) as score
    FROM articles
    ORDER BY score DESC
    LIMIT 20
  `, [queryEmbedding]);

  // Merge and re-rank
  const combined = mergeResults(fulltextResults, semanticResults);

  return combined.sort((a, b) => b.totalScore - a.totalScore);
}
```

### When to Use Hybrid

- **Technical documentation**: Exact API names (full-text) + concepts (semantic)
- **E-commerce**: Product codes (full-text) + descriptions (semantic)
- **Code search**: Function names (full-text) + purpose (semantic)

## Embeddings

### Repo Default
```typescript
// Pros: No extra embedding credentials in the bundled setup
// Tradeoff: Latency and resource cost depend on the configured provider

import { generateEmbedding } from '@logan/libsql-search';

const embedding = await generateEmbedding(text, {
  provider: 'local',
  dimensions: 384,
});
```


## Use Cases

### ✅ Excellent For
- **Documentation search**: Natural language queries
- **Customer support**: Find relevant help articles
- **Content discovery**: "More like this" recommendations
- **Question answering**: Match questions to answers
- **Knowledge bases**: Conceptual search across docs

### ⚠️ Consider Alternatives
- **Exact code search**: Use full-text or grep
- **Product SKUs**: Use full-text or database queries
- **Date/numeric filtering**: Use traditional indexes
- **Very large scale**: Specialized vector databases (Pinecone, Weaviate)

## Resources

- **libsql-search**: [github.com/llbbl/libsql-search](https://github.com/llbbl/libsql-search)
- **Sentence Transformers**: [sbert.net](https://www.sbert.net/)
- **Vector Search Explained**: [pinecone.io/learn/vector-database](https://www.pinecone.io/learn/vector-database/)
