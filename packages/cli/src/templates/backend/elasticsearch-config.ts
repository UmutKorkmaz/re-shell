import { BackendTemplate } from '../types';

export const elasticsearchConfigTemplate: BackendTemplate = {
  id: 'elasticsearch-config',
  name: 'elasticsearch-config',
  displayName: 'Elasticsearch Search Engine',
  description: 'Elasticsearch integration template with full-text search, aggregations, indexing, and Kibana dashboard',
  language: 'javascript',
  framework: 'elasticsearch',
  version: '1.0.0',
  tags: ['elasticsearch', 'search', 'indexing', 'analytics', 'kibana', 'fulltext'],
  port: 3000,
  dependencies: {},
  features: ['database', 'monitoring', 'connection-pooling'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "@elastic/elasticsearch": "^8.11.0",
    "express": "^4.18.2"
  }
}
`,

    'db/index.js': `import { Client } from '@elastic/elasticsearch';

const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';
const ES_USERNAME = process.env.ES_USERNAME || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD || 'password';

export const esClient = new Client({
  node: ES_NODE,
  auth: {
    username: ES_USERNAME,
    password: ES_PASSWORD
  },
  maxRetries: 3,
  requestTimeout: 30000
});

export async function checkConnection() {
  try {
    const info = await esClient.info();
    console.log('Elasticsearch connected:', info.name);
    return true;
  } catch (error) {
    console.error('Elasticsearch connection failed:', error.message);
    return false;
  }
}

// Create index
export async function createIndex(indexName, mappings = {}, settings = {}) {
  const exists = await esClient.indices.exists({ index: indexName });
  
  if (!exists) {
    await esClient.indices.create({
      index: indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          ...settings
        },
        mappings
      }
    });
    console.log(\`Index \${indexName} created\`);
  } else {
    console.log(\`Index \${indexName} already exists\`);
  }
}

// Index document
export async function indexDocument(indexName, id, document) {
  const result = await esClient.index({
    index: indexName,
    id,
    document: {
      ...document,
      indexedAt: new Date().toISOString()
    },
    refresh: true
  });
  
  console.log(\`Document \${id} indexed in \${indexName}\`);
  return result;
}

// Bulk index
export async function bulkIndex(indexName, documents) {
  const operations = documents.flatMap(doc => [
    { index: { _index: indexName, _id: doc.id } },
    doc
  ]);
  
  const result = await esClient.bulk({ refresh: true, operations });
  console.log(\`Bulk indexed \${documents.length} documents in \${indexName}\`);
  return result;
}

// Search
export async function search(indexName, query, options = {}) {
  const {
    size = 10,
    from = 0,
    sort = [{ _score: 'desc' }],
    aggregations = {},
    filters = {}
  } = options;
  
  const must = [];
  const boolQuery = { must };
  
  if (query) {
    boolQuery.must.push({
      multi_match: {
        query,
        fields: ['name^2', 'description', 'tags'],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    });
  }
  
  if (Object.keys(filters).length > 0) {
    Object.entries(filters).forEach(([field, value]) => {
      boolQuery.filter = [
        ...(boolQuery.filter || []),
        { term: { [field]: value } }
      ];
    });
  }
  
  const result = await esClient.search({
    index: indexName,
    size,
    from,
    sort,
    body: {
      query: { bool: boolQuery },
      ...(Object.keys(aggregations).length > 0 ? { aggregations } : {})
    }
  });
  
  return {
    total: result.hits.total.value,
    hits: result.hits.hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      ...hit._source
    })),
    aggregations: result.aggregations
  };
}

// Get document by ID
export async function getDocument(indexName, id) {
  const result = await esClient.get({
    index: indexName,
    id
  });
  return {
    id: result._id,
    ...result._source
  };
}

// Update document
export async function updateDocument(indexName, id, updates) {
  const result = await esClient.update({
    index: indexName,
    id,
    doc: {
      ...updates,
      updatedAt: new Date().toISOString()
    },
    refresh: true
  });
  return result;
}

// Delete document
export async function deleteDocument(indexName, id) {
  const result = await esClient.delete({
    index: indexName,
    id,
    refresh: true
  });
  return result;
}

// Aggregation query
export async function aggregate(indexName, aggregationQuery) {
  const result = await esClient.search({
    index: indexName,
    size: 0,
    body: {
      aggregations: aggregationQuery
    }
  });
  
  return result.aggregations;
}

// Suggestion/autocomplete
export async function getSuggestions(indexName, field, prefix, size = 10) {
  const result = await esClient.search({
    index: indexName,
    size,
    body: {
      query: {
        prefix: { [field]: prefix }
      }
    }
  });
  
  return result.hits.hits.map(hit => ({
    id: hit._id,
    ...hit._source
  }));
}
`,

    'db/indices/products.js': `export const productIndexSettings = {
  settings: {
    analysis: {
      analyzer: {
        english_snowball: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'english_stop', 'english_stemmer']
        }
      },
      filter: {
        english_stop: {
          type: 'stop',
          stopwords: '_english_'
        },
        english_stemmer: {
          type: 'snowball',
          language: 'English'
        }
      }
    }
  },
  mappings: {
    properties: {
      name: {
        type: 'text',
        analyzer: 'english_snowball',
        fields: {
          keyword: { type: 'keyword' },
          suggest: {
            type: 'completion',
            analyzer: 'simple'
          }
        }
      },
      description: {
        type: 'text',
        analyzer: 'english_snowball'
      },
      price: { type: 'double' },
      category: {
        type: 'keyword',
        fields: { text: { type: 'text' } }
      },
      tags: { type: 'keyword' },
      attributes: { type: 'object', enabled: false },
      inStock: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' }
    }
  }
};

export const productAggregations = {
  categories: {
    terms: { field: 'category.keyword', size: 20 }
  },
  priceRanges: {
    range: {
      field: 'price',
      ranges: [
        { to: 10, key: 'under-10' },
        { from: 10, to: 50, key: '10-to-50' },
        { from: 50, to: 100, key: '50-to-100' },
        { from: 100, key: 'over-100' }
      ]
    }
  },
  avgPrice: {
    avg: { field: 'price' }
  }
};
`,

    'db/indices/users.js': `export const userIndexSettings = {
  mappings: {
    properties: {
      email: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } }
      },
      name: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: { type: 'keyword' },
          suggest: {
            type: 'completion',
            analyzer: 'simple'
          }
        }
      },
      profile: { type: 'object', enabled: false },
      location: {
        type: 'geo_point'
      },
      createdAt: { type: 'date' }
    }
  }
};
`,

    'db/queries/search.js': `import { search, aggregate, getSuggestions } from '../index.js';

// Full-text search with pagination
export async function searchProducts(query, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    category,
    minPrice,
    maxPrice,
    inStock
  } = options;
  
  const filters = {};
  if (category) filters.category = category;
  if (inStock !== undefined) filters.inStock = inStock;
  
  const result = await search('products', query, {
    size: pageSize,
    from: (page - 1) * pageSize,
    filters,
    aggregations: {
      categories: {
        terms: { field: 'category.keyword' }
      },
      priceStats: {
        stats: { field: 'price' }
      }
    }
  });
  
  return {
    results: result.hits,
    total: result.total,
    aggregations: result.aggregations,
    page,
    pageSize,
    totalPages: Math.ceil(result.total / pageSize)
  };
}

// Faceted search
export async function facetedSearch(query, facets = {}) {
  const { category, tags, priceRange, sortBy = 'relevance' } = facets;
  
  const filters = {};
  if (category) filters.category = category;
  if (tags) filters.tags = tags;
  if (priceRange) {
    if (priceRange.min !== undefined) filters.price = { ...filters.price, gte: priceRange.min };
    if (priceRange.max !== undefined) filters.price = { ...filters.price, lte: priceRange.max };
  }
  
  const sortMap = {
    relevance: [{ _score: 'desc' }],
    price_asc: [{ price: 'asc' }],
    price_desc: [{ price: 'desc' }],
    name_asc: [{ 'name.keyword': 'asc' }]
  };
  
  return await search('products', query, {
    sort: sortMap[sortBy] || sortMap.relevance,
    filters
  });
}

// Autocomplete/suggestions
export async function getProductSuggestions(prefix, size = 10) {
  return await getSuggestions('products', 'name.suggest', prefix, size);
}

// Geo distance search
export async function searchNearby(latitude, longitude, distance = '10km') {
  const result = await esClient.search({
    index: 'users',
    body: {
      query: {
        bool: {
          must: {
            match_all: {}
          },
          filter: {
            geo_distance: {
              distance,
              location: {
                lat: latitude,
                lon: longitude
              }
            }
          }
        }
      }
    }
  });
  
  return result.hits.hits.map(hit => ({
    id: hit._id,
    ...hit._source,
    distance: hit.sort[0]
  }));
}
`,

    'index.js': `import express from 'express';
import { checkConnection, createIndex } from './db/index.js';
import { productIndexSettings } from './db/indices/products.js';
import { userIndexSettings } from './db/indices/users.js';
import { searchProducts, getProductSuggestions } from './db/queries/search.js';

const app = express();
app.use(express.json());

// Initialize Elasticsearch
await checkConnection();

// Create indices with mappings
await createIndex('products', productIndexSettings.mappings, productIndexSettings.settings);
await createIndex('users', userIndexSettings.mappings);

// Health check
app.get('/health', async (req, res) => {
  const connected = await checkConnection();
  res.json({ 
    status: connected ? 'healthy' : 'unhealthy',
    elasticsearch: connected ? 'connected' : 'disconnected'
  });
});

// Index document
app.post('/api/:index/documents', async (req, res) => {
  const { index } = req.params;
  const { id, document } = req.body;
  
  const result = await esClient.index({
    index,
    id,
    document,
    refresh: true
  });
  
  res.json({ success: true, result });
});

// Search endpoint
app.get('/api/products/search', async (req, res) => {
  const { q, page, pageSize, category, inStock } = req.query;
  
  const results = await searchProducts(q || '', {
    page: parseInt(page) || 1,
    pageSize: parseInt(pageSize) || 20,
    category,
    inStock: inStock === 'true' ? true : undefined
  });
  
  res.json(results);
});

// Autocomplete endpoint
app.get('/api/products/suggest', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.json({ suggestions: [] });
  }
  
  const suggestions = await getProductSuggestions(q, parseInt(limit));
  res.json({ suggestions });
});

// Aggregation endpoint
app.get('/api/products/aggregations', async (req, res) => {
  const result = await esClient.search({
    index: 'products',
    size: 0,
    body: {
      aggregations: {
        categories: {
          terms: { field: 'category.keyword', size: 50 }
        },
        priceRanges: {
          range: {
            field: 'price',
            ranges: [
              { to: 25, key: 'budget' },
              { from: 25, to: 75, key: 'mid-range' },
              { from: 75, key: 'premium' }
            ]
          }
        },
        avgRating: {
          avg: { field: 'rating' }
        }
      }
    }
  });
  
  res.json(result.aggregations);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Elasticsearch Demo Server on port \${PORT}\`));
`,

    'scripts/seed.js': `import { esClient, bulkIndex } from '../db/index.js';

async function seed() {
  console.log('Seeding Elasticsearch...');
  
  // Index products
  const products = [
    { id: '1', name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with precision tracking', price: 29.99, category: 'Electronics', tags: ['wireless', 'mouse', 'computer'], inStock: true },
    { id: '2', name: 'Mechanical Keyboard', description: 'Clicky mechanical keyboard with RGB backlight', price: 89.99, category: 'Electronics', tags: ['keyboard', 'gaming', 'rgb'], inStock: true },
    { id: '3', name: 'USB-C Hub', description: 'Multi-port USB-C hub with HDMI and power delivery', price: 49.99, category: 'Electronics', tags: ['usb-c', 'hub', 'accessories'], inStock: false },
    { id: '4', name: 'Office Chair', description: 'Ergonomic office chair with lumbar support', price: 199.99, category: 'Furniture', tags: ['chair', 'office', 'ergonomic'], inStock: true },
    { id: '5', name: 'Standing Desk', description: 'Adjustable height standing desk for better posture', price: 399.99, category: 'Furniture', tags: ['desk', 'standing', 'adjustable'], inStock: true }
  ];
  
  await bulkIndex('products', products);
  console.log(\`Indexed \${products.length} products\`);
  
  // Index users
  const users = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', profile: { role: 'admin' }, location: { lat: 37.7749, lon: -122.4194 } },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com', profile: { role: 'user' }, location: { lat: 37.7849, lon: -122.4094 } },
    { id: '3', name: 'Carol Williams', email: 'carol@example.com', profile: { role: 'user' }, location: { lat: 37.7649, lon: -122.4294 } }
  ];
  
  await bulkIndex('users', users);
  console.log(\`Indexed \${users.length} users\`);
  
  console.log('Seed complete!');
  
  await esClient.close();
}

seed().catch(console.error);
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ES_NODE=http://elasticsearch:9200
      - ES_USERNAME=elastic
      - ES_PASSWORD=password
    depends_on:
      - elasticsearch
    restart: unless-stopped

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    ports:
      - "9200:9200"
      - "9300:9300"
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=password
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    restart: unless-stopped

  # Kibana
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=elastic
      - ELASTICSEARCH_PASSWORD=password
    depends_on:
      - elasticsearch
    restart: unless-stopped

volumes:
  elasticsearch_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# Elasticsearch Configuration
ES_NODE=http://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=password

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

Elasticsearch search engine integration template with full-text search, aggregations, and Kibana dashboard.

## Features

- **Full-Text Search**: Powerful text search with analyzers and stemming
- **Aggregations**: Faceted search, statistics, and analytics
- **Autocomplete**: Type-ahead suggestions for better UX
- **Geo Search**: Location-based queries with distance filtering
- **Index Management**: Automatic index creation with mappings
- **Kibana Integration**: Visual dashboard for data exploration

## Quick Start

\\\`\\\`\\\`bash
# Start Elasticsearch and Kibana
docker-compose up -d

# Seed data
npm run seed

# Start server
npm start
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

## API Endpoints

### Search Products
\\\`\\\`\\\`bash
GET /api/products/search?q=wireless&page=1&pageSize=20
\\\`\\\`\\\`

### Autocomplete
\\\`\\\`\\\`bash
GET /api/products/suggest?q=mou&limit=10
\\\`\\\`\\\`

### Aggregations
\\\`\\\`\\\`bash
GET /api/products/aggregations
\\\`\\\`\\\`

## License

MIT
`
  }
};
