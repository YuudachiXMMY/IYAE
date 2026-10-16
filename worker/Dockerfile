FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
# Install PyTorch CPU-only (lighter than full CUDA build)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged user. See server/Dockerfile for the full rationale: this container
# consumes third-party binary GLB payloads from Tripo3D/Meshy and runs native mesh code over
# them, so code execution here was code execution as root.
#
# uid 10001 MUST match server/Dockerfile and worker/Dockerfile.rigging — all three mount the
# same `assets_data` volume read-write.
RUN groupadd --gid 10001 iyae \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin iyae \
    && mkdir -p /var/iyae/assets \
    && chown -R 10001:10001 /var/iyae/assets

USER 10001:10001

CMD ["python", "main.py"]
