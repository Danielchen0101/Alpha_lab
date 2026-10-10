"""Explicit SIP history reader and reproducible offline dataset contracts.

The caller supplies a credential-bound read-only ``fetch_page(path, params)``.
Nothing connects to an account, network, cache or filesystem on import. Cache
objects are returned to the caller; this module never writes user configuration.
"""
import hashlib
import json
import os
import tempfile
import time as runtime_time
from pathlib import Path
from datetime import datetime, timedelta, time

from equity_strategy import NEW_YORK, number, parse_time, session_date

EQUITY_DATA_VERSION = "equity_sip_v1"


def content_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def dataset_hash(dataset):
    return content_hash({key: value for key, value in dataset.items() if key != "dataHash"})


def read_sip_history(fetch_page, symbols, start, end, *, now, kind="bars", adjustment="raw", expected_sessions=None, cache=None, max_pages=10000):
    """Read all pages, rejecting recent SIP, silent truncation and bad caches.

    ``expected_sessions`` comes from the exchange calendar, not weekdays.
    Missing sessions remain explicit gaps, never forward-filled price bars.
    Quotes keep original SIP timestamps; availableAt is the *historical event*
    time, not today's retrieval time. This does not authorize live delayed fills.
    """
    start_at, end_at, clock = parse_time(start), parse_time(end), parse_time(now)
    symbols = sorted(set(str(item).strip().upper() for item in symbols or [] if str(item).strip()))
    if not symbols or kind not in ("bars", "quotes") or adjustment not in ("raw", "split", "all"):
        raise ValueError("invalid_sip_request")
    if not start_at or not end_at or not clock or start_at >= end_at or end_at > clock - timedelta(minutes=15):
        raise ValueError("sip_end_must_be_at_least_15_minutes_old")
    params = {"symbols": ",".join(symbols), "start": start_at.isoformat(), "end": end_at.isoformat(), "feed": "sip", "sort": "asc", "limit": 10000}
    if kind == "bars":
        params.update({"timeframe": "1Day", "adjustment": adjustment})
    identity = {"dataVersion": EQUITY_DATA_VERSION, "kind": kind, "params": params, "expectedSessions": expected_sessions}
    key = content_hash(identity)
    if cache is not None and cache.get("cacheKey") == key:
        payload = cache.get("payload")
        if isinstance(payload, dict) and cache.get("payloadHash") == content_hash(payload):
            return payload, cache
        raise ValueError("corrupt_sip_cache")
    rows = {symbol: [] for symbol in symbols}
    token, seen_tokens = None, set()
    pages = 0
    while True:
        query = dict(params)
        if token is not None:
            query["page_token"] = token
        payload = fetch_page("/v2/stocks/" + kind, query)
        if not isinstance(payload, dict) or not isinstance(payload.get(kind), dict):
            raise ValueError("invalid_sip_response")
        pages += 1
        for symbol, items in payload[kind].items():
            if symbol not in rows or not isinstance(items, list):
                raise ValueError("unexpected_sip_symbol_or_rows")
            rows[symbol].extend(items)
        token = payload.get("next_page_token")
        if not token:
            break
        if token in seen_tokens or pages >= max_pages:
            raise ValueError("sip_pagination_incomplete")
        seen_tokens.add(token)
    normalized, gaps = {}, {}
    for symbol, items in rows.items():
        normalized[symbol] = []
        previous = None
        for raw in items:
            stamp = parse_time(raw.get("t")) if isinstance(raw, dict) else None
            if not stamp or stamp < start_at or stamp > end_at or (previous and (stamp < previous or (kind == "bars" and stamp == previous))):
                raise ValueError("invalid_or_duplicate_sip_timestamp")
            previous = stamp
            if kind == "bars":
                # A provider daily bar may include extended-hours prints. It is
                # unambiguously complete on the following NY calendar day.
                date = stamp.astimezone(NEW_YORK).date()
                available = datetime.combine(date + timedelta(days=1), time(), NEW_YORK)
                if available > clock:
                    continue
                row = {"session": date.isoformat(), "timestamp": stamp.isoformat(), "availableAt": available.isoformat(), "complete": True, "feed": "sip"}
                row.update({key: number(raw.get(short)) for key, short in (("open", "o"), ("high", "h"), ("low", "l"), ("close", "c"), ("volume", "v"))})
            else:
                row = {"timestamp": raw["t"], "availableAt": raw["t"], "feed": "sip", "bid": number(raw.get("bp")), "ask": number(raw.get("ap")), "bidSize": number(raw.get("bs")), "askSize": number(raw.get("as"))}
            normalized[symbol].append(row)
        if kind == "bars" and expected_sessions is not None:
            found = {session_date(bar) for bar in normalized[symbol]}
            gaps[symbol] = [day for day in expected_sessions if day not in found]
        elif not normalized[symbol]:
            gaps[symbol] = ["no_rows"]
    result = {**identity, "cacheKey": key, "rows": normalized, "pageCount": pages, "coverage": {"calendarVerified": expected_sessions is not None, "missingSessions": gaps, "complete": expected_sessions is not None and not any(gaps.values()) if kind == "bars" else None}, "retrievedAt": clock.isoformat()}
    cached = {"cacheKey": key, "payload": result, "payloadHash": content_hash(result)}
    return result, cached


def validate_dataset(dataset):
    """Admission requires an explicit independently audited coverage manifest."""
    if not isinstance(dataset, dict):
        return ["dataset_missing"]
    errors = []
    if dataset.get("dataVersion") != EQUITY_DATA_VERSION:
        errors.append("data_version_mismatch")
    try:
        if dataset.get("dataHash") != dataset_hash(dataset):
            errors.append("data_hash_mismatch")
    except (TypeError, ValueError):
        errors.append("invalid_dataset_encoding")
    for field in ("bars", "quotes", "universe"):
        if not isinstance(dataset.get(field), dict) or not dataset[field]:
            errors.append(field + "_missing")
    if not isinstance(dataset.get("corporateActions"), list):
        errors.append("corporate_actions_missing")
    coverage = dataset.get("coverage") or {}
    for field in ("barsComplete", "quotesComplete", "corporateActionsComplete", "pointInTimeUniverse", "calendarVerified", "quoteSizesInShares"):
        if coverage.get(field) is not True:
            errors.append(field + "_unverified")
    sessions = dataset.get("sessions")
    if not isinstance(sessions, list) or not sessions or sessions != sorted(set(sessions)) or any(session_date({"date": item}) != item for item in sessions):
        errors.append("invalid_session_calendar")
    if dataset.get("barAdjustment") != "raw":
        errors.append("raw_bars_required_for_cash_action_accounting")
    return errors


class CollectionPending(RuntimeError):
    """A bounded collection slice ended; immutable cached pages can resume."""


class CachedReadTransport:
    """Checksum-verified per-page archive; no credentials enter keys or files."""
    def __init__(self, fetch_page, directory, max_requests=120, max_elapsed_seconds=None):
        self.fetch_page = fetch_page
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.max_requests, self.requests, self.cache_hits = max_requests, 0, 0
        self.deadline = runtime_time.monotonic() + max_elapsed_seconds if max_elapsed_seconds else None

    def __call__(self, path, params):
        identity = {"path": path, "params": params}
        key = content_hash(identity)
        file = self.directory / (key + ".json")
        if file.exists():
            envelope = json.loads(file.read_text())
            if envelope.get("identity") != identity or envelope.get("payloadHash") != content_hash(envelope.get("payload")):
                raise ValueError("cached_page_integrity_failed")
            self.cache_hits += 1
            return envelope["payload"]
        if self.requests >= self.max_requests or (self.deadline is not None and runtime_time.monotonic() >= self.deadline):
            raise CollectionPending("request_slice_complete_resume_same_protocol")
        payload = self.fetch_page(path, dict(params))
        self.requests += 1
        envelope = {"identity": identity, "payload": payload, "payloadHash": content_hash(payload),
                    "retrievedAt": datetime.now().astimezone().isoformat()}
        # Never replace an already archived response with a later revision.
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.directory, prefix=".page-", delete=False) as handle:
                temporary = handle.name
                json.dump(envelope, handle, sort_keys=True, separators=(",", ":"), allow_nan=False)
                handle.flush()
                os.fsync(handle.fileno())
            os.link(temporary, file)
        except FileExistsError:
            return self(path, params)
        finally:
            if temporary is not None:
                os.unlink(temporary)
        return payload

    def archive_reference(self, path, params):
        identity = {"path": path, "params": params}
        key = content_hash(identity)
        envelope = json.loads((self.directory / (key + ".json")).read_text())
        return {"file": key + ".json", "payloadHash": envelope["payloadHash"]}


def collect_quote_archives(transport, symbols, calendar, start, end, *, now):
    """Collect complete single-symbol sessions without materializing quote history.

    Each page is durably cached before continuing. Calling again with the same
    frozen dates resumes cached pages and spends only the next request slice.
    """
    result, row_count = {symbol: [] for symbol in symbols}, 0
    clock = parse_time(now)
    for session in calendar:
        day = session["date"]
        if not start <= day <= end:
            continue
        opened = datetime.fromisoformat(day + "T" + session["open"]).replace(tzinfo=NEW_YORK)
        closed = datetime.fromisoformat(day + "T" + session["close"]).replace(tzinfo=NEW_YORK)
        if closed > clock - timedelta(minutes=15):
            raise ValueError("sip_session_not_complete")
        for symbol in symbols:
            params = {"symbols": symbol, "start": opened.isoformat(), "end": (closed - timedelta(microseconds=1)).isoformat(), "feed": "sip", "sort": "asc", "limit": 10000}
            checkpoint = transport.directory / (content_hash({"kind": "quote_session_index", "params": params}) + ".index.json")
            if checkpoint.exists():
                index = json.loads(checkpoint.read_text())
                if index.get("params") != params or index.get("referencesHash") != content_hash(index.get("references")):
                    raise ValueError("quote_session_index_integrity_failed")
                result[symbol].extend(index["references"])
                row_count += sum(row["rows"] for row in index["references"])
                continue
            references = []
            token, tokens, pages, last_stamp = None, set(), 0, None
            while True:
                query = {**params, **({"page_token": token} if token else {})}
                payload = transport("/v2/stocks/quotes", query)
                if not isinstance(payload, dict) or not isinstance(payload.get("quotes"), dict) or set(payload["quotes"]) - {symbol}:
                    raise ValueError("invalid_sip_quote_archive_page")
                rows = payload["quotes"].get(symbol, [])
                if not isinstance(rows, list):
                    raise ValueError("invalid_sip_quote_archive_rows")
                for row in rows:
                    stamp = parse_time(row.get("t"))
                    if not stamp or not opened <= stamp < closed or (last_stamp and stamp < last_stamp):
                        raise ValueError("sip_quote_archive_timestamp_outside_interval_or_unsorted")
                    last_stamp = stamp
                reference = {**transport.archive_reference("/v2/stocks/quotes", query), "session": day, "rows": len(rows)}
                result[symbol].append(reference)
                references.append(reference)
                row_count += len(rows)
                pages += 1
                token = payload.get("next_page_token")
                if not token:
                    break
                if token in tokens or pages >= 10000:
                    raise ValueError("sip_quote_archive_pagination_incomplete")
                tokens.add(token)
            index = {"params": params, "references": references, "referencesHash": content_hash(references)}
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=transport.directory, prefix=".index-", delete=False) as handle:
                    temporary = handle.name
                    json.dump(index, handle, sort_keys=True, allow_nan=False)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.link(temporary, checkpoint)
            except FileExistsError:
                pass
            finally:
                if temporary is not None:
                    os.unlink(temporary)
    return result, {"rowCount": row_count, "pageCount": sum(len(rows) for rows in result.values()), "paginationComplete": True}


def iter_archived_quotes(dataset, symbol, archive_root):
    """Yield verified normalized quote pages with at most one page in memory."""
    root = Path(archive_root).resolve()
    last_stamp = None
    for reference in (dataset.get("quoteArchives") or {}).get(symbol, []):
        name = reference.get("file", "")
        if len(name) != 69 or not name.endswith(".json") or any(c not in "0123456789abcdef" for c in name[:-5]):
            raise ValueError("invalid_archive_page_name")
        envelope = json.loads((root / name).read_text())
        payload = envelope.get("payload")
        if envelope.get("payloadHash") != reference.get("payloadHash") or content_hash(payload) != reference["payloadHash"]:
            raise ValueError("quote_archive_integrity_failed")
        params = (envelope.get("identity") or {}).get("params") or {}
        start, end = parse_time(params.get("start")), parse_time(params.get("end"))
        if not start or not end or params.get("symbols") != symbol or params.get("feed") != "sip":
            raise ValueError("quote_archive_request_identity_invalid")
        for raw in payload.get("quotes", {}).get(symbol, []):
            stamp = parse_time(raw.get("t"))
            if not stamp or not start <= stamp <= end or (last_stamp and stamp < last_stamp):
                raise ValueError("sip_quote_archive_timestamp_outside_interval_or_unsorted")
            last_stamp = stamp
            yield {"timestamp": raw.get("t"), "availableAt": raw.get("t"), "feed": "sip", "bid": number(raw.get("bp")), "ask": number(raw.get("ap")), "bidSize": number(raw.get("bs")), "askSize": number(raw.get("as"))}


def reconcile_action_adjustments(raw_bars, split_bars, all_bars, actions):
    """Compare provider adjustment transitions with the actual cash/action ledger.

    This is a reproducible consistency check, not a claim of announcement-time
    availability. Unexplained transitions and missing pay dates block admission.
    """
    issues, checks = [], []
    for symbol, raw in raw_bars.items():
        split = {row["session"]: row for row in split_bars.get(symbol, [])}
        total = {row["session"]: row for row in all_bars.get(symbol, [])}
        relevant = [action for action in actions if action.get("symbol") == symbol]
        for index, row in enumerate(raw):
            if index == 0:
                continue
            prior = raw[index - 1]
            day = row["session"]
            if any(date not in split or date not in total for date in (day, prior["session"])):
                issues.append(symbol + ":adjustment_history_missing")
                continue
            matching = [action for action in relevant if prior["session"] < (action.get("exDate") or "") <= day]
            split_ratio, cash_amount = 1.0, 0.0
            for action in matching:
                if action.get("type") == "split" and number(action.get("ratio")):
                    split_ratio *= action["ratio"]
                elif action.get("type") == "dividend" and number(action.get("cashAmount")) is not None and action.get("payDate"):
                    cash_amount += action["cashAmount"]
                else:
                    issues.append(symbol + ":unsupported_action")
            values = [number(item.get("close")) for item in (row, prior, split[day], split[prior["session"]], total[day], total[prior["session"]])]
            if any(value is None or value <= 0 for value in values):
                issues.append(symbol + ":invalid_adjustment_price")
                continue
            current, old, split_now, split_old, all_now, all_old = values
            measured_split = (old / split_old) / (current / split_now)
            measured_total = (old / all_old) / (current / all_now)
            # A cash dividend reduces prior prices by dividend/prior raw close.
            expected_total = split_ratio * (old / (old - cash_amount * split_ratio)) if old > cash_amount * split_ratio else None
            tolerance = max(.00001, .001 / min(values))
            good = abs(measured_split - split_ratio) <= tolerance * max(1, split_ratio) and expected_total is not None and abs(measured_total - expected_total) <= tolerance * max(1, expected_total)
            if not good:
                issues.append(symbol + ":unreconciled_adjustment:" + day)
            checks.append({"symbol": symbol, "session": day, "splitFactor": measured_split, "totalFactor": measured_total,
                           "expectedSplitFactor": split_ratio, "expectedTotalFactor": expected_total, "matched": good})
    return {"complete": bool(checks) and not issues, "issues": sorted(set(issues)), "checksHash": content_hash(checks), "checkedTransitions": len(checks),
            "method": "raw_split_total_adjustment_transition_reconciliation_v1"}


def read_corporate_actions(fetch_page, symbols, start, end, *, max_pages=1000):
    """Read all action types by provider process-date; never assert ex-date coverage.

    Alpaca documents processing delays and no creation-time guarantee. A complete
    pagination chain proves the response was read, not that all ex-date actions
    were known on time. Unsupported reorganizations remain explicit blockers.
    """
    requested = sorted(set(symbols or []))
    params = {"symbols": ",".join(requested), "start": start, "end": end,
              "data_quality": "all", "limit": 1000, "sort": "asc"}
    events, tokens, identities, issues, token, pages = [], set(), set(), [], None, 0
    while True:
        payload = fetch_page("/v1/corporate-actions", {**params, **({"page_token": token} if token else {})})
        if not isinstance(payload, dict) or not isinstance(payload.get("corporate_actions"), dict):
            raise ValueError("invalid_corporate_action_response")
        pages += 1
        for kind, rows in payload["corporate_actions"].items():
            if not isinstance(rows, list):
                raise ValueError("invalid_corporate_action_rows")
            for row in rows:
                symbol = row.get("symbol", row.get("old_symbol"))
                identity = row.get("id")
                if not identity or identity in identities or symbol not in requested:
                    raise ValueError("duplicate_or_unrequested_corporate_action")
                identities.add(identity)
                event = {"id": identity, "symbol": symbol, "providerType": kind,
                         "exDate": row.get("ex_date", row.get("effective_date")), "processDate": row.get("process_date"),
                         "source": "alpaca_corporate_actions", "type": "unsupported"}
                if kind in ("forward_splits", "reverse_splits") and not row.get("new_symbol"):
                    new, old = number(row.get("new_rate")), number(row.get("old_rate"))
                    if new and old and new > 0 and old > 0:
                        event.update(type="split", ratio=new / old)
                elif kind == "cash_dividends" and not row.get("foreign") and row.get("currency", "USD") == "USD" and not row.get("due_bill_on_date"):
                    amount = number(row.get("rate"))
                    if amount is not None and amount >= 0 and row.get("payable_date"):
                        event.update(type="dividend", cashAmount=amount, payDate=row["payable_date"])
                if event["type"] == "unsupported" or not event["exDate"]:
                    issues.append("unsupported_or_incomplete_corporate_action:" + str(kind))
                events.append(event)
        token = payload.get("next_page_token")
        if not token:
            break
        if token in tokens or pages >= max_pages:
            raise ValueError("corporate_action_pagination_incomplete")
        tokens.add(token)
    events.sort(key=lambda event: (event.get("exDate") or "9999", event["symbol"], event["id"]))
    return events, {"paginationComplete": True, "complete": False, "processDateStart": start, "processDateEnd": end,
                    "pageCount": pages, "issues": sorted(set(issues + ["provider_process_date_does_not_prove_ex_date_completeness"])),
                    "source": "https://docs.alpaca.markets/us/reference/corporateactions-1"}
