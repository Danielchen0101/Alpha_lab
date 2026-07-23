import json

from kalshi_paper import KalshiPaperAccountStore, taker_fill_amounts


def test_official_general_event_taker_fee_and_account_rounding():
    one = taker_fill_amounts(0.50, 1)
    hundred = taker_fill_amounts(0.50, 100)
    assert one["tradeFee"] == 0.0175
    assert one["debit"] == 0.52
    assert one["fee"] == 0.02
    assert hundred["tradeFee"] == 1.75
    assert hundred["debit"] == 51.75


def test_fill_updates_cash_position_and_ledger(tmp_path):
    store = KalshiPaperAccountStore(str(tmp_path / "paper.json"))
    order = store.submit_taker("u", ticker="T", side="YES", price=0.50, contracts=10, available_depth=7)
    portfolio = store.portfolio("u")
    assert order["status"] == "partially_filled"
    assert order["fill_count_fp"] == 7
    assert portfolio["balance"]["balance"] == 999_637
    assert portfolio["positions"][0]["yes_count_fp"] == 7
    assert portfolio["fills"][0]["fee_cost_dollars"] == 0.13


def test_ioc_uses_book_levels_average_price_and_slippage(tmp_path):
    store = KalshiPaperAccountStore(str(tmp_path / "paper.json"))
    order = store.submit_taker(
        "u",
        ticker="T",
        side="YES",
        price=0.50,
        limit_price=0.55,
        contracts=8,
        orderbook={"no": [[0.50, 3], [0.48, 4], [0.40, 100]]},
    )
    portfolio = store.portfolio("u")

    assert order["status"] == "partially_filled"
    assert order["fill_count_fp"] == 7
    assert order["remaining_count_fp"] == 1
    assert order["average_price_dollars"] > 0.50
    assert order["slippage_dollars"] > 0
    assert len(order["matched_levels"]) == 2
    assert portfolio["positions"][0]["yes_count_fp"] == 7


def test_settlement_has_no_fee_and_credits_winning_contracts(tmp_path):
    store = KalshiPaperAccountStore(str(tmp_path / "paper.json"))
    store.submit_taker("u", ticker="T", side="NO", price=0.25, contracts=4, available_depth=10)
    cash_after_fill = store.portfolio("u")["balance"]["balance"]
    settlement = store.settle("u", "T", "NO")
    portfolio = store.portfolio("u")
    assert settlement["revenue_dollars"] == 4.0
    assert settlement["settlement_fee_dollars"] == 0.0
    assert portfolio["balance"]["balance"] == cash_after_fill + 400
    assert portfolio["positions"] == []


def test_pre_v2_account_data_is_removed_during_upgrade(tmp_path):
    path = tmp_path / "paper.json"
    path.write_text(json.dumps({"u": {
        "version": 1,
        "cashCents": 123,
        "positions": {"OLD": {"ticker": "OLD", "yesCount": 99}},
        "orders": [{"order_id": "old"}],
        "fills": [{"fill_id": "old"}],
        "settlements": [{"settlement_id": "old"}],
    }}), encoding="utf-8")

    portfolio = KalshiPaperAccountStore(str(path)).portfolio("u")

    assert portfolio["balance"]["balance"] == 1_000_000
    assert portfolio["positions"] == []
    assert portfolio["orders"] == []
    assert portfolio["fills"] == []
    assert portfolio["settlements"] == []
