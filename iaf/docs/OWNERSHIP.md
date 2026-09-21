# Ownership classification

| Class | Location | Consumer project names |
| --- | --- | --- |
| UPSTREAM_ECC | Everything outside `iaf/` | n/a |
| IAF_GENERIC_CORE | `iaf/lib` (except harnesses), `iaf/bin`, `iaf/policy` | **ZERO** |
| IAF_HARNESS_ADAPTER | `iaf/lib/harnesses`, `iaf/templates` | **ZERO** |
| IAF_FLEET_DATA | `iaf/operator` | Allowed as data |
| GENERATED_PROJECT_CONFIG | consumer `.iaf-ecc-state.json`, `.cursor/iaf/` | Allowed for that repo |
| PROJECT_SPECIFIC | consumer `AGENTS.md`, `docs/**` | Allowed for that repo |
| TEST_FIXTURE | `iaf/tests` | Neutral fixture names except the audit denylist file |
| REPORT/DOCUMENTATION | `iaf/docs`, especially `iaf/docs/reference` | Historical/reference names allowed when not authoritative for generic behavior |
