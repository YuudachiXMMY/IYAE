FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
# Install PyTorch CPU-only (lighter than full CUDA build)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
