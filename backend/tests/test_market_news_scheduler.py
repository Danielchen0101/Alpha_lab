import start_quant_backend as backend


def test_market_news_scheduler_unpacks_finnhub_config(monkeypatch):
    captured = {}
    articles = [{"headline": "Test headline"}]

    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda _uid, _mode: {"api_key": "alpaca-key"},
    )
    monkeypatch.setattr(
        backend,
        "resolve_finnhub_config_for_user",
        lambda _uid: ({"api_key": "finnhub-key"}, "user_config/supabase"),
    )

    def fake_fetch(market_cfg, finnhub_cfg, **kwargs):
        captured.update({
            "market_cfg": market_cfg,
            "finnhub_cfg": finnhub_cfg,
            "kwargs": kwargs,
        })
        return articles, ["Finnhub Market News"], []

    monkeypatch.setattr(backend, "_market_intelligence_fetch_news", fake_fetch)
    monkeypatch.setattr(
        backend,
        "_market_news_ai_enrich",
        lambda uid, payload, **kwargs: captured.update({
            "enriched_uid": uid,
            "enriched_articles": payload,
            "enrich_kwargs": kwargs,
        }),
    )

    backend._market_news_scheduler_refresh_user("user-1")

    assert captured["market_cfg"] == {"api_key": "alpaca-key"}
    assert captured["finnhub_cfg"] == {"api_key": "finnhub-key"}
    assert captured["kwargs"]["force_refresh"] is True
    assert captured["enriched_uid"] == "user-1"
    assert captured["enriched_articles"] == articles
    assert captured["enrich_kwargs"] == {"notify": True}
