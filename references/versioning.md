# Versioning

Current version: `v0.6.10`

Use a human-approved version lane:

- Default lane: keep releases within the current GitHub minor version lane, for example `v0.6.x` when GitHub is at `v0.6.0`.
- Patch `v0.x.y`: wording, filters, default endpoint changes, scoring threshold tweaks, bug fixes, docs, and backwards-compatible script behavior.
- Minor `v0.(x+1).0`: only bump when the user explicitly decides to move out of the current minor lane.
- Major `v1.0.x`: only bump when the user explicitly decides the skill is stable enough for a `1.0` contract or approves a breaking workflow/schema change.

Do not automatically bump to a new minor or major version based on semantic-versioning interpretation alone. The user decides those transitions manually.

When bumping version:

1. Update `SKILL.md` body `Version`.
2. Update `VERSION`.
3. Update version lines in reference files touched by the release.
4. Verify `agents/openai.yaml` still matches the skill purpose.

Do not add a `version` key to `SKILL.md` frontmatter. The system validator only permits supported frontmatter keys such as `name`, `description`, `metadata`, `allowed-tools`, and `license`.

## Version Check Script

Run local consistency check:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

Compare with a manually supplied latest version:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.0.2
```

By default, the script checks `https://raw.githubusercontent.com/adgine-ai/adgine-daily-feeds/main/VERSION`. Use `--no-remote` for local consistency only.

The script exits with non-zero status when local version fields are inconsistent. If `is_outdated` is `true`, prompt the user to manually update the skill before production use.
