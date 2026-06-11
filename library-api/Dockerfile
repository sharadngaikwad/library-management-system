FROM python:3.12-slim

WORKDIR /app

# 1. Install required system packages for database adapters and C bindings
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Leverage Docker cache layer optimization for python libraries
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy over the rest of your root directory layout (app, proto, server.py, codegen.py)
COPY . .

# 4. Programmatically generate library_pb2 files on the fly during image creation
RUN python codegen.py

EXPOSE 50051

# 5. the entrypoint to the new root server
CMD ["python", "server.py"]