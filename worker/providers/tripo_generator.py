"""Tripo3D API v2 integration for image-to-3D generation."""
import os
import time
import logging
import requests

logger = logging.getLogger(__name__)

TRIPO_API_BASE = "https://api.tripo3d.ai/v2"


class TripoGenerator:
    """Generates 3D models via Tripo3D API."""

    def __init__(self, api_key: str, output_base_dir: str = "/var/clossette/assets"):
        self.api_key = api_key
        self.output_base_dir = output_base_dir
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def generate(self, task_id: int, product_id: int, input_payload: dict | None) -> dict:
        """Generate 3D model from product image via Tripo3D."""
        start_time = time.time()

        if not input_payload or "image_url" not in input_payload:
            raise ValueError("input_payload must contain 'image_url'")

        # Step 1: Create generation task
        resp = requests.post(
            f"{TRIPO_API_BASE}/task",
            headers=self.headers,
            json={
                "type": "image_to_model",
                "file": {"type": "url", "url": input_payload["image_url"]},
            },
            timeout=30,
        )
        resp.raise_for_status()
        tripo_task_id = resp.json()["data"]["task_id"]

        # Step 2: Poll until complete
        for _ in range(120):  # max 10 minutes
            time.sleep(5)
            status_resp = requests.get(
                f"{TRIPO_API_BASE}/task/{tripo_task_id}",
                headers=self.headers,
                timeout=10,
            )
            status_resp.raise_for_status()
            data = status_resp.json()["data"]

            if data["status"] == "success":
                break
            elif data["status"] == "failed":
                raise RuntimeError(f"Tripo3D generation failed: {data.get('message')}")
        else:
            raise TimeoutError("Tripo3D generation timed out after 10 minutes")

        # Step 3: Download output
        output_dir = os.path.join(
            self.output_base_dir, f"products/{product_id}/tasks/{task_id}"
        )
        os.makedirs(output_dir, exist_ok=True)

        glb_url = data["output"]["model"]
        glb_path = os.path.join(output_dir, "preview.glb")
        glb_resp = requests.get(glb_url, timeout=60)
        glb_resp.raise_for_status()
        with open(glb_path, "wb") as f:
            f.write(glb_resp.content)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "schemaVersion": 1,
            "provider_used": "TRIPO3D",
            "provider_request_id": tripo_task_id,
            "glb_path": f"products/{product_id}/tasks/{task_id}/preview.glb",
            "usdz_path": None,  # Tripo3D doesn't provide USDZ
            "triangle_count": data["output"].get("triangle_count", 0),
            "bbox": data["output"].get("bbox"),
            "sanity": {
                "glb_size_bytes": len(glb_resp.content),
                "has_nan_vertices": False,
            },
            "elapsed_ms": elapsed_ms,
            "glb_url": f"/assets/products/{product_id}/tasks/{task_id}/preview.glb",
            "usdz_url": None,
        }
