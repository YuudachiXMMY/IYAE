# Fabric normal maps (drape-realism Phase 2 / C2)

Tileable, tangent-space normal maps applied to garment materials on the frontend
(`web/lib/fabric-textures.ts` → `web/components/FittingHelper.tsx applyGarmentNormalMap`)
to fake fabric weave/wrinkle relief with zero cloth simulation.

- `weave-normal.png` — generic plain-weave (top / dress).
- `denim-normal.png` — diagonal twill rib (bottom).

## Provenance / license

Procedurally generated (no third-party assets) via a one-off script: integer-period
sinusoidal height fields → gradient → tangent-space normal encoding, with `np.roll`
wrap-around so the tiles are seamless under `RepeatWrapping`. Regenerate by re-running
the generator (`gen_fabric_normals.py`, kept out of the shipped bundle). CC0 / no
attribution required.
