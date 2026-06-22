# Versioning

Current version: `v0.6.3`

Use a human-approved version lane:

- Default lane: keep releases within the current GitHub minor version lane, for example `v0.6.x` when GitHub is at `v0.6.0`.
- Patch `v0.x.y`: wording, filters, default endpoint changes, scoring threshold tweaks, bug fixes, docs, and backwards-compatible script behavior.
- Minor `v0.(x+1).0`: only bump when the user explicitly decides to move out of the current minor lane.
- Major `v1.0.x`: only bump when the user explicitly decides the skill is stable enough for a `1.0` contract or approves a breaking workflow/schema change.

Do not automatically bump to a new minor or major version based on semantic-versioning interpretation alone. The user decides those transitions manually.

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
