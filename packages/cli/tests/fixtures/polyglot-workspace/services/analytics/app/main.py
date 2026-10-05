import os

from fastapi import FastAPI

app = FastAPI()
BILLING_URL = os.environ["BILLING_URL"]


@app.get("/health")
def health():
    return {"ok": True, "billing": BILLING_URL}
