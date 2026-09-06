"""Shared GLB geometry-stat computation.

Single source of truth for the accessor traversal that both ``validator.py``
(``validate_glb_geometry``) and ``providers/meshy_generator.py``
(``_compute_glb_metadata``) previously duplicated. Keeping it here means the
out-of-range-index guard, the primitive-``mode`` handling, and the bbox union
logic live in exactly one place.

IMPORTANT (honesty): stats are read from the glTF JSON chunk's
ACCESSOR-DECLARED ``count``/``min``/``max`` only. Those values are part of the
(provider-controlled) JSON and are NOT cross-checked against the ``bufferView`` /
``buffer`` bytes. This catches a provider whose reported metadata is inconsistent
with its own declared accessors; it does NOT prove the geometry matches the
underlying buffer data.
"""
import math


def _tris_for_mode(mode: int, count: int) -> int:
    """Triangle count for a primitive of ``count`` indices/vertices in glTF ``mode``.

    glTF primitive modes: 0 POINTS, 1 LINES, 2 LINE_LOOP, 3 LINE_STRIP,
    4 TRIANGLES (default), 5 TRIANGLE_STRIP, 6 TRIANGLE_FAN.
    """
    if mode in (0, 1, 2, 3):        # points / lines contribute no triangles
        return 0
    if mode in (5, 6):              # strip / fan
        return max(0, count - 2)
    return count // 3               # 4 TRIANGLES (and the None default)


def compute_glb_geometry_stats(gltf) -> dict:
    """Traverse an already-loaded ``pygltflib.GLTF2`` and return geometry stats.

    Args:
        gltf: a loaded ``pygltflib.GLTF2`` object (callers do the lazy import).

    Returns a dict::

        {
            "triangle_count": int,     # mode-aware sum over all primitives
            "mins": [x, y, z],         # unioned POSITION accessor mins (math.inf if none)
            "maxs": [x, y, z],         # unioned POSITION accessor maxs (-math.inf if none)
            "bounds_found": bool,      # whether any POSITION accessor carried min/max
            "errors": [str, ...],      # out-of-range accessor indices, etc.
        }

    No exceptions are raised for malformed-but-parsed glTF: out-of-range accessor
    indices are reported via ``errors`` (never used to index a wrong accessor).
    """
    accessors = gltf.accessors or []
    triangle_count = 0
    mins = [math.inf, math.inf, math.inf]
    maxs = [-math.inf, -math.inf, -math.inf]
    bounds_found = False
    errors: list[str] = []

    for mesh in (gltf.meshes or []):
        for prim in (mesh.primitives or []):
            attrs = prim.attributes
            pos = getattr(attrs, "POSITION", None) if attrs else None
            idx = prim.indices
            mode = prim.mode if prim.mode is not None else 4  # default TRIANGLES

            # An index that is present but out of the valid [0, len) range (e.g. a
            # negative value that would silently wrap via Python negative indexing)
            # is a validation error, not something to index.
            if idx is not None and not (0 <= idx < len(accessors)):
                errors.append(
                    f"indices accessor index {idx} out of range [0, {len(accessors)})"
                )
            if pos is not None and not (0 <= pos < len(accessors)):
                errors.append(
                    f"POSITION accessor index {pos} out of range [0, {len(accessors)})"
                )

            count = None
            if idx is not None and 0 <= idx < len(accessors):
                count = accessors[idx].count
            elif pos is not None and 0 <= pos < len(accessors):
                count = accessors[pos].count
            if count is not None:
                triangle_count += _tris_for_mode(mode, count)

            if pos is not None and 0 <= pos < len(accessors):
                acc = accessors[pos]
                if acc.min and acc.max and len(acc.min) >= 3 and len(acc.max) >= 3:
                    bounds_found = True
                    for i in range(3):
                        mins[i] = min(mins[i], float(acc.min[i]))
                        maxs[i] = max(maxs[i], float(acc.max[i]))

    return {
        "triangle_count": triangle_count,
        "mins": mins,
        "maxs": maxs,
        "bounds_found": bounds_found,
        "errors": errors,
    }
