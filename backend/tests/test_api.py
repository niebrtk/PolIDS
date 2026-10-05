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

    async def fake_feed():
        return {"general": {}, "controllers": [{"callsign": "EPWA_TWR", "frequency": "118.305", "name": "Ola", "cid": 3}],
                "atis": [{"callsign": "EPWA_ATIS", "frequency": "120.455", "atis_code": "B",
                          "text_atis": ["WARSAW CHOPIN INFORMATION B", "RWY 33 FOR LANDING 29 FOR TAKEOFF"]}],
                "pilots": [], "prefiles": []}
    aerodromes.get_feed = fake_feed
    with TestClient(main.app) as c:
        yield c


def test_frontend_and_config(client):
    assert "vPANDORA" in client.get("/").text
    cfg = client.get("/api/config").json()
    assert cfg["links"]["inop"].startswith("https://om.plvacc.pl")
    assert "learningzone.eurocontrol.int" in cfg["links"]["phraseology"] and "carto_api_key" in cfg
    assert "inop_hide_footer_px" not in cfg


def test_aerodrome_status(client):
    st = client.get("/api/aerodromes/EPWA/status").json()
    assert st["parsed"]["qnh"] == 1012
    assert st["suggested_runway"] == "29" and st["preferred"]["arr"] == "29"
    # kontrola online z ATIS: pas w użyciu z ATIS, litera B
    assert st["runway_in_use"] == {"arr": "33", "dep": "29", "source": "ATIS", "reason": "Z ATIS B"}
    assert st["atis"]["letter"] == "B" and st["atc_online"][0]["callsign"] == "EPWA_TWR"
    assert "ILS" in next(r for r in st["runways"] if r["designator"] == "33")["equipment"]
    chk = client.get("/api/aerodromes/EPWA/checklist").json()
    assert chk["id"] == "open-position" and chk["items"]
    assert client.get("/api/aerodromes/XXXX/status").status_code == 404


def test_meteo_and_qnh(client):
    m = client.get("/api/meteo/metar?ids=EPWA,EPKK").json()
    assert m[1]["parsed"]["station"] == "EPKK"
    q = client.get("/api/meteo/qnh-regions").json()
    assert all(r["qnh"] == 1012 for r in q["regions"])
    assert len(q["regions"]) == 17 and q["regions"][0]["geometry"]["type"] in ("Polygon", "MultiPolygon")


def test_aircraft_and_callsigns(client):
    a = client.get("/api/aircraft?q=B738").json()
    assert a and a[0]["recat"] == "D" and a[0]["wingspan"] > 30
    assert client.get("/api/callsigns?q=LOT").json()[0]["icao"] == "LOT"
    mil = client.get("/api/callsigns?category=MIL&q=PLF").json()
    assert mil and mil[0]["category"] == "MIL"


def test_route_without_navdata(client):
    r = client.get("/api/nav/route?route=EPWA DCT EPKK").json()
    assert [p["ident"] for p in r["points"]] == ["EPWA", "EPKK"] and 120 < r["distance_nm"] < 140


def test_checklists_and_emergency(client):
    ids = [c["id"] for c in client.get("/api/checklists").json()["checklists"]]
    assert ids == ["open-position", "close-position", "handover-takeover", "rwy-change"]
    procs = client.get("/api/emergency").json()["procedures"]
    assert len(procs) == 18 and procs[1]["id"] == "A06" and any(p["id"] == "RCF" for p in procs)


def test_docs_read_only(client):
    assert client.get("/api/docs").status_code == 200
    assert client.post("/api/docs").status_code == 405


def test_vatsim_endpoints(client):
    from backend.app.routers import vatsim

    async def feed():
        return {"general": {}, "controllers": [{"callsign": "EPWA_APP", "frequency": "128.805", "name": "Jan", "cid": 1}],
                "atis": [], "pilots": [{"callsign": "LOT1", "latitude": 52.1, "longitude": 20.9, "heading": 90,
                                        "flight_plan": {"departure": "EPWA", "arrival": "EPKK", "route": "DCT"}}]}
    vatsim.get_feed = feed
    on = client.get("/api/vatsim/online").json()
    assert on["positions"]["EPWA_APP"]["name"] == "Jan"
    assert client.get("/api/vatsim/pilots?bbox=50,15,55,25").json()[0]["callsign"] == "LOT1"
    r = client.get("/api/vatsim/pilots/LOT1/route").json()
    assert [p["ident"] for p in r["points"]] == ["EPWA", "EPKK"]
    assert any(f["properties"]["id"] == "EPWW" for f in client.get("/api/vatsim/firs").json()["features"])
    ad = client.get("/api/vatsim/airport/EPWA").json()
    assert [p["callsign"] for p in ad["departures"]] == ["LOT1"] and ad["arrivals"] == []


def test_vatsim_atc_badges(client):
    from backend.app.routers import vatsim

    async def feed():
        return {"general": {}, "pilots": [],
                "controllers": [{"callsign": "EPWA_APP", "frequency": "128.805", "name": "Jan", "cid": 1},
                                {"callsign": "EPWA_GND", "frequency": "121.905", "name": "Ola", "cid": 2},
                                {"callsign": "XXX_TWR", "frequency": "118.000", "name": "?", "cid": 3},
                                {"callsign": "EDWW_FLG_CTR", "frequency": "136.450", "name": "Max", "cid": 4}],
                "atis": [{"callsign": "EPWA_ATIS", "frequency": "120.455", "atis_code": "K", "text_atis": ["INFO K"]}]}
    vatsim.get_feed = feed
    r = client.get("/api/vatsim/atc").json()
    assert [a["icao"] for a in r["airports"]] == ["EPWA"]  # XXX nie ma w bazie lotnisk
    ep = r["airports"][0]
    assert sorted(ep["facilities"]) == ["APP", "ATIS", "GND"] and ep["lat"] > 52
    assert ep["facilities"]["ATIS"][0]["atis_code"] == "K"
    assert r["firs"]["EDWW-FLG"][0]["name"] == "Max"


def test_airspace_lines_and_embed_check(client):
    tma = client.get("/api/nav/airspace?kind=tma").json()
    names = {f["properties"]["name"] for f in tma["features"]}
    assert "EPWA TMA OUT" in names and all("TMA" in n for n in names)
    ctr = client.get("/api/nav/airspace?kind=ctr").json()
    assert ctr["features"] and ctr["features"][0]["geometry"]["type"] == "MultiLineString"
    assert client.get("/api/nav/airspace?kind=xyz").status_code == 422
    assert client.get("/api/embed-check/nieznany").status_code == 404


def test_viff_endpoints(client, monkeypatch):
    from backend.app.services import viff
    from backend.app.services.http_cache import UpstreamError

    flight = {"callsign": "LOT3827", "arrival": "EPGD", "eobt": "1520", "ctot": "1545", "atfcmStatus": "SAM",
              "cdmSts": "", "aobt": "", "atot": "", "atfcmData": {"mostPenalisingRegulation": "EPWWB15"},
              "cdmData": {"tobt": "152000", "tsat": "153000", "ttot": "154500", "depInfo": "29/LIMVI2G"}}

    async def fake_get(path, params=None, ttl=None):
        return {"/ifps/depAirport": [flight], "/etfms/getCadAirport": {"isCdm": True},
                "/etfms/trafficVolumes": [], "/etfms/airspaces": {}}[path]

    monkeypatch.setattr(viff, "_get", fake_get)
    d = client.get("/api/viff/departures/epwa").json()
    assert d["cdm"] is True and d["flights"][0]["state"] == "SI"
    assert (d["flights"][0]["tsat"], d["flights"][0]["regulation"]) == ("1530", "EPWWB15")
    assert client.get("/api/viff/departures/EPWA1").status_code == 400
    assert client.get("/api/viff/sectors").json()["sectors"] == []

    async def down(path, params=None, ttl=None):
        raise UpstreamError("timeout")

    monkeypatch.setattr(viff, "_get", down)
    r = client.get("/api/viff/departures/EPWA")
    assert r.status_code == 502 and "vIFF" in r.json()["detail"]
