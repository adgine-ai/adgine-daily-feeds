# Versioning

Current version: `v0.2.0`

Use semantic versioning:

- Patch `v0.0.x`: wording, filters, scoring threshold tweaks, bug fixes that do not change output schema.
- Minor `v0.x.0`: new source type, new output mode, new normalized fields, or new automation workflow.
- Major `vX.0.0`: breaking report schema or incompatible skill workflow changes.

When bumping version:

1. Update `SKILL.md` frontmatter `version`.
2. Update `SKILL.md` body `Version`.
3. Update `VERSION`.
4. Update version lines in reference files touched by the release.
5. Verify `agents/openai.yaml` still matches the skill purpose.

## Version Check Script

Run local consistency check:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

Compare with a manually supplied latest version:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.0.2
```

The script exits with non-zero status when local version fields are inconsistent. If `is_outdated` is `true`, prompt the user to manually update the skill before production use.
