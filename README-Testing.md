# Running Tests from Windows Command Prompt

## Navigate to the API Directory

```cmd
cd library-management-system\library-api
```

## 1. Create the Virtual Environment (if not already created)

```cmd
python -m venv venv
```

## 2. Upgrade pip

```cmd
python -m pip install --upgrade pip
```

> **Note:** Ensure you are inside the `library-api` folder before proceeding.

## 3. Activate the Virtual Environment

```cmd
venv\Scripts\activate.bat
```

## 4. Install Test Dependencies

### Install Pytest

```cmd
python -m pip install pytest pytest-mock
```

### Install Project Dependencies

```cmd
python -m pip install -r requirements.txt
```

### Ensure Compilation Tools Are Installed

```cmd
python -m pip install grpcio-tools protobuf
```

### Compile Protocol Buffer Contract

```cmd
python -m grpc_tools.protoc -I./proto --python_out=. --grpc_python_out=. ./proto/library.proto
```

## 5. Execute Service Test Suite

```cmd
python -m pytest app/services/
```

## Optional: Run Tests with Detailed Console Logging

```cmd
python -m pytest app/services/ -s -v
```

# Running Tests in Containers

## 1. Start the Containers

```cmd
docker compose up
```

## 2. Execute Pytest Inside the API Container

```cmd
docker compose exec library-api pytest app/services/ -s -v
```
