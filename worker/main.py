"""IYAE 3D Model Generation Worker."""
import os
import time
import json
import logging
import threading
from contextlib import contextmanager

from task_queue import TaskQueue
from avatar_task_queue import AvatarTaskQueue
from rigging_task_queue import RiggingTaskQueue
from providers.stub_generator import StubGenerator
from providers.tripo_generator import TripoGenerator
from providers.smplx_stub_provider import SmplxStubProvider
from providers.stub_rigging_provider import StubRiggingProvider
from providers.fit_accuracy import validate_fit_accuracy
from validator import (
    validate_glb,
    validate_glb_geometry,
    validate_material_and_uv,
    validate_metadata,
    validate_usdz,
    validate_rigged_glb,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

POLL_INTERVAL = int(os.environ.get("WORKER_POLL_INTERVAL", "5"))
OUTPUT_BASE_DIR = os.environ.get("WORKER_OUTPUT_DIR", "/var/iyae/assets")

ALL_ROLES = ("model", "avatar", "rigging")


def get_roles() -> set[str]:
    """Which task queues this process claims from.

    The rigging container runs this same `main.py`, so without a role switch it became a
    second claimant for model and avatar tasks — and since it is configured with
    MODEL_GENERATION_PROVIDER=mock, it would race the real worker and win sometimes,
    completing a genuine generation request with stub output. Set WORKER_ROLES=rigging on
    any rigging-only container.

    Defaults to all three, which is the single-worker production topology.
    """
    raw = os.environ.get("WORKER_ROLES", "").strip()
    if not raw:
        return set(ALL_ROLES)
    roles = {r.strip().lower() for r in raw.split(",") if r.strip()}
    unknown = roles - set(ALL_ROLES)
    if unknown:
        raise ValueError(
            f"Unknown WORKER_ROLES {sorted(unknown)}; valid roles are {list(ALL_ROLES)}"
        )
    if not roles:
        raise ValueError("WORKER_ROLES was set but parsed to nothing")
    return roles


# Touched once per poll cycle so the container healthcheck can tell a live daemon from one
# that is wedged on a hung provider call. A process that is merely *running* says nothing
# about whether it is still working through its queues.
HEARTBEAT_PATH = os.environ.get("WORKER_HEARTBEAT_PATH", "/tmp/worker-heartbeat")


def touch_heartbeat() -> None:
    try:
        with open(HEARTBEAT_PATH, "w") as fh:
            fh.write(str(int(time.time())))
    except OSError as exc:  # never let the heartbeat kill the loop
        logger.warning(f"Could not write heartbeat to {HEARTBEAT_PATH}: {exc}")


#: How often a claimed task's staleness clock is pushed out while it is being worked on.
#: Comfortably under the 15-minute reclaim threshold so one missed tick is harmless.
TASK_HEARTBEAT_INTERVAL = int(os.environ.get("WORKER_TASK_HEARTBEAT_INTERVAL", "60"))


@contextmanager
def task_heartbeat(queue, task_id: int):
    """Keeps a claimed task's ``updated_at`` fresh for as long as we are working on it.

    ``reclaim_stale_tasks`` treats a RUNNING task whose ``updated_at`` is older than 15
    minutes as abandoned. Nothing refreshed that column during a run, so a job that
    legitimately takes longer — a real Tripo3D or Meshy generation polls for up to 10 minutes
    before the download even starts — was reclaimed while its worker was still inside
    ``provider.generate()``, handed to a second claimant, and written twice.

    A daemon thread rather than a callback threaded through every provider: the providers are
    synchronous and blocking, so there is no point in their call stack where they could
    cooperatively yield, and making each one accept and periodically invoke a callback is a
    change to four provider APIs to achieve the same thing less reliably.
    """
    stop = threading.Event()

    def beat():
        while not stop.wait(TASK_HEARTBEAT_INTERVAL):
            try:
                queue.heartbeat(task_id)
            except Exception as exc:  # diagnostics must never take down the run
                logger.warning(f"Heartbeat for task {task_id} failed: {exc}")

    thread = threading.Thread(
        target=beat, name=f"heartbeat-{task_id}", daemon=True
    )
    thread.start()
    try:
        yield
    finally:
        stop.set()
        # Short join: the thread is parked in `stop.wait`, so it returns immediately. The
        # timeout is only here so a wedged thread cannot stall the poll loop.
        thread.join(timeout=5)


def get_db_config() -> dict:
    return {
        "host": os.environ.get("DB_HOST", "localhost"),
        "port": int(os.environ.get("DB_PORT", "3306")),
        "database": os.environ.get("DB_NAME", "iyae"),
        "user": os.environ.get("DB_USERNAME", "iyae"),
        "password": os.environ.get("DB_PASSWORD", ""),
    }


def get_provider():
    provider_name = os.environ.get("MODEL_GENERATION_PROVIDER", "mock").lower()
    if provider_name == "tripo3d":
        api_key = os.environ.get("WORKER_TRIPO_API_KEY")
        if not api_key:
            raise ValueError("WORKER_TRIPO_API_KEY required for tripo3d provider")
        return TripoGenerator(api_key=api_key, output_base_dir=OUTPUT_BASE_DIR)
    elif provider_name == "meshy":
        from providers.meshy_generator import MeshyGenerator
        api_key = os.environ.get("WORKER_MESHY_API_KEY")
        if not api_key:
            raise ValueError("WORKER_MESHY_API_KEY required for meshy provider")
        enable_pbr = os.environ.get("WORKER_MESHY_ENABLE_PBR", "false").lower() in (
            "1", "true", "yes",
        )
        return MeshyGenerator(
            api_key=api_key, output_base_dir=OUTPUT_BASE_DIR, enable_pbr=enable_pbr
        )
    else:
        return StubGenerator(output_base_dir=OUTPUT_BASE_DIR)


def get_avatar_provider():
    provider_name = os.environ.get("AVATAR_GENERATION_PROVIDER", "mock")
    if provider_name == "smplx":
        from providers.smplx_provider import SmplxProvider
        return SmplxProvider(output_base_dir=OUTPUT_BASE_DIR)
    else:
        return SmplxStubProvider(output_base_dir=OUTPUT_BASE_DIR)


def get_rigging_provider(output_dir: str):
    provider_name = os.environ.get("RIGGING_PROVIDER", "mock").lower()
    if provider_name == "blender":
        from providers.blender_rigging_provider import BlenderRiggingProvider
        blender_path = os.environ.get("BLENDER_PATH", "blender")
        logger.info("Using Blender rigging provider (path: %s)", blender_path)
        return BlenderRiggingProvider(output_dir, blender_path)
    elif provider_name == "python":
        from providers.python_rigging_provider import PythonRiggingProvider
        logger.info("Using Python rigging provider")
        return PythonRiggingProvider(output_dir)
    else:
        logger.info("Using stub rigging provider")
        return StubRiggingProvider(output_dir)


def run():
    logger.info("Starting IYAE 3D generation worker")
    db_config = get_db_config()
    queue = TaskQueue(db_config)
    avatar_queue = AvatarTaskQueue(db_config)
    rigging_queue = RiggingTaskQueue(db_config)
    provider = get_provider()
    avatar_provider = get_avatar_provider()
    rigging_provider = get_rigging_provider(OUTPUT_BASE_DIR)
    rigging_enabled = not isinstance(rigging_provider, StubRiggingProvider)
    roles = get_roles()
    logger.info(
        f"Roles: {sorted(roles)}, "
        f"Model provider: {provider.__class__.__name__}, "
        f"Avatar provider: {avatar_provider.__class__.__name__}, "
        f"Rigging provider: {rigging_provider.__class__.__name__} "
        f"({'active' if rigging_enabled else 'stub — skipping rigging tasks'}), "
        f"polling every {POLL_INTERVAL}s"
    )

    poll_count = 0
    while True:
        poll_count += 1
        touch_heartbeat()
        try:
            if poll_count % 12 == 0:
                try:
                    reclaimed = queue.reclaim_stale_tasks() if "model" in roles else 0
                    if reclaimed > 0:
                        logger.info(f"Reclaimed {reclaimed} stale model tasks")
                except Exception as e:
                    logger.error(f"Failed to reclaim stale model tasks: {e}")
                try:
                    reclaimed = avatar_queue.reclaim_stale_tasks() if "avatar" in roles else 0
                    if reclaimed > 0:
                        logger.info(f"Reclaimed {reclaimed} stale avatar tasks")
                except Exception as e:
                    logger.error(f"Failed to reclaim stale avatar tasks: {e}")
                if rigging_enabled and "rigging" in roles:
                    try:
                        reclaimed = rigging_queue.reclaim_stale_tasks()
                        if reclaimed > 0:
                            logger.info(f"Reclaimed {reclaimed} stale rigging tasks")
                    except Exception as e:
                        logger.error(f"Failed to reclaim stale rigging tasks: {e}")

            # Process both queues fairly each cycle
            processed_any = False

            # --- Product task ---
            task = queue.claim_task() if "model" in roles else None
            if task is not None:
                processed_any = True
                task_id = task["id"]
                product_id = task["product_id"]
                logger.info(f"Claimed model task {task_id} for product {product_id}")
                try:
                    input_payload = json.loads(task["input_payload"]) if task["input_payload"] else None
                    with task_heartbeat(queue, task_id):
                        output = provider.generate(task_id, product_id, input_payload)

                    glb_path = os.path.join(OUTPUT_BASE_DIR, output["glb_path"])
                    validation = validate_glb(glb_path)
                    if not validation["valid"]:
                        raise RuntimeError(f"GLB validation failed: {validation['errors']}")

                    geometry = validate_glb_geometry(glb_path)
                    if not geometry["valid"]:
                        raise RuntimeError(f"GLB geometry validation failed: {geometry['errors']}")

                    if output.get("usdz_path"):
                        usdz_path = os.path.join(OUTPUT_BASE_DIR, output["usdz_path"])
                        usdz_validation = validate_usdz(usdz_path)
                        if not usdz_validation["valid"]:
                            raise RuntimeError(f"USDZ validation failed: {usdz_validation['errors']}")

                    meta_validation = validate_metadata(output)
                    if not meta_validation["valid"]:
                        raise RuntimeError(f"Metadata validation failed: {meta_validation['errors']}")

                    queue.complete_task(task_id, output)
                    logger.info(f"Model task {task_id} completed successfully")
                except Exception as e:
                    logger.error(f"Model task {task_id} failed: {e}")
                    # fail_task only touches a task still RUNNING, and reports whether it did.
                    # Claiming otherwise is misleading: the task may have been reclaimed by the
                    # stale sweep and completed by a second worker while this one was still in
                    # provider.generate(), in which case the guard correctly declined to flip a
                    # finished generation to FAILED and there is nothing to re-queue.
                    if queue.fail_task(task_id, str(e)):
                        logger.warning(f"Model task {task_id} marked as FAILED. Use designer retry endpoint to re-queue.")
                    else:
                        logger.warning(f"Model task {task_id} was no longer RUNNING — left as it is; another worker or the stale sweep moved it on.")

            # --- Avatar task ---
            avatar_task = avatar_queue.claim_task() if "avatar" in roles else None
            if avatar_task is not None:
                processed_any = True
                task_id = avatar_task["id"]
                user_id = avatar_task["user_id"]
                logger.info(f"Claimed avatar task {task_id} for user {user_id}")
                try:
                    input_payload = json.loads(avatar_task["input_payload"]) if avatar_task["input_payload"] else None
                    with task_heartbeat(avatar_queue, task_id):
                        output = avatar_provider.generate(task_id, user_id, input_payload)

                    glb_path = os.path.join(OUTPUT_BASE_DIR, output["glb_path"])
                    validation = validate_glb(glb_path)
                    if not validation["valid"]:
                        raise RuntimeError(f"GLB validation failed: {validation['errors']}")

                    geometry = validate_glb_geometry(glb_path)
                    if not geometry["valid"]:
                        raise RuntimeError(f"GLB geometry validation failed: {geometry['errors']}")

                    meta_validation = validate_metadata(output)
                    if not meta_validation["valid"]:
                        raise RuntimeError(f"Metadata validation failed: {meta_validation['errors']}")

                    # Non-fatal fit-accuracy check: WARN only (generation still
                    # completes). Stub avatars emit no fit_accuracy -> no warnings.
                    for w in validate_fit_accuracy(output):
                        logger.warning("avatar task %s fit-accuracy: %s", task_id, w)

                    avatar_queue.complete_task(task_id, output)
                    logger.info(f"Avatar task {task_id} completed successfully")
                except Exception as e:
                    logger.error(f"Avatar task {task_id} failed: {e}")
                    if not avatar_queue.fail_task(task_id, str(e)):
                        logger.warning(f"Avatar task {task_id} was no longer RUNNING — left as it is; another worker or the stale sweep moved it on.")

            # --- Rigging task (skip when stub provider to avoid producing placeholder boxes) ---
            rigging_task = (rigging_queue.claim_task()
                            if rigging_enabled and "rigging" in roles else None)
            if rigging_task is not None:
                processed_any = True
                task_id = rigging_task["id"]
                garment_asset_id = rigging_task["garment_asset_id"]
                logger.info(f"Claimed rigging task {task_id} for garment asset {garment_asset_id}")
                try:
                    input_payload = json.loads(rigging_task["input_payload"]) if rigging_task.get("input_payload") else {}
                    with task_heartbeat(rigging_queue, task_id):
                        output = rigging_provider.generate(task_id, garment_asset_id, input_payload)

                    rigged_path = output.get("rigged_glb_path", "")
                    absolute_path = os.path.join(OUTPUT_BASE_DIR, rigged_path) if rigged_path else ""

                    if not absolute_path or not os.path.isfile(absolute_path):
                        logger.error(f"Rigging task {task_id}: output file not found: {rigged_path!r}")
                        rigging_queue.fail_task(
                            task_id,
                            f"Rigged GLB file not found: {rigged_path}",
                            "OUTPUT_MISSING",
                        )
                        continue

                    slot_hint_value = input_payload.get("slot_hint") if isinstance(input_payload, dict) else None
                    validation = validate_rigged_glb(absolute_path, slot_hint=slot_hint_value)
                    if not validation["valid"]:
                        logger.warning(f"Rigging task {task_id}: GLB validation failed: {validation['errors']}")
                        rigging_queue.fail_task(
                            task_id,
                            f"Rigged GLB validation failed: {'; '.join(validation['errors'])}",
                            "VALIDATION_FAILED",
                        )
                        continue

                    # L4: independent geometry re-check (defense-in-depth), keeping the
                    # rigging path consistent with the model + avatar paths. Rigged garment
                    # meshes are garment-sized, so triangle_count/bbox stay within thresholds.
                    geometry = validate_glb_geometry(absolute_path)
                    if not geometry["valid"]:
                        logger.warning(
                            f"Rigging task {task_id}: geometry validation failed: {geometry['errors']}"
                        )
                        rigging_queue.fail_task(
                            task_id,
                            f"Rigged GLB geometry validation failed: {'; '.join(geometry['errors'])}",
                            "VALIDATION_FAILED",
                        )
                        continue

                    # Phase 0 drape-realism baseline: non-blocking audit of whether the
                    # rigged GLB carries material + UV. Logged (never fails the task) so the
                    # "untextured garment" ratio is greppable via the MATERIAL_AUDIT prefix
                    # until B1 restores materials (then this can become a hard check).
                    material = validate_material_and_uv(absolute_path)
                    logger.info(
                        "MATERIAL_AUDIT task=%s garment=%s has_material=%s has_texcoord=%s",
                        task_id,
                        garment_asset_id,
                        material["has_material"],
                        material["has_texcoord"],
                    )

                    # Phase 3 drape-realism baseline: non-blocking audit of the geometric
                    # push-out (A1). Only PythonRiggingProvider emits a "penetration" block;
                    # greppable via the PENETRATION_AUDIT prefix for the self-collision-count
                    # metric (penetrating vertices before/after push-out).
                    pen = output.get("penetration") if isinstance(output, dict) else None
                    if pen:
                        logger.info(
                            "PENETRATION_AUDIT task=%s garment=%s before=%s after=%s pushed=%s thickness_m=%s",
                            task_id,
                            garment_asset_id,
                            pen.get("penetrating_before"),
                            pen.get("penetrating_after"),
                            pen.get("vertices_pushed"),
                            pen.get("fabric_thickness_m"),
                        )

                    rigging_queue.complete_task(task_id, output)
                    logger.info(f"Rigging task {task_id} completed successfully")
                except MemoryError:
                    logger.error(f"Rigging task {task_id} ran out of memory")
                    rigging_queue.fail_task(
                        task_id,
                        "Insufficient memory for rigging operation",
                        "OUT_OF_MEMORY",
                    )
                except Exception as e:
                    failure_code = getattr(e, "failure_code", None)
                    logger.error(f"Rigging task {task_id} failed: {e}")
                    rigging_queue.fail_task(task_id, str(e), failure_code)

            if not processed_any:
                time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Worker shutting down")
            break
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
