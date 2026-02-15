# Discovery Flow Documentation

## Overview

The Discovery Flow is Vitesse AI's search-first approach to integration creation. Instead of requiring users to provide exact API URLs, they can search for APIs using natural language queries and let the Discovery Agent find the right specifications.

## Architecture

### Discovery Agent

The `VitesseDiscoveryAgent` is responsible for finding and validating API specifications based on user queries.

**Location**: `backend/app/agents/discovery.py`

**Key Features**:
- **Curated Catalog**: Pre-configured popular APIs and Linedata products
- **LLM Fallback**: Uses structured LLM calls for unknown APIs
- **Confidence Scoring**: Ranks results by reliability (catalog: 95%, LLM: ~85%)
- **Tag-based Search**: Supports category-based discovery

### Known API Catalog

The agent maintains a catalog of commonly integrated APIs:

**External APIs**:
- Shopify Admin API
- Stripe API
- GitHub REST API
- CoinGecko API
- Petstore API (demo)

**Linedata Products** (Common Destinations):
- CapitalStream (asset management, portfolio)
- Longview (tax, compliance, reporting)
- Ekip (insurance, policy management)
- MFEX (fund accounting, transfer agency)

## API Endpoint

### `GET /vitesse/discover`

Search for APIs based on natural language queries.

**Query Parameters**:
- `query` (required): Search term (e.g., "Shopify", "payment APIs")
- `limit` (optional): Maximum results to return (default: 5, max: 20)

**Response**:
```json
{
  "status": "success",
  "query": "shopify",
  "results": [
    {
      "api_name": "Shopify Admin API",
      "description": "Official Shopify Admin API - ecommerce, retail, payments",
      "documentation_url": "https://shopify.dev/api/admin-rest",
      "spec_url": "https://shopify.dev/admin-api-reference.json",
      "base_url": "https://{shop}.myshopify.com/admin/api/2024-01",
      "confidence_score": 0.95,
      "source": "catalog",
      "tags": ["ecommerce", "retail", "payments"]
    }
  ],
  "total_found": 1,
  "search_time_seconds": 0.05
}
```

**Example Request**:
```bash
curl -X GET "http://localhost:9001/api/v1/vitesse/discover?query=shopify&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## User Flow

### 1. Navigate to New Integration

Users click "New Integration" from the Integrations page, which navigates to `/integrations/new`.

### 2. Search for Source API

**Step 1**: Search Source
- Large search input with placeholder examples
- Live search results as cards
- Each result shows:
  - API name and confidence score
  - Description and tags
  - Link to documentation
  - Source indicator (Official/AI Found)

### 3. Search for Destination API

**Step 2**: Search Destination
- Same search interface
- Typically Linedata products (CapitalStream, Longview, etc.)
- Can also search for any API

### 4. Configure Integration

**Step 3**: Configure
- **User Intent**: Describe what to sync (e.g., "Sync new orders from Shopify to CapitalStream every hour")
- **Deployment Target**: Choose local, EKS, or ECS

### 5. Review & Create

**Step 4**: Review
- Visual flow diagram (Source → Destination)
- Summary of configuration
- Explanation of autonomous build process
- Create button triggers the agent pipeline

## Discovery Logic

### Search Algorithm

1. **Check Known Catalog** (Fast Path)
   - Keyword matching on API name and tags
   - Returns high-confidence results (95%)
   - Instant response

2. **Knowledge Base Search** (Harvested Data)
   - Searches `API_SPECS_COLLECTION` and `FINANCIAL_APIS_COLLECTION`
   - Leverages externally harvested knowledge (e.g., from APIs.guru)
   - Returns high-to-medium confidence results

3. **LLM Discovery** (Fallback)
   - Invoked if catalog and knowledge base don't have enough results
   - Uses structured LLM calls for unknown APIs
   - Returns medium-confidence results (~85%)

4. **Result Ranking**
   - Sort by confidence score (descending)
   - Limit to requested number of results
   - Return with search time metadata

### Example: Searching for "Shopify"

```python
# User searches "shopify"
query = "shopify"

# 1. Catalog search finds match
catalog_results = [
    {
        "api_name": "Shopify Admin API",
        "confidence_score": 0.95,
        "source": "catalog",
        # ... other fields
    }
]

# 2. No need for LLM since catalog has results
# 3. Return sorted results
return {
    "status": "success",
    "results": catalog_results,
    "total_found": 1
}
```

## Extending the Catalog

To add new APIs to the known catalog, edit `backend/app/agents/discovery.py`:

```python
self.known_apis = {
    # ... existing APIs ...
    "your_api": {
        "name": "Your API Name",
        "doc_url": "https://docs.yourapi.com",
        "spec_url": "https://api.yourapi.com/openapi.json",
        "base_url": "https://api.yourapi.com/v1",
        "tags": ["category1", "category2"],
    },
}
```

### Linedata Product Configuration

For deployment-specific Linedata products, you can configure the base URLs via environment variables:

```bash
# .env
CAPITALSTREAM_API_URL=https://capitalstream.client.com/api
LONGVIEW_API_URL=https://longview.client.com/api
```

Then update the catalog to use these values:

```python
import os

"capitalstream": {
    "name": "Linedata CapitalStream",
    "base_url": os.getenv("CAPITALSTREAM_API_URL"),
    # ... other fields
}
```

## Integration with Orchestrator

After discovery, the selected APIs flow into the standard Vitesse pipeline:

```
Discovery → Ingestor → Mapper → Guardian → Deployer
```

The `VitesseOrchestrator.create_integration()` method receives:
- `source_api_url`: From discovery result's `base_url` or `documentation_url`
- `source_api_name`: From discovery result's `api_name`
- `source_spec_url`: From discovery result's `spec_url`
- (Same for destination)

## Testing

### Unit Tests

Location: `backend/tests/agents/test_discovery.py`

Run tests:
```bash
cd backend
pytest tests/agents/test_discovery.py -v
```

### Manual Testing

1. Start backend:
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload
   ```

2. Test discovery endpoint:
   ```bash
   curl "http://localhost:9001/api/v1/vitesse/discover?query=shopify"
   ```

3. Test UI flow:
   - Navigate to http://localhost:5173/integrations
   - Click "New Integration"
   - Search for "Shopify"
   - Verify results appear with confidence scores

## Future Enhancements

### Planned Features

1. **API Directory Integration**
   - Query APIs.guru (2000+ OpenAPI specs)
   - RapidAPI marketplace integration
   - Postman API Network

2. **Search History**
   - Track user searches
   - Show "Recently searched" suggestions
   - Display "Popular APIs" based on usage

3. **Smart Defaults**
   - Pre-select destination based on source API type
   - Suggest common integration patterns
   - Auto-fill user intent templates

4. **Enhanced LLM Discovery**
   - Multi-source validation
   - Automatic spec URL verification
   - Confidence score calibration

5. **Deployment-specific Catalogs**
   - Load Linedata products from config
   - Client-specific API catalogs
   - Environment-based discovery results

## Troubleshooting

### No Results Found

**Problem**: Search returns empty results

**Solutions**:
1. Check if API is in catalog (`backend/app/agents/discovery.py`)
2. Try broader search terms (e.g., "payment" instead of "stripe payments")
3. Verify LLM service is configured correctly
4. Check logs for LLM errors

### Low Confidence Scores

**Problem**: Results have low confidence scores

**Solutions**:
1. Add API to known catalog for 95% confidence
2. Improve LLM prompt in `_llm_discovery()` method
3. Verify API documentation URL is accessible

### Slow Search

**Problem**: Discovery takes too long

**Solutions**:
1. Reduce `limit` parameter
2. Add more APIs to catalog (faster than LLM)
3. Cache LLM results for common queries
4. Optimize LLM provider settings

## Related Documentation

- [Integration Lifecycle](./integration_lifecycle.md)
- [Agent Architecture](./agents.md)
- [API Reference](./api.md)

## Knowledge Harvester

The Knowledge Harvester is an autonomous agent that proactively discovers and harvests API knowledge from various sources to power the Discovery Agent.

### Web Search for Sources (UI Feature)

The Harvest Sources UI now includes a **Search Sources** button that allows users to search for API sources and add them directly to their harvest sources list:

**How to Use:**
1. Navigate to the Harvest Sources page
2. Click the "Search Sources" button
3. Enter a search query (e.g., "payment", "CRM", "accounting")
4. Browse the discovered sources with confidence scores
5. Click "Add" to add any source to your harvest list

**Search Sources:**
- Searches the knowledge base for matching APIs
- Returns curated suggestions based on common API categories (Payments, CRM, E-commerce, Accounting, Shipping, Communication)
- Each result shows: name, type, URL, description, category, and confidence score
- Results come from either the knowledge base or curated suggestions

**Benefits:**
- Discover new API sources without manual configuration
- Pre-populated source details save setup time
- Confidence scores help prioritize high-quality sources
- Direct integration with harvest workflow

### Smart Deduplication

The Knowledge Harvester now includes intelligent source tracking to avoid reprocessing unchanged sources:

**How It Works**:
1. **First Run**: All sources are processed and their content hashes are stored in Qdrant
2. **Subsequent Runs**: Before processing each source, the harvester checks if the content has changed
3. **Skip Unchanged**: Sources with matching hashes are skipped to save time and resources

**Tracked Sources**:
- GitHub API repositories (45 sources)
- API marketplaces (10 sources)
- Financial APIs (3 sources: Plaid, Stripe, Yodlee)
- Regulatory standards (2 sources: PSD2, FDX)
- Integration patterns (4 sources)
- APIs.guru directory (~2000 APIs)

**Source Key Format**:
- Financial APIs: `financial_api:{api_name}`
- Standards: `standard:{standard_name}`
- GitHub: `github:{repo}`
- Marketplaces: `marketplace:{api_name}`

**Log Output**:
```
# First run
Harvesting from GitHub API repositories...
GitHub API harvest complete harvested=45 skipped_unchanged=0 total_sources=45

# Subsequent run (unchanged)
Harvesting from GitHub API repositories...
Skipping unchanged GitHub source repo=stripe/stripe-go
...
GitHub API harvest complete harvested=0 skipped_unchanged=45 total_sources=45
```
