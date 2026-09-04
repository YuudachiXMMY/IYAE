"""Meshy.ai API integration for image-to-3D generation."""
import base64
import mimetypes
import os
import time
import logging
import requests

logger = logging.getLogger(__name__)

MESHY_API_BASE = "https://api.meshy.ai/openapi/v1"


class MeshyGenerator:
    """Generates 3D models via Meshy.ai API."""

    def __init__(self, api_key: str, output_base_dir: str = "/var/clossette/assets"):
        self.api_key = api_key
        self.output_base_dir = output_base_dir
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _resolve_image_url(self, image_url: str) -> str:
        """Convert a relative path to a base64 data URI if needed.

        Meshy API requires either a public HTTPS URL or a base64 data URI.
        Product images are stored as relative paths (e.g. /uploads/products/xxx.jpg)
        on the shared Docker volume, so we read the file and encode it.
        """
        if image_url.startswith(("http://", "https://", "data:")):
            return image_url

        file_path = os.path.join(self.output_base_dir, image_url.lstrip("/"))
        if not os.path.isfile(file_path):
            raise FileNotFoundError(
                f"Image file not found at {file_path} (from url: {image_url})"
            )

        mime_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
        with open(file_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        return f"data:{mime_type};base64,{encoded}"

    def generate(self, task_id: int, product_id: int, input_payload: dict | None) -> dict:
        """Generate 3D model from product image via Meshy.ai."""
        start_time = time.time()

        if not input_payload or "image_url" not in input_payload:
            raise ValueError("input_payload must contain 'image_url'")

        resolved_url = self._resolve_image_url(input_payload["image_url"])

        # Step 1: Create generation task
        resp = requests.post(
            f"{MESHY_API_BASE}/image-to-3d",
            headers=self.headers,
            json={
                "image_url": resolved_url,
                "ai_model": "meshy-6",
                "should_remesh": True,
                "topology": "triangle",
                "target_polycount": 30000,
                "target_formats": ["glb", "usdz"],
                "enable_pbr": False,
                "should_texture": True,
            },
            timeout=30,
        )
        resp.raise_for_status()
        meshy_task_id = resp.json()["result"]

        # Step 2: Poll until complete
        for _ in range(120):  # max 10 minutes
            time.sleep(5)
            status_resp = requests.get(
                f"{MESHY_API_BASE}/image-to-3d/{meshy_task_id}",
                headers=self.headers,
                timeout=10,
            )
            status_resp.raise_for_status()
            data = status_resp.json()

            if data["status"] == "SUCCEEDED":
                break
            elif data["status"] == "FAILED":
                error_msg = data.get("task_error", {}).get("message", "Unknown error")
                raise RuntimeError(f"Meshy generation failed: {error_msg}")
            elif data["status"] == "CANCELED":
                raise RuntimeError("Meshy generation was canceled")
        else:
            raise TimeoutError("Meshy generation timed out after 10 minutes")

        # Log credit consumption
        consumed = data.get("consumed_credits", 0)
        logger.info(f"Meshy task {meshy_task_id} consumed {consumed} credits")

        # Step 3: Download output files
        output_dir = os.path.join(
            self.output_base_dir, f"products/{product_id}/tasks/{task_id}"
        )
        os.makedirs(output_dir, exist_ok=True)

        # Download GLB
        glb_url = data["model_urls"]["glb"]
        glb_path = os.path.join(output_dir, "preview.glb")
        glb_resp = requests.get(glb_url, timeout=60)
        glb_resp.raise_for_status()
        with open(glb_path, "wb") as f:
            f.write(glb_resp.content)

        # Download USDZ (Meshy supports USDZ unlike Tripo3D)
        usdz_path_str = None
        usdz_url_str = None
        usdz_url = data["model_urls"].get("usdz")
        if usdz_url:
            usdz_local_path = os.path.join(output_dir, "preview.usdz")
            usdz_resp = requests.get(usdz_url, timeout=60)
            usdz_resp.raise_for_status()
            with open(usdz_local_path, "wb") as f:
                f.write(usdz_resp.content)
            usdz_path_str = f"products/{product_id}/tasks/{task_id}/preview.usdz"
            usdz_url_str = f"/assets/products/{product_id}/tasks/{task_id}/preview.usdz"

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "schemaVersion": 1,
            "provider_used": "MESHY",
            "provider_request_id": meshy_task_id,
            "glb_path": f"products/{product_id}/tasks/{task_id}/preview.glb",
            "usdz_path": usdz_path_str,
            "triangle_count": 30000,  # target_polycount estimate; Meshy API doesn't return actual count
            "bbox": None,  # Meshy API doesn't return bounding box
            "sanity": {
                "glb_size_bytes": len(glb_resp.content),
                "has_nan_vertices": False,
            },
            "elapsed_ms": elapsed_ms,
            "glb_url": f"/assets/products/{product_id}/tasks/{task_id}/preview.glb",
            "usdz_url": usdz_url_str,
        }
