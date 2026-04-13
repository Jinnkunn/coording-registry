# coording Plugin Registry

Community-maintained plugin index for [coording](https://github.com/Jinnkunn/personal-os).

## How it works

1. Each plugin has a directory under `plugins/{plugin-id}/` with a `metadata.json` file
2. CI validates every PR: downloads the zip, verifies the manifest, checks SHA256, ensures semver increments
3. On merge to `main`, CI regenerates `index.json` and deploys it to GitHub Pages
4. The coording app fetches `https://<owner>.github.io/coording-registry/index.json` at startup

## Publishing a plugin

1. Fork this repo
2. Create `plugins/{your-plugin-id}/metadata.json`:
   ```json
   {
     "id": "your-plugin-id",
     "name": "Your Plugin Name",
     "author": "Your Name",
     "version": "1.0.0",
     "description": "What your plugin does",
     "downloadUrl": "https://github.com/you/your-plugin/releases/download/v1.0.0/your-plugin.zip",
     "sha256": "abc123...",
     "homepage": "https://github.com/you/your-plugin",
     "coordingVersionRange": "^0.1.0",
     "releaseNotesUrl": "https://github.com/you/your-plugin/releases/tag/v1.0.0"
   }
   ```
3. Open a PR — CI will validate automatically
4. After review + merge, the plugin appears in the registry within minutes

## Computing SHA256

```bash
shasum -a 256 your-plugin.zip
```

## Registry schema

See `schema/metadata.schema.json` for the full JSON Schema.

## For maintainers

- `scripts/validate.mjs` — validates a single plugin metadata entry
- `scripts/generate-index.mjs` — regenerates `index.json` from all `plugins/*/metadata.json`
- `.github/workflows/validate-pr.yml` — runs on every PR
- `.github/workflows/publish.yml` — regenerates + deploys on merge to main
