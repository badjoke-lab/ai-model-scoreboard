# Overrides (v4)

This folder lets us supplement missing evidence, raw inputs, or links **without**
committing regenerated v4 artifacts in `public/data/v4/**`.

## Location

Create files in:

`overrides/v4/models/<modelKey>.json`

## modelKey matching

The `modelKey` inside the JSON **must exactly match the filename** (URL-encoded).

## What can be overridden

- `evidence`
- `rawInputsBySource`
- `links`

## Filename example

If the model key is `meta-llama/llama-3.1-8b-instruct`, the override file should be:

`overrides/v4/models/meta-llama%2Fllama-3.1-8b-instruct.json`
