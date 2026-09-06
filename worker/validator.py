"""GLB/USDZ output validation."""
import math
import struct
import os
import logging

logger = logging.getLogger(__name__)

GLB_MAGIC = b"glTF"
MAX_TRIANGLE_COUNT = 500_000
BBOX_MIN_DIM = 0.01   # metres
BBOX_MAX_DIM = 10.0   # metres


def validate_glb(file_path: str) -> dict:
    """Validate GLB file. Returns validation result dict."""
    result = {"valid": False, "errors": [], "triangle_count": 0, "bbox": None}

    if not os.path.exists(file_path):
        result["errors"].append("File does not exist")
        return result

    size = os.path.getsize(file_path)
    if size == 0:
        result["errors"].append("File is empty")
        return result

    with open(file_path, "rb") as f:
        header = f.read(4)
        if header != GLB_MAGIC:
            result["errors"].append(f"Invalid magic header: {header!r}, expected {GLB_MAGIC!r}")
            return result

        # Read version and length
        version = struct.unpack("<I", f.read(4))[0]
        total_length = struct.unpack("<I", f.read(4))[0]

    result["valid"] = True
    result["glb_size_bytes"] = size
    result["version"] = version
    return result


def validate_triangle_count(metadata: dict) -> list[str]:
    """Check triangle count is within acceptable limit (max 500,000)."""
    errors: list[str] = []
    count = metadata.get("triangle_count")
    if count is None:
        return errors
    if not isinstance(count, (int, float)):
        errors.append(f"triangle_count must be a number, got {type(count).__name__}")
        return errors
    if count > MAX_TRIANGLE_COUNT:
        errors.append(
            f"triangle_count {count} exceeds limit of {MAX_TRIANGLE_COUNT}"
        )
    return errors


def validate_bounding_box(metadata: dict) -> list[str]:
    """Check bounding box dimensions are in acceptable range (0.01m - 10m per axis)."""
    errors: list[str] = []
    bbox = metadata.get("bbox")
    if bbox is None:
        return errors
    min_coords = bbox.get("min")
    max_coords = bbox.get("max")
    if min_coords is None or max_coords is None:
        errors.append("bbox must have 'min' and 'max' keys")
        return errors
    if len(min_coords) != 3 or len(max_coords) != 3:
        errors.append("bbox min/max must each have 3 components")
        return errors
    for axis, (lo, hi) in enumerate(zip(min_coords, max_coords)):
        dim = hi - lo
        if dim < BBOX_MIN_DIM:
            errors.append(
                f"bbox dimension on axis {axis} is {dim:.4f}m, below minimum {BBOX_MIN_DIM}m"
            )
        if dim > BBOX_MAX_DIM:
            errors.append(
                f"bbox dimension on axis {axis} is {dim:.4f}m, above maximum {BBOX_MAX_DIM}m"
            )
    return errors


def validate_no_nan(metadata: dict) -> list[str]:
    """Check sanity flag and bbox coordinates for NaN/Inf values."""
    errors: list[str] = []
    sanity = metadata.get("sanity", {})
    if sanity.get("has_nan_vertices"):
        errors.append("Model contains NaN vertices")

    bbox = metadata.get("bbox")
    if bbox:
        for key in ("min", "max"):
            coords = bbox.get(key, [])
            for i, v in enumerate(coords):
                if not isinstance(v, (int, float)):
                    continue
                if math.isnan(v) or math.isinf(v):
                    errors.append(f"bbox.{key}[{i}] is NaN or Inf: {v}")
    return errors


def validate_metadata(metadata: dict) -> dict:
    """Validate provider output metadata (triangle_count, bbox, NaN/Inf).

    Returns {"valid": bool, "errors": list[str]}.
    """
    errors: list[str] = []
    errors.extend(validate_triangle_count(metadata))
    errors.extend(validate_bounding_box(metadata))
    errors.extend(validate_no_nan(metadata))
    return {"valid": len(errors) == 0, "errors": errors}


def validate_glb_geometry(file_path: str) -> dict:
    """Independently parse a GLB's geometry and validate triangle_count + bbox.

    Defense-in-depth: recomputes geometry from the file's own glTF JSON instead of
    trusting the provider-supplied output metadata. NOTE: it reads the
    ACCESSOR-DECLARED ``count``/``min``/``max`` (themselves part of the
    provider-controlled JSON chunk) and does NOT decode ``bufferView``/``buffer``
    bytes -- so it catches metadata that is inconsistent with the file's own
    declared accessors, but it does not prove the declared accessors match the
    underlying buffer data. Reuses the module thresholds ``MAX_TRIANGLE_COUNT``,
    ``BBOX_MIN_DIM`` and ``BBOX_MAX_DIM``.

    Geometry is read via ``pygltflib`` (lazy import) through the shared
    ``compute_glb_geometry_stats`` helper (POSITION accessor ``min``/``max``
    unioned across meshes; mode-aware index counts). A GLB with no geometry (e.g.
    the stub empty-scene GLB) passes -- there is nothing to reject. A parse failure
    is reported as a validation error (task FAILED); it never raises, so the poll
    loop cannot crash on a bad file.

    Returns ``{"valid": bool, "errors": [...], "triangle_count": int|None, "bbox": dict|None}``.
    """
    from pygltflib import GLTF2

    from glb_geometry import compute_glb_geometry_stats

    result: dict = {"valid": False, "errors": [], "triangle_count": None, "bbox": None}

    try:
        gltf = GLTF2.load(file_path)
    except Exception as e:
        result["errors"].append(f"Failed to parse GLB geometry: {e}")
        return result

    try:
        stats = compute_glb_geometry_stats(gltf)
    except Exception as e:
        result["errors"].append(f"Failed to read GLB geometry: {e}")
        return result

    result["errors"].extend(stats["errors"])
    triangle_count = stats["triangle_count"]
    result["triangle_count"] = triangle_count

    if triangle_count > MAX_TRIANGLE_COUNT:
        result["errors"].append(
            f"triangle_count {triangle_count} exceeds limit of {MAX_TRIANGLE_COUNT}"
        )

    # A negative aggregate can only arise from a provider-declared negative
    # accessor ``count`` (the shared helper now clamps per-primitive, so this is
    # belt-and-suspenders against any future caller that bypasses it). Fail closed
    # -- an upper-bound-only cap would otherwise pass a negative total.
    if triangle_count < 0:
        result["errors"].append(f"triangle_count {triangle_count} is negative")

    if stats["bounds_found"]:
        mins, maxs = stats["mins"], stats["maxs"]
        result["bbox"] = {"min": mins, "max": maxs}
        for axis in range(3):
            lo, hi = mins[axis], maxs[axis]
            if math.isnan(lo) or math.isnan(hi) or math.isinf(lo) or math.isinf(hi):
                result["errors"].append(
                    f"bbox coordinate on axis {axis} is NaN or Inf"
                )
                continue
            dim = hi - lo
            if dim < BBOX_MIN_DIM:
                result["errors"].append(
                    f"bbox dimension on axis {axis} is {dim:.4f}m, below minimum {BBOX_MIN_DIM}m"
                )
            if dim > BBOX_MAX_DIM:
                result["errors"].append(
                    f"bbox dimension on axis {axis} is {dim:.4f}m, above maximum {BBOX_MAX_DIM}m"
                )
    elif triangle_count > 0:
        # Geometry is present but no POSITION accessor carried min/max bounds, so
        # the bbox range/NaN checks above were skipped entirely. Fail closed: a
        # provider could otherwise ship a degenerate/oversized garment simply by
        # omitting bounds. An empty scene (triangle_count == 0, e.g. the stub GLB)
        # legitimately has no bounds and still passes.
        result["errors"].append(
            "geometry present but POSITION min/max bounds absent -- cannot validate bbox"
        )

    result["valid"] = len(result["errors"]) == 0
    return result


def validate_usdz(file_path: str) -> dict:
    """Basic USDZ validation."""
    result = {"valid": False, "errors": []}

    if not os.path.exists(file_path):
        result["errors"].append("File does not exist")
        return result

    if os.path.getsize(file_path) == 0:
        result["errors"].append("File is empty")
        return result

    result["valid"] = True
    return result


def validate_rigged_glb(file_path: str, slot_hint: str | None = None) -> dict:
    """Validate a rigged GLB file: standard GLB checks + skin/bone validation.

    Args:
        file_path: Path to GLB file.
        slot_hint: Optional garment slot ('TOP', 'BOTTOM', 'DRESS') for bone checks.

    Returns dict with 'valid' (bool) and 'errors' (list of str).
    """
    # First run standard GLB validation
    glb_result = validate_glb(file_path)
    if not glb_result["valid"]:
        return glb_result

    # Then check skin metadata
    skin_result = validate_skin_metadata(file_path)
    if not skin_result["valid"]:
        return skin_result

    # Check required bones if slot_hint provided
    if slot_hint:
        bone_result = validate_required_bones(file_path, slot_hint)
        if not bone_result["valid"]:
            return bone_result

    return skin_result


def validate_skin_metadata(file_path: str) -> dict:
    """Check that GLB contains valid glTF skin data (skins, joints, weights)."""
    from pygltflib import GLTF2

    errors: list[str] = []

    try:
        gltf = GLTF2.load(file_path)
    except Exception as e:
        return {"valid": False, "errors": [f"Failed to parse GLB: {e}"]}

    # Check skins exist
    if not gltf.skins or len(gltf.skins) == 0:
        errors.append("No skins found in GLB")
        return {"valid": False, "errors": errors}

    skin = gltf.skins[0]

    # Check joints
    if not skin.joints or len(skin.joints) == 0:
        errors.append("Skin has no joints")

    # Check inverseBindMatrices
    if skin.inverseBindMatrices is None:
        errors.append("Skin missing inverseBindMatrices")
    elif skin.inverseBindMatrices < len(gltf.accessors):
        ibm_accessor = gltf.accessors[skin.inverseBindMatrices]
        if ibm_accessor.count != len(skin.joints):
            errors.append(
                f"inverseBindMatrices count ({ibm_accessor.count}) "
                f"does not match joint count ({len(skin.joints)})"
            )

    # Check mesh primitives have JOINTS_0 and WEIGHTS_0
    has_joints = False
    has_weights = False
    for mesh in (gltf.meshes or []):
        for prim in (mesh.primitives or []):
            attrs = prim.attributes
            if hasattr(attrs, "JOINTS_0") and attrs.JOINTS_0 is not None:
                has_joints = True
            if hasattr(attrs, "WEIGHTS_0") and attrs.WEIGHTS_0 is not None:
                has_weights = True

    if not has_joints:
        errors.append("No mesh primitive has JOINTS_0 attribute")
    if not has_weights:
        errors.append("No mesh primitive has WEIGHTS_0 attribute")

    return {"valid": len(errors) == 0, "errors": errors}


def validate_required_bones(file_path: str, slot_hint: str) -> dict:
    """Check that rigged GLB contains required bones for the garment slot.

    Args:
        file_path: Path to GLB file
        slot_hint: One of 'TOP', 'BOTTOM', 'DRESS'

    Returns dict with 'valid' (bool), 'errors' (list), 'bone_names' (list).
    """
    from pygltflib import GLTF2

    from providers.canonical_skeleton import SLOT_BONE_SUBSETS

    # Derive required bones from canonical definitions.
    # For TOP/BOTTOM: use their full slot subset as the required set.
    # For DRESS (None = all joints): require only the core structural bones.
    _DRESS_REQUIRED = {"pelvis", "spine1", "spine2", "left_hip", "right_hip"}
    REQUIRED_BONES: dict[str, set[str]] = {}
    for slot, subset in SLOT_BONE_SUBSETS.items():
        if subset is None:
            REQUIRED_BONES[slot] = _DRESS_REQUIRED
        else:
            REQUIRED_BONES[slot] = set(subset)

    try:
        gltf = GLTF2.load(file_path)
    except Exception as e:
        return {"valid": False, "errors": [f"Failed to parse GLB: {e}"], "bone_names": []}

    if not gltf.skins or not gltf.skins[0].joints:
        return {"valid": False, "errors": ["No skin joints found"], "bone_names": []}

    # Extract bone names from joint nodes
    bone_names: list[str] = []
    for joint_idx in gltf.skins[0].joints:
        if joint_idx < len(gltf.nodes) and gltf.nodes[joint_idx].name:
            bone_names.append(gltf.nodes[joint_idx].name)

    bone_set = set(bone_names)
    required = REQUIRED_BONES.get(slot_hint, set())
    missing = required - bone_set

    errors: list[str] = []
    if missing:
        errors.append(f"Missing required bones for {slot_hint}: {sorted(missing)}")

    return {"valid": len(errors) == 0, "errors": errors, "bone_names": bone_names}
