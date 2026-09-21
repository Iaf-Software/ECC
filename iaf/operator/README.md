# Operator / fleet data

**Classification: IAF_FLEET_DATA — NOT GENERIC IAF ECC CORE.**

This directory may list current repository identities, checkout path hints, and expected branches.

Generic bootstrap, adapt, update, model routing, and harness adapters MUST NOT import these names.

- Default inventory: `fleet.inventory.json`
- Override: `IAF_FLEET_INVENTORY=/path/to/inventory.json`
- Or pass `--inventory` / `--repo /absolute/path` / `--scan-root`

Adding a future repository should mean adding an inventory entry or pointing at a checkout path. It must not require editing `iaf/lib`.
