"""끝까지 흐름 시험: 올리기 → 분석 → 변환 → 결과 파일. 외부 서비스 없음."""
import os
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path))
    monkeypatch.setenv("REDIS_URL", "")
    import importlib
    from app import config, storage, jobs, main
    for m in (config, storage, jobs, main):
        importlib.reload(m)
    from fastapi.testclient import TestClient
    return TestClient(main.app)


def _upload(client, path, name="plan.dxf"):
    return client.post("/api/uploads", files={"file": (name, Path(path).read_bytes(), "application/octet-stream")})


def _wait(client, job_id, timeout=30):
    t = time.time()
    while time.time() - t < timeout:
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] in ("done", "failed"):
            return j
        time.sleep(0.1)
    raise AssertionError("timeout")


@pytest.mark.parametrize("sample,layer,mode", [("sample-plan.dxf", "A-WALL", "outline"), ("sample-plan-centerline.dxf", "A-WALL-CL", "centerline")])
def test_full_flow(client, sample, layer, mode):
    r = _upload(client, ROOT / "samples" / sample)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["kind"] == "dxf" and body["analysis"]["unit"] == "mm"
    walls = [l["name"] for l in body["analysis"]["layers"] if l["suggestedWall"]]
    assert walls == [layer]
    r = client.post("/api/jobs", json={"uploadId": body["uploadId"], "wallLayers": walls})
    assert r.status_code == 202
    j = _wait(client, r.json()["jobId"])
    assert j["status"] == "done", j
    assert j["metrics"]["mode"] == mode
    assert abs(j["metrics"]["floorAreaM2"] - 83.64) < 0.5  # 10.2m × 8.2m
    for k in ("glb", "obj", "stl"):
        f = client.get(j["files"][k]["url"])
        assert f.status_code == 200 and len(f.content) == j["files"][k]["bytes"]
    assert client.get(j["files"]["glb"]["url"]).content[:4] == b"glTF"
    assert "no-store" in client.get(f"/api/jobs/{j['id']}").headers["cache-control"]


def test_rejects_dwg_and_unknown(client):
    r = client.post("/api/uploads", files={"file": ("a.dwg", b"AC1032" + b"\0" * 100)})
    assert r.status_code == 415 and r.json()["error"]["code"] == "dwg_not_supported"
    r = client.post("/api/uploads", files={"file": ("a.dxf", b"<html><script>alert(1)</script>")})
    assert r.status_code == 415 and r.json()["error"]["code"] == "unsupported_type"


def test_image_is_cleaned_and_parked(client):
    from PIL import Image
    import io
    buf = io.BytesIO()
    im = Image.new("RGB", (40, 30), "white")
    exif = Image.Exif(); exif[0x8825] = {2: (37, 33, 0)}  # GPS 정보
    im.save(buf, format="JPEG", exif=exif)
    r = client.post("/api/uploads", files={"file": ("p.jpg", buf.getvalue())})
    assert r.status_code == 200 and r.json()["kind"] == "image"
    saved = Path(os.environ["STORAGE_DIR"]) / "uploads" / r.json()["uploadId"] / "source.png"
    assert saved.exists()
    assert not Image.open(saved).getexif()  # 위치 정보 없음


def test_bad_ids_and_layers(client):
    assert client.get("/api/jobs/../../etc/passwd").status_code == 404
    assert client.get("/api/jobs/" + "z" * 32).status_code == 404
    up = _upload(client, ROOT / "samples" / "sample-plan.dxf").json()
    r = client.post("/api/jobs", json={"uploadId": up["uploadId"], "wallLayers": ["NOPE"]})
    assert r.status_code == 422
    r = client.post("/api/jobs", json={"uploadId": up["uploadId"], "wallLayers": ["A-WALL"], "heightM": 100})
    assert r.status_code == 422
