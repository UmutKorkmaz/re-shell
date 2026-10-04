import { BackendTemplate } from '../types';

export const mojoFastapiTemplate: BackendTemplate = {
  id: 'mojo-fastapi',
  name: 'mojo-fastapi',
  displayName: 'Mojo + FastAPI (AI Services)',
  description: 'FastAPI service whose SIMD kernels are Mojo 1.x compiled to a Python extension module, with a pure-Python fallback',
  language: 'mojo',
  framework: 'mojo-fastapi',
  version: '1.0.0',
  tags: ['mojo', 'fastapi', 'python', 'ai', 'ml', 'simd', 'hybrid', 'performance'],
  port: 8080,
  dependencies: {},
  features: ['rest-api', 'validation', 'cors', 'documentation', 'testing', 'python-interop', 'graphql', 'simd', 'docker'],

  files: {
    'engine.py': `"""Compute engine for {{projectName}}.

Uses the compiled Mojo module (\`mojo_bindings\`, built from mojo_bindings.mojo)
when it is importable and falls back to an equivalent pure-Python
implementation otherwise, so the API runs before the Mojo toolchain is set up.
"""
import math
import time
from typing import List

try:
    import mojo_bindings as _mojo
except ImportError:  # the shared library has not been built
    _mojo = None


def weight(i: int) -> float:
    """Deterministic demo weight for input feature \`i\` (same as the Mojo side)."""
    return ((i % 7) - 3) * 0.05


def engine_name() -> str:
    return _mojo.engine() if _mojo is not None else "python"


def dot(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        raise ValueError("vectors must have the same length")
    if _mojo is not None:
        return _mojo.dot(a, b)
    return sum(x * y for x, y in zip(a, b))


def predict(features: List[float], model_type: str) -> dict:
    if not features:
        raise ValueError("features must not be empty")
    if _mojo is not None:
        return _mojo.predict(features, model_type)
    start = time.perf_counter()
    score = sum(x * weight(i) for i, x in enumerate(features))
    probability = 1.0 / (1.0 + math.exp(-score))
    return {
        "prediction": probability,
        "confidence": abs(2.0 * probability - 1.0),
        "model_type": model_type,
        "engine": "python",
        "inference_time_ms": (time.perf_counter() - start) * 1000.0,
    }
`,

    'fastapi_app.py': `"""
{{projectName}} - FastAPI service backed by Mojo kernels
"""
import os
import time
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from strawberry.fastapi import GraphQLRouter

import engine
from graphql_schema import schema

app = FastAPI(
    title="{{projectName}}",
    description="Mojo/FastAPI hybrid AI/ML service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(GraphQLRouter(schema), prefix="/graphql")


class PredictionRequest(BaseModel):
    features: List[float] = Field(min_length=1)
    model_type: str = "mojo-simd"


class DotRequest(BaseModel):
    a: List[float]
    b: List[float]


@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "engine": engine.engine_name()}


@app.post("/api/v1/predict")
def predict(request: PredictionRequest):
    """Run the demo model on one feature vector."""
    return engine.predict(request.features, request.model_type)


@app.post("/api/v1/predict/batch")
def predict_batch(requests: List[PredictionRequest]):
    """Run the demo model on several feature vectors."""
    return {"predictions": [engine.predict(r.features, r.model_type) for r in requests]}


@app.post("/api/v1/dot")
def dot(request: DotRequest):
    """SIMD dot product of two vectors."""
    try:
        return {"dot": engine.dot(request.a, request.b), "engine": engine.engine_name()}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/v1/model/info")
def model_info():
    return {
        "model_type": "mojo-simd-logistic-demo",
        "engine": engine.engine_name(),
        "description": "single logistic unit with deterministic demo weights",
    }


@app.post("/api/v1/benchmark")
def benchmark(request: PredictionRequest, iterations: int = 100):
    """Time repeated predictions."""
    iterations = max(1, min(iterations, 10000))
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        engine.predict(request.features, request.model_type)
        times.append((time.perf_counter() - start) * 1000.0)
    avg = sum(times) / len(times)
    return {
        "engine": engine.engine_name(),
        "iterations": iterations,
        "avg_inference_time_ms": avg,
        "min_inference_time_ms": min(times),
        "max_inference_time_ms": max(times),
        "throughput_per_second": 1000.0 / avg if avg > 0 else None,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
`,

    'graphql_schema.py': `"""
{{projectName}} - GraphQL schema (strawberry-graphql)
"""
from typing import List

import strawberry

import engine


@strawberry.type
class Prediction:
    prediction: float
    confidence: float
    engine: str


@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "Hello from Mojo/FastAPI GraphQL!"

    @strawberry.field
    def engine(self) -> str:
        return engine.engine_name()

    @strawberry.field
    def predict(self, features: List[float]) -> Prediction:
        result = engine.predict(features, "mojo-simd")
        return Prediction(
            prediction=result["prediction"],
            confidence=result["confidence"],
            engine=result["engine"],
        )


schema = strawberry.Schema(query=Query)
`,

    'mojo_bindings.mojo': `# {{projectName}} - Mojo kernels exposed to Python
#
# Build:   mojo build mojo_bindings.mojo --emit shared-lib -o mojo_bindings.so
# Python:  import mojo_bindings
#
# The model is a single logistic unit with deterministic demo weights. It
# shows the shape of a Mojo/Python split (SIMD inference in Mojo, HTTP in
# FastAPI); replace \`weight\` and \`predict\` with a real model.
from std.math import exp
from std.os import abort
from std.python import Python, PythonObject
from std.python.bindings import PythonModuleBuilder
from std.sys import simd_width_of
from std.time import perf_counter_ns

comptime DT = DType.float64
comptime WIDTH = simd_width_of[DT]()


def weight(i: Int) -> Float64:
    """Deterministic demo weight for input feature \`i\`."""
    return Float64((i % 7) - 3) * 0.05


def to_floats(values: PythonObject) raises -> List[Float64]:
    var out = List[Float64]()
    for v in values:
        out.append(Float64(py=v))
    return out^


def dot_kernel(a: List[Float64], b: List[Float64]) -> Float64:
    """SIMD dot product; callers guarantee equal lengths."""
    var n = len(a)
    var pa = a.unsafe_ptr()
    var pb = b.unsafe_ptr()
    var acc = SIMD[DT, WIDTH](0)
    var i = 0
    while i + WIDTH <= n:
        acc += pa.unsafe_load[width=WIDTH](i) * pb.unsafe_load[width=WIDTH](i)
        i += WIDTH
    var total = acc.reduce_add()
    while i < n:
        total += a[i] * b[i]
        i += 1
    return total


def py_dot(a: PythonObject, b: PythonObject) raises -> PythonObject:
    var xs = to_floats(a)
    var ys = to_floats(b)
    if len(xs) != len(ys):
        raise Error("vectors must have the same length")
    return PythonObject(dot_kernel(xs, ys))


def py_predict(features: PythonObject, model_type: PythonObject) raises -> PythonObject:
    var start = perf_counter_ns()
    var xs = to_floats(features)
    if len(xs) == 0:
        raise Error("features must not be empty")
    var ws = List[Float64](capacity=len(xs))
    for i in range(len(xs)):
        ws.append(weight(i))
    var score = dot_kernel(xs, ws)
    var probability = 1.0 / (1.0 + exp(-score))
    var confidence = abs(2.0 * probability - 1.0)
    var result = Python.dict()
    result["prediction"] = probability
    result["confidence"] = confidence
    result["model_type"] = model_type
    result["engine"] = "mojo"
    result["inference_time_ms"] = Float64(perf_counter_ns() - start) / 1_000_000.0
    return result


def py_health() raises -> PythonObject:
    return PythonObject("mojo")


@export
def PyInit_mojo_bindings() abi("C") -> PythonObject:
    try:
        var m = PythonModuleBuilder("mojo_bindings")
        m.def_function[py_dot]("dot", docstring="SIMD dot product of two lists")
        m.def_function[py_predict]("predict", docstring="Demo model inference")
        m.def_function[py_health]("engine", docstring="Name of the compute engine")
        return m.finalize()
    except e:
        abort(String("failed to create mojo_bindings: ", e))
`,

    'pixi.toml': `[workspace]
name = "{{projectName}}"
version = "1.0.0"
description = "FastAPI service backed by Mojo kernels"
channels = ["https://conda.modular.com/max", "conda-forge"]
platforms = ["linux-64", "linux-aarch64", "osx-arm64"]

[dependencies]
mojo = ">=1.0.0,<2"
python = ">=3.10,<3.14"
pip = "*"

[tasks]
# The Mojo compiler comes from the conda channel above, so only the Python
# packages are installed with pip (requirements-mojo.txt is for pip-only setups).
install = "pip install -r requirements-test.txt"
build = "mojo build mojo_bindings.mojo --emit shared-lib -o mojo_bindings.so"
start = "python fastapi_app.py"
test = "pytest"
`,

    'pytest.ini': `[pytest]
testpaths = tests
addopts = -v --tb=short
`,

    'requirements-test.txt': `-r requirements.txt
pytest==9.1.1
httpx==0.28.1
`,

    'requirements-mojo.txt': `# The Mojo compiler from PyPI, for setups without pixi. It is needed to build
# mojo_bindings.so, and the built module loads its runtime libraries from this
# package; without it the API falls back to pure Python.
mojo==1.1.0
`,

    'requirements.txt': `# {{projectName}} Python dependencies
fastapi==0.142.2
uvicorn[standard]==0.54.0
pydantic==2.13.5
strawberry-graphql[fastapi]==0.330.2
`,

    'tests/__init__.py': `"""{{projectName}} tests."""
`,

    'tests/test_api.py': `from fastapi.testclient import TestClient

from fastapi_app import app

client = TestClient(app)


def test_health():
    for path in ("/health", "/api/v1/health"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


def test_predict():
    response = client.post("/api/v1/predict", json={"features": [0.1, 0.2, 0.3], "model_type": "demo"})
    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["prediction"] <= 1.0
    assert body["model_type"] == "demo"


def test_predict_validation():
    assert client.post("/api/v1/predict", json={"features": []}).status_code == 422
    assert client.post("/api/v1/predict", json={}).status_code == 422


def test_predict_batch():
    payload = [{"features": [1.0, 2.0]}, {"features": [3.0, 4.0, 5.0]}]
    response = client.post("/api/v1/predict/batch", json=payload)
    assert response.status_code == 200
    assert len(response.json()["predictions"]) == 2


def test_dot():
    response = client.post("/api/v1/dot", json={"a": [1, 2, 3], "b": [4, 5, 6]})
    assert response.status_code == 200
    assert response.json()["dot"] == 32.0


def test_dot_length_mismatch():
    response = client.post("/api/v1/dot", json={"a": [1, 2, 3], "b": [4]})
    assert response.status_code == 400


def test_model_info():
    assert client.get("/api/v1/model/info").json()["engine"] in ("mojo", "python")


def test_benchmark():
    response = client.post("/api/v1/benchmark?iterations=5", json={"features": [1.0, 2.0, 3.0]})
    assert response.status_code == 200
    assert response.json()["iterations"] == 5


def test_graphql():
    response = client.post("/graphql", json={"query": "{ hello engine }"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["hello"].startswith("Hello")
    assert data["engine"] in ("mojo", "python")
`,

    'tests/test_engine.py': `"""Engine tests: run against Mojo when mojo_bindings is built, Python otherwise."""
import math

import pytest

import engine


def reference_prediction(features):
    score = sum(x * engine.weight(i) for i, x in enumerate(features))
    return 1.0 / (1.0 + math.exp(-score))


def test_dot():
    a = [float(i) for i in range(37)]
    b = [0.5] * 37
    assert engine.dot(a, b) == pytest.approx(sum(x * y for x, y in zip(a, b)))


def test_dot_length_mismatch():
    with pytest.raises(Exception):
        engine.dot([1.0, 2.0], [1.0])


def test_predict_matches_reference():
    features = [0.1 * i for i in range(20)]
    result = engine.predict(features, "demo")
    assert result["prediction"] == pytest.approx(reference_prediction(features))
    assert 0.0 <= result["prediction"] <= 1.0
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["model_type"] == "demo"
    assert result["inference_time_ms"] >= 0.0


def test_predict_rejects_empty_features():
    with pytest.raises(Exception):
        engine.predict([], "demo")


def test_engine_name():
    assert engine.engine_name() in ("mojo", "python")
`,

    '.gitignore': `# Mojo build output
*.so
*.dylib
*.o
bin/
build/
dist/

# Python
__pycache__/
*.py[cod]
.venv/
.pytest_cache/

# Pixi
.pixi/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# Logs
*.log

# OS
.DS_Store
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
    restart: unless-stopped
`,

    'Dockerfile': `FROM python:3.12-slim

# build-essential provides the linker libraries \`mojo build\` needs. The Mojo
# package stays installed in the image: mojo_bindings.so loads its runtime
# libraries from it.
RUN apt-get update \\
    && apt-get install -y --no-install-recommends build-essential \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt requirements-mojo.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-mojo.txt

COPY . .
RUN mojo build mojo_bindings.mojo --emit shared-lib -o mojo_bindings.so

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "fastapi_app.py"]
`,

    'README.md': `# {{projectName}}

A FastAPI service whose compute kernels are written in
[Mojo](https://www.modular.com/mojo) 1.x and compiled into a Python extension
module (\`mojo_bindings.so\`).

- \`mojo_bindings.mojo\` - SIMD dot product and a demo model, exported to Python
  with \`PythonModuleBuilder\`
- \`engine.py\` - imports \`mojo_bindings\` when it has been built and falls back to
  an equivalent pure-Python implementation otherwise, so the API runs (and the
  tests pass) with or without the Mojo toolchain
- \`fastapi_app.py\` - REST API, plus GraphQL at \`/graphql\` (strawberry-graphql)

The model is a single logistic unit with deterministic demo weights. It shows
the shape of the split; replace \`weight\` and \`py_predict\` (and the Python
fallback in \`engine.py\`) with your own model.

## Setup

Python 3.10 or newer.

\`\`\`bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-test.txt      # API and test dependencies
pip install -r requirements-mojo.txt      # the Mojo compiler (PyPI package \`mojo\`)
\`\`\`

Build the extension module (optional; without it the Python fallback is used):

\`\`\`bash
mojo build mojo_bindings.mojo --emit shared-lib -o mojo_bindings.so
\`\`\`

The compiled module loads its runtime libraries from the installed \`mojo\`
package, so keep that package installed next to it.

With [pixi](https://pixi.sh) instead of pip: \`pixi install\` (the Mojo compiler
comes from Modular's conda channel, so skip \`requirements-mojo.txt\`), then
\`pixi run install\`, \`pixi run build\`, \`pixi run start\` and \`pixi run test\`.

## Run and test

\`\`\`bash
python fastapi_app.py        # http://localhost:8080 (PORT overrides the port)
pytest
\`\`\`

\`GET /health\` reports which engine is active (\`mojo\` or \`python\`).

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | \`/health\`, \`/api/v1/health\` | Status and active engine |
| POST | \`/api/v1/predict\` | \`{"features": [...], "model_type": "..."}\` |
| POST | \`/api/v1/predict/batch\` | List of prediction requests |
| POST | \`/api/v1/dot\` | \`{"a": [...], "b": [...]}\` |
| GET | \`/api/v1/model/info\` | Model description |
| POST | \`/api/v1/benchmark?iterations=100\` | Time repeated predictions |
| POST | \`/graphql\` | \`hello\`, \`engine\` and \`predict(features:)\` queries |

Interactive docs are served at \`/docs\`.

\`\`\`bash
curl -X POST http://localhost:8080/api/v1/predict \\
  -H 'Content-Type: application/json' -d '{"features": [0.1, 0.2, 0.3]}'
\`\`\`

## Docker

\`\`\`bash
docker compose up --build
\`\`\`

## License

MIT
`
  }
};
