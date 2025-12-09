# Public API

The AI Model Scoreboard exposes two public, read-only endpoints. Both return JSON and are safe to cache on the client side.

## `/api/snapshot`
Returns the latest cached snapshot used by the homepage.

**Example response**
```json
{
  "updatedAt": "2024-08-01T12:34:56.000Z",
  "models": [
    {
      "id": "meta-llama/Meta-Llama-3-8B",
      "slug": "meta-llama-3-8b",
      "name": "Llama 3 8B",
      "provider": "Meta",
      "focus": "General",
      "metrics": {
        "downloads": 123456,
        "likes": 7890,
        "lastModified": "2024-07-31T10:00:00.000Z",
        "recencyDays": 1
      },
      "status": "ready",
      "source": "https://huggingface.co/meta-llama/Meta-Llama-3-8B",
      "scores": {
        "adoption": 82.5,
        "ecosystem": 75.3,
        "velocity": 66.1,
        "total": 76.9
      }
    }
  ],
  "metrics": {
    "downloadRange": { "min": 1000, "max": 500000 },
    "likeRange": { "min": 10, "max": 20000 },
    "recencyRange": { "min": 0, "max": 90 },
    "sourceCount": 5,
    "readyCount": 5
  },
  "scores": {
    "weights": {
      "adoption": 0.45,
      "ecosystem": 0.35,
      "velocity": 0.2
    }
  }
}
```

## `/api/health`
Reports the health of the snapshot builder and cache status.

**Example response**
```json
{
  "status": "ok",
  "components": {
    "huggingFaceFetch": { "status": "ok", "lastError": null },
    "cache": { "read": "ok", "write": "ok" },
    "scoreCompute": { "status": "ok", "lastError": null }
  },
  "snapshot": {
    "updatedAt": "2024-08-01T12:34:56.000Z",
    "ageSeconds": 42
  }
}
```

### Notes
- Both endpoints are public and unauthenticated.
- Response shapes remain consistent across v3.x; avoid mutating the schema to maintain compatibility.
- Snapshot data is cached; `ageSeconds` indicates how long ago the snapshot was built.
