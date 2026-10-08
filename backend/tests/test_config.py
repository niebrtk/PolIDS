from backend.app.config import Settings


def test_legacy_prefix_still_read(monkeypatch):
    """Zmienne sprzed zmiany nazwy (VPANDORA_*, np. ustawione przez setx) nadal działają; POLIDS_* ma pierwszeństwo."""
    monkeypatch.delenv("POLIDS_VIFF_URL", raising=False)
    monkeypatch.setenv("VPANDORA_VIFF_URL", "http://legacy.example")
    assert Settings().viff_url == "http://legacy.example"
    monkeypatch.setenv("POLIDS_VIFF_URL", "http://new.example")
    assert Settings().viff_url == "http://new.example"
