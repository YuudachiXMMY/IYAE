# Meshy Image to 3D API

> Source: <https://docs.meshy.ai/en/api/image-to-3d>
>
> Last updated: 2026-06-01

Convert images into textured 3D models with customizable output formats and parameters.

- **Base URL:** `https://api.meshy.ai`
- **Authentication:** `Authorization: Bearer ${YOUR_API_KEY}`

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/openapi/v1/image-to-3d` | Create a new Image to 3D task |
| GET | `/openapi/v1/image-to-3d/:id` | Retrieve a task by ID |
| DELETE | `/openapi/v1/image-to-3d/:id` | Delete a task by ID |
| GET | `/openapi/v1/image-to-3d` | List tasks (paginated) |
| GET | `/openapi/v1/image-to-3d/:id/stream` | Stream task progress (SSE) |

---

## 1. Create Task

**POST** `/openapi/v1/image-to-3d`

### Request Body

#### Input Source (one required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_url` | string | One of | Publicly accessible URL or base64 data URI (`.jpg`, `.jpeg`, `.png`) |
| `input_task_id` | string | One of | Completed Text-to-Image or Image-to-Image task ID. Must have status `SUCCEEDED` and produce exactly one image. Takes priority if both provided |

#### Generation Parameters (optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model_type` | string | `"standard"` | `standard` \| `lowpoly` |
| `ai_model` | string | `"latest"` | `meshy-5` \| `meshy-6` \| `latest` |
| `should_texture` | boolean | `true` | Enable texture generation |
| `enable_pbr` | boolean | `false` | Generate PBR maps (metallic, roughness, normal, emission). Requires `should_texture: true` |
| `hd_texture` | boolean | `false` | 4K base color texture, 2K PBR maps (`meshy-6`/`latest` only) |
| `texture_prompt` | string | `""` | Text to guide texturing (max 600 chars, +10 credits). Mutually exclusive with `texture_image_url`; takes priority if both provided |
| `texture_image_url` | string | `""` | 2D image URL to guide texturing (+10 credits). Mutually exclusive with `texture_prompt` |
| `should_remesh` | boolean | `false` (meshy-6), `true` (others) | Enable remesh phase |
| `topology` | string | `"triangle"` | `quad` \| `triangle` |
| `target_polycount` | integer | `30000` | Range: 100--300,000 |
| `decimation_mode` | integer | -- | `1` (ultra) \| `2` (high) \| `3` (medium) \| `4` (low) |
| `save_pre_remeshed_model` | boolean | `false` | Store pre-remesh GLB |
| `pose_mode` | string | `""` | `a-pose` \| `t-pose` \| `""` (none) |
| `image_enhancement` | boolean | `true` | Optimize input image (`meshy-6`/`latest` only) |
| `remove_lighting` | boolean | `true` | Remove highlights/shadows (`meshy-6`/`latest` only) |
| `moderation` | boolean | `false` | Screen for harmful content |
| `target_formats` | string[] | -- | Subset of: `glb`, `obj`, `fbx`, `stl`, `usdz`, `3mf` |
| `auto_size` | boolean | `false` | AI auto-estimate real-world height |
| `origin_at` | string | `"bottom"` | Origin when `auto_size` enabled: `bottom` \| `center` |
| `multi_view_thumbnails` | boolean | `false` | Generate four cardinal-view thumbnail PNGs |

#### Deprecated Fields

| Field | Type | Default | Replacement |
|-------|------|---------|-------------|
| `symmetry_mode` | string | `"auto"` | -- (`off` \| `auto` \| `on`) |
| `is_a_t_pose` | boolean | `false` | Use `pose_mode` instead |

### Response

```json
{
  "result": "018a210d-8ba4-705c-b111-1f1776f7f578"
}
```

### Examples -- Simple

#### cURL

```bash
curl https://api.meshy.ai/openapi/v1/image-to-3d \
  -X POST \
  -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "image_url": "<your publicly accessible image url or base64-encoded data URI>"
  }'
```

#### Python

```python
import requests

headers = {"Authorization": f"Bearer {YOUR_API_KEY}"}
payload = {
    "image_url": "<your publicly accessible image url or base64-encoded data URI>",
}

response = requests.post(
    "https://api.meshy.ai/openapi/v1/image-to-3d",
    headers=headers,
    json=payload,
)
response.raise_for_status()
task_id = response.json()["result"]
print(task_id)
```

#### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

HttpClient client = HttpClient.newHttpClient();
String body = """
    {
      "image_url": "<your publicly accessible image url or base64-encoded data URI>"
    }
    """;

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.meshy.ai/openapi/v1/image-to-3d"))
    .header("Authorization", "Bearer " + YOUR_API_KEY)
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body()); // {"result": "<task_id>"}
```

### Examples -- Advanced (PBR + Remesh + A-Pose)

#### cURL

```bash
curl https://api.meshy.ai/openapi/v1/image-to-3d \
  -X POST \
  -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "image_url": "<your publicly accessible image url or base64-encoded data URI>",
    "enable_pbr": true,
    "should_remesh": true,
    "target_polycount": 100000,
    "should_texture": true,
    "pose_mode": "a-pose",
    "target_formats": ["glb"]
  }'
```

#### Python

```python
import requests

headers = {"Authorization": f"Bearer {YOUR_API_KEY}"}
payload = {
    "image_url": "<your publicly accessible image url or base64-encoded data URI>",
    "enable_pbr": True,
    "should_remesh": True,
    "target_polycount": 100000,
    "should_texture": True,
    "pose_mode": "a-pose",
    "target_formats": ["glb"],
}

response = requests.post(
    "https://api.meshy.ai/openapi/v1/image-to-3d",
    headers=headers,
    json=payload,
)
response.raise_for_status()
task_id = response.json()["result"]
print(task_id)
```

#### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

HttpClient client = HttpClient.newHttpClient();
String body = """
    {
      "image_url": "<your publicly accessible image url or base64-encoded data URI>",
      "enable_pbr": true,
      "should_remesh": true,
      "target_polycount": 100000,
      "should_texture": true,
      "pose_mode": "a-pose",
      "target_formats": ["glb"]
    }
    """;

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.meshy.ai/openapi/v1/image-to-3d"))
    .header("Authorization", "Bearer " + YOUR_API_KEY)
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());
```

---

## 2. Retrieve Task

**GET** `/openapi/v1/image-to-3d/:id`

#### cURL

```bash
curl https://api.meshy.ai/openapi/v1/image-to-3d/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

#### Python

```python
import requests

headers = {"Authorization": f"Bearer {YOUR_API_KEY}"}
task_id = "018a210d-8ba4-705c-b111-1f1776f7f578"

response = requests.get(
    f"https://api.meshy.ai/openapi/v1/image-to-3d/{task_id}",
    headers=headers,
)
response.raise_for_status()
task = response.json()
print(task["status"], task["progress"])
```

#### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

HttpClient client = HttpClient.newHttpClient();
String taskId = "018a210d-8ba4-705c-b111-1f1776f7f578";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.meshy.ai/openapi/v1/image-to-3d/" + taskId))
    .header("Authorization", "Bearer " + YOUR_API_KEY)
    .GET()
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());
```

### Task Object Response

#### Identifiers & Metadata

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier |
| `type` | string | Always `"image-to-3d"` |
| `created_at` | timestamp | Creation time (ms since epoch) |
| `started_at` | timestamp | Start time (`0` if not started) |
| `finished_at` | timestamp | Completion time (`0` if not finished) |
| `expires_at` | timestamp | Result expiration time |

#### Status & Progress

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `PENDING` \| `IN_PROGRESS` \| `SUCCEEDED` \| `FAILED` \| `CANCELED` |
| `progress` | integer | 0--100 percentage |
| `preceding_tasks` | integer | Count of queued tasks ahead |

#### Output Models (`model_urls`)

| Field | Type | Description |
|-------|------|-------------|
| `glb` | string | GLB file URL |
| `fbx` | string | FBX file URL |
| `obj` | string | OBJ file URL |
| `usdz` | string | USDZ file URL |
| `stl` | string | STL file URL |
| `mtl` | string | MTL file URL (with OBJ when textures present) |
| `3mf` | string | 3MF file URL (only if explicitly requested in `target_formats`) |
| `pre_remeshed_glb` | string | Original GLB before remeshing (if `save_pre_remeshed_model: true`) |

#### Thumbnails

| Field | Type | Description |
|-------|------|-------------|
| `thumbnail_url` | string | Front-view thumbnail (512×512 PNG) |
| `thumbnail_urls.front` | string | 0 deg rotation (when `multi_view_thumbnails` enabled) |
| `thumbnail_urls.right` | string | 90 deg rotation |
| `thumbnail_urls.back` | string | 180 deg rotation |
| `thumbnail_urls.left` | string | 270 deg rotation |

#### Textures (`texture_urls[]`)

Each entry in the `texture_urls` array:

| Field | Type | Condition |
|-------|------|-----------|
| `base_color` | string | Always present when textured |
| `metallic` | string | When `enable_pbr: true` |
| `normal` | string | When `enable_pbr: true` |
| `roughness` | string | When `enable_pbr: true` |
| `emission` | string | When `enable_pbr: true` (`meshy-6`/`latest`) |

#### Error & Credits

| Field | Type | Description |
|-------|------|-------------|
| `task_error.message` | string | Error description (empty string on success) |
| `consumed_credits` | integer | Credits used. Present for `PENDING`, `IN_PROGRESS`, `SUCCEEDED`. Returns `0` for `FAILED` (refunded) |
| `texture_prompt` | string | Text prompt used for texturing |
| `texture_image_url` | string | Image URL used for texturing |

### Full Response Example

```json
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "image-to-3d",
  "status": "SUCCEEDED",
  "progress": 100,
  "created_at": 1692771650657,
  "started_at": 1692771667037,
  "finished_at": 1692771669037,
  "expires_at": 1692771679037,
  "preceding_tasks": 0,
  "model_urls": {
    "glb": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/model.glb?Expires=***",
    "fbx": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/model.fbx?Expires=***",
    "obj": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/model.obj?Expires=***",
    "usdz": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/model.usdz?Expires=***",
    "stl": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/model.stl?Expires=***",
    "pre_remeshed_glb": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/pre_remeshed_model.glb?Expires=***"
  },
  "thumbnail_url": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/preview.png?Expires=***",
  "thumbnail_urls": {
    "front": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/preview_front.png?Expires=***",
    "right": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/preview_right.png?Expires=***",
    "back": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/preview_back.png?Expires=***",
    "left": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/preview_left.png?Expires=***"
  },
  "texture_prompt": "",
  "texture_image_url": "",
  "texture_urls": [
    {
      "base_color": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/texture_0.png?Expires=***",
      "metallic": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/texture_0_metallic.png?Expires=***",
      "normal": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/texture_0_normal.png?Expires=***",
      "roughness": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/texture_0_roughness.png?Expires=***",
      "emission": "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/texture_0_emission.png?Expires=***"
    }
  ],
  "task_error": {
    "message": ""
  },
  "consumed_credits": 30
}
```

---

## 3. Delete Task

**DELETE** `/openapi/v1/image-to-3d/:id`

#### cURL

```bash
curl --request DELETE \
  --url https://api.meshy.ai/openapi/v1/image-to-3d/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

#### Python

```python
import requests

headers = {"Authorization": f"Bearer {YOUR_API_KEY}"}
task_id = "018a210d-8ba4-705c-b111-1f1776f7f578"

response = requests.delete(
    f"https://api.meshy.ai/openapi/v1/image-to-3d/{task_id}",
    headers=headers,
)
response.raise_for_status()
```

#### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

HttpClient client = HttpClient.newHttpClient();
String taskId = "018a210d-8ba4-705c-b111-1f1776f7f578";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.meshy.ai/openapi/v1/image-to-3d/" + taskId))
    .header("Authorization", "Bearer " + YOUR_API_KEY)
    .DELETE()
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.statusCode()); // 200
```

Returns `200 OK` on success.

---

## 4. List Tasks

**GET** `/openapi/v1/image-to-3d`

### Query Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `page_num` | integer | `1` | Page number |
| `page_size` | integer | `10` | Items per page (max `50`) |
| `sort_by` | string | -- | `+created_at` (ascending) \| `-created_at` (descending) |

#### cURL

```bash
curl https://api.meshy.ai/openapi/v1/image-to-3d?page_size=10 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

#### Python

```python
import requests

headers = {"Authorization": f"Bearer {YOUR_API_KEY}"}
params = {"page_size": 10, "sort_by": "-created_at"}

response = requests.get(
    "https://api.meshy.ai/openapi/v1/image-to-3d",
    headers=headers,
    params=params,
)
response.raise_for_status()
tasks = response.json()
for task in tasks:
    print(task["id"], task["status"])
```

#### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

HttpClient client = HttpClient.newHttpClient();

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.meshy.ai/openapi/v1/image-to-3d?page_size=10&sort_by=-created_at"))
    .header("Authorization", "Bearer " + YOUR_API_KEY)
    .GET()
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body()); // JSON array of task objects
```

Returns an array of task objects (same schema as Retrieve).

---

## 5. Stream Task (SSE)

**GET** `/openapi/v1/image-to-3d/:id/stream`

Server-Sent Events stream for real-time progress updates.

#### cURL

```bash
curl -N https://api.meshy.ai/openapi/v1/image-to-3d/018a210d-8ba4-705c-b111-1f1776f7f578/stream \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

#### Python

```python
import requests

headers = {"Authorization": f"Bearer {YOUR_API_KEY}"}
task_id = "018a210d-8ba4-705c-b111-1f1776f7f578"

response = requests.get(
    f"https://api.meshy.ai/openapi/v1/image-to-3d/{task_id}/stream",
    headers=headers,
    stream=True,
)
response.raise_for_status()
for line in response.iter_lines(decode_unicode=True):
    if line.startswith("data:"):
        print(line[5:].strip())
```

#### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.stream.Stream;

HttpClient client = HttpClient.newHttpClient();
String taskId = "018a210d-8ba4-705c-b111-1f1776f7f578";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.meshy.ai/openapi/v1/image-to-3d/" + taskId + "/stream"))
    .header("Authorization", "Bearer " + YOUR_API_KEY)
    .GET()
    .build();

HttpResponse<Stream<String>> response = client.send(
    request, HttpResponse.BodyHandlers.ofLines());
response.body()
    .filter(line -> line.startsWith("data:"))
    .forEach(line -> System.out.println(line.substring(5).trim()));
```

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `{ id, progress, status }` | Progress update (while `PENDING` / `IN_PROGRESS`) |
| `message` | Full task object | Final result (on `SUCCEEDED`) |
| `error` | `{ status_code, message }` | Stream error |

### Example Events

```
event: message
data: {
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "progress": 0,
  "status": "PENDING"
}

event: message
data: { ...full task object on completion... }
```

---

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Bad request -- missing `image_url`/`input_task_id`, invalid input task (not `SUCCEEDED` or wrong type), unsupported image format, unreachable URL, malformed base64, invalid parameter combinations |
| `401` | Unauthorized -- API key authentication failed |
| `402` | Payment required -- insufficient credits |
| `429` | Too many requests -- rate limit exceeded |

---

## Credits

| Operation | Cost |
|-----------|------|
| Standard Image to 3D task | **30 credits** |
| Texture guidance (text prompt or image) | **+10 credits** |
| Failed tasks | **0 credits** |

---

## Important Notes

- Only formats listed in `target_formats` are generated; `3mf` is excluded by default
- `lowpoly` model type ignores: `ai_model`, `topology`, `target_polycount`, `should_remesh`, `save_pre_remeshed_model`
- `enable_pbr` requires `should_texture: true`
- Results expire after **3 days** (Enterprise customers can retain indefinitely)
- Timestamps are in **milliseconds** following RFC 3339
