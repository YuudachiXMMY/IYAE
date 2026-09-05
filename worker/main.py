"""IYAE 3D Model Generation Worker."""
import os
import time
import json
import logging

from task_queue import TaskQueue
from avatar_task_queue import AvatarTaskQueue
from rigging_task_queue import RiggingTaskQueue
from providers.stub_generator import StubGenerator
from providers.tripo_generator import TripoGenerator
from providers.smplx_stub_provider import SmplxStubProvider
from providers.stub_rigging_provider import StubRiggingProvider
from validator import validate_glb, validate_metadata, validate_usdz, validate_rigged_glb

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

POLL_INTERVAL = int(os.environ.get("WORKER_POLL_INTERVAL", "5"))
OUTPUT_BASE_DIR = os.environ.get("WORKER_OUTPUT_DIR", "/var/iyae/assets")


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
        return MeshyGenerator(api_key=api_key, output_base_dir=OUTPUT_BASE_DIR)
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
    logger.info(
        f"Model provider: {provider.__class__.__name__}, "
        f"Avatar provider: {avatar_provider.__class__.__name__}, "
        f"Rigging provider: {rigging_provider.__class__.__name__} "
        f"({'active' if rigging_enabled else 'stub — skipping rigging tasks'}), "
        f"polling every {POLL_INTERVAL}s"
    )

    poll_count = 0
    while True:
        poll_count += 1
        try:
            if poll_count % 12 == 0:
                try:
                    reclaimed = queue.reclaim_stale_tasks()
                    if reclaimed > 0:
                        logger.info(f"Reclaimed {reclaimed} stale model tasks")
                except Exception as e:
                    logger.error(f"Failed to reclaim stale model tasks: {e}")
                try:
                    reclaimed = avatar_queue.reclaim_stale_tasks()
                    if reclaimed > 0:
                        logger.info(f"Reclaimed {reclaimed} stale avatar tasks")
                except Exception as e:
                    logger.error(f"Failed to reclaim stale avatar tasks: {e}")
                if rigging_enabled:
                    try:
                        reclaimed = rigging_queue.reclaim_stale_tasks()
                        if reclaimed > 0:
                            logger.info(f"Reclaimed {reclaimed} stale rigging tasks")
                    except Exception as e:
                        logger.error(f"Failed to reclaim stale rigging tasks: {e}")

            # Process both queues fairly each cycle
            processed_any = False

            # --- Product task ---
            task = queue.claim_task()
            if task is not None:
                processed_any = True
                task_id = task["id"]
                product_id = task["product_id"]
                logger.info(f"Claimed model task {task_id} for product {product_id}")
                try:
                    input_payload = json.loads(task["input_payload"]) if task["input_payload"] else None
                    output = provider.generate(task_id, product_id, input_payload)

                    glb_path = os.path.join(OUTPUT_BASE_DIR, output["glb_path"])
                    validation = validate_glb(glb_path)
                    if not validation["valid"]:
                        raise RuntimeError(f"GLB validation failed: {validation['errors']}")

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
                    queue.fail_task(task_id, str(e))
                    logger.warning(f"Model task {task_id} marked as FAILED. Use designer retry endpoint to re-queue.")

            # --- Avatar task ---
            avatar_task = avatar_queue.claim_task()
            if avatar_task is not None:
                processed_any = True
                task_id = avatar_task["id"]
                user_id = avatar_task["user_id"]
                logger.info(f"Claimed avatar task {task_id} for user {user_id}")
                try:
                    input_payload = json.loads(avatar_task["input_payload"]) if avatar_task["input_payload"] else None
                    output = avatar_provider.generate(task_id, user_id, input_payload)

                    glb_path = os.path.join(OUTPUT_BASE_DIR, output["glb_path"])
                    validation = validate_glb(glb_path)
                    if not validation["valid"]:
                        raise RuntimeError(f"GLB validation failed: {validation['errors']}")

                    meta_validation = validate_metadata(output)
                    if not meta_validation["valid"]:
                        raise RuntimeError(f"Metadata validation failed: {meta_validation['errors']}")

                    avatar_queue.complete_task(task_id, output)
                    logger.info(f"Avatar task {task_id} completed successfully")
                except Exception as e:
                    logger.error(f"Avatar task {task_id} failed: {e}")
                    avatar_queue.fail_task(task_id, str(e))

            # --- Rigging task (skip when stub provider to avoid producing placeholder boxes) ---
            rigging_task = rigging_queue.claim_task() if rigging_enabled else None
            if rigging_task is not None:
                processed_any = True
                task_id = rigging_task["id"]
                garment_asset_id = rigging_task["garment_asset_id"]
                logger.info(f"Claimed rigging task {task_id} for garment asset {garment_asset_id}")
                try:
                    input_payload = json.loads(rigging_task["input_payload"]) if rigging_task.get("input_payload") else {}
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
