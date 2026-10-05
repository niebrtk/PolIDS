import os
import tempfile

os.environ["VPANDORA_DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db").replace("\\", "/")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.app import main  # noqa: E402
from backend.app.routers import aerodromes, meteo  # noqa: E402

METAR = "EPWA 051630Z 28015KT 9999 FEW030 12/05 Q1012 NOSIG"


@pytest.fixture(scope="module")
def client():
    async def fake_metars(icaos):
        return {i: METAR.replace("EPWA", i) for i in icaos}

    async def fake_tafs(icaos):
        return {i: f"TAF {i} 051100Z 0512/0618 28012KT 9999 FEW030" for i in icaos}

    for mod in (aerodromes, meteo):
        mod.get_metars, mod.get_tafs = fake_metars, fake_tafs
    with TestClient(main.app) as c:
        yield c


def test_frontend_and_config(client):
    assert "vPANDORA" in client.get("/").text
    cfg = client.get("/api/config").json()
    assert cfg["links"]["inop"].startswith("https://om.plvacc.pl")


def test_aerodrome_status(client):
    st = client.get("/api/aerodromes/EPWA/status").json()
    assert st["parsed"]["qnh"] == 1012
    assert st["suggested_runway"] == "29"
    assert client.get("/api/aerodromes/XXXX/status").status_code == 404


def test_meteo_and_qnh(client):
    m = client.get("/api/meteo/metar?ids=EPWA,EPKK").json()
    assert m[1]["parsed"]["station"] == "EPKK"
    q = client.get("/api/meteo/qnh-regions").json()
    assert all(r["qnh"] == 1012 for r in q["regions"])


def test_aircraft_and_callsigns(client):
    a = client.get("/api/aircraft?q=B738").json()
    assert a and a[0]["recat"] == "D" and a[0]["wingspan"] > 30
    assert client.get("/api/callsigns?q=LOT").json()[0]["telephony"] == "POLLOT"


def test_route_without_navdata(client):
    r = client.get("/api/nav/route?route=EPWA DCT EPKK").json()
    assert [p["ident"] for p in r["points"]] == ["EPWA", "EPKK"] and 120 < r["distance_nm"] < 140
