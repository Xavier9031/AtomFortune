# AtomWorth — Backend Services & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the pricing/FX fetch services, daily snapshot job, snapshots API, and dashboard aggregation API.

**Architecture:** Services are plain Python modules (no framework coupling). APScheduler is registered in FastAPI lifespan. Snapshot job deletes existing day's data then re-inserts in a single DB transaction. Dashboard reads from snapshot_items only — no live calculation.

**Tech Stack:** Python 3.12, FastAPI, APScheduler 3.x, yfinance, requests (for exchangerate-api + CoinGecko), SQLAlchemy 2.x (sync), pytest

**Prerequisite:** Plan Part 1 (Backend Foundation) must be complete before starting this plan.

---

## New Files Created in This Plan

```
api/
├── services/
│   ├── pricing.py             # fetch_market_prices(assets) → dict[asset_id, price]
│   ├── fx.py                  # fetch_fx_rates() → dict[pair, rate]; USD/JPY via exchangerate-api, USDT via CoinGecko
│   └── snapshot.py            # daily_snapshot_job(db) — full snapshot logic
├── routers/
│   ├── snapshots.py           # GET /snapshots/history, GET /snapshots/{date}, POST rebuild
│   └── dashboard.py           # GET /dashboard/summary, /allocation, /net-worth-history
├── schemas/
│   ├── snapshot.py            # SnapshotDateOut, SnapshotDetailOut, RebuildRangeIn
│   └── dashboard.py           # SummaryOut, AllocationOut, NetWorthHistoryOut
└── tests/
    ├── test_snapshot_job.py   # Unit tests for snapshot logic
    ├── test_snapshots_api.py  # Integration tests for snapshot endpoints
    └── test_dashboard.py      # Integration tests for dashboard endpoints
```

---

## Task 1: Pricing Service

**Files:**
- Create: `api/services/pricing.py`
- Test: `api/tests/test_snapshot_job.py` (pricing section)

### Overview

`fetch_market_prices(assets)` accepts a list of asset dicts (each with `id`, `symbol`, `pricing_mode`). It filters to `pricing_mode='market'` assets, calls `yfinance.download(tickers, period="1d")`, and returns `dict[str, float]` mapping `asset_id` → closing price. Assets without a valid symbol or with no data returned are silently skipped (caller handles fallback).

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_snapshot_job.py  (top section — pricing tests)
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from api.services.pricing import fetch_market_prices

ASSET_AAPL = {"id": "uuid-aapl", "symbol": "AAPL", "pricing_mode": "market"}
ASSET_MANUAL = {"id": "uuid-manual", "symbol": None, "pricing_mode": "manual"}
ASSET_FIXED = {"id": "uuid-fixed", "symbol": None, "pricing_mode": "fixed"}


def make_yfinance_df(ticker: str, close_price: float) -> pd.DataFrame:
    """Build a minimal DataFrame resembling yfinance.download output."""
    import numpy as np
    idx = pd.MultiIndex.from_tuples([("Close", ticker)], names=["Price", "Ticker"])
    return pd.DataFrame([[close_price]], columns=idx, index=pd.to_datetime(["2026-03-22"]))


class TestFetchMarketPrices:
    def test_returns_price_for_market_asset(self):
        assets = [ASSET_AAPL]
        mock_df = make_yfinance_df("AAPL", 210.50)

        with patch("api.services.pricing.yf.download", return_value=mock_df) as mock_dl:
            result = fetch_market_prices(assets)

        mock_dl.assert_called_once()
        assert result == {"uuid-aapl": pytest.approx(210.50)}

    def test_skips_non_market_assets(self):
        assets = [ASSET_MANUAL, ASSET_FIXED]
        with patch("api.services.pricing.yf.download") as mock_dl:
            result = fetch_market_prices(assets)

        mock_dl.assert_not_called()
        assert result == {}

    def test_skips_asset_with_no_symbol(self):
        asset_no_sym = {"id": "uuid-nosym", "symbol": None, "pricing_mode": "market"}
        with patch("api.services.pricing.yf.download") as mock_dl:
            result = fetch_market_prices([asset_no_sym])

        mock_dl.assert_not_called()
        assert result == {}

    def test_handles_multiple_tickers(self):
        asset_msft = {"id": "uuid-msft", "symbol": "MSFT", "pricing_mode": "market"}
        assets = [ASSET_AAPL, asset_msft]

        # yfinance returns multi-column DataFrame for multiple tickers
        idx = pd.MultiIndex.from_tuples(
            [("Close", "AAPL"), ("Close", "MSFT")], names=["Price", "Ticker"]
        )
        mock_df = pd.DataFrame(
            [[210.50, 415.00]],
            columns=idx,
            index=pd.to_datetime(["2026-03-22"]),
        )

        with patch("api.services.pricing.yf.download", return_value=mock_df):
            result = fetch_market_prices(assets)

        assert result["uuid-aapl"] == pytest.approx(210.50)
        assert result["uuid-msft"] == pytest.approx(415.00)

    def test_returns_empty_dict_on_yfinance_exception(self):
        assets = [ASSET_AAPL]
        with patch("api.services.pricing.yf.download", side_effect=Exception("network error")):
            result = fetch_market_prices(assets)

        assert result == {}

    def test_skips_ticker_with_all_nan_prices(self):
        import numpy as np
        assets = [ASSET_AAPL]
        idx = pd.MultiIndex.from_tuples([("Close", "AAPL")], names=["Price", "Ticker"])
        mock_df = pd.DataFrame([[float("nan")]], columns=idx, index=pd.to_datetime(["2026-03-22"]))

        with patch("api.services.pricing.yf.download", return_value=mock_df):
            result = fetch_market_prices(assets)

        assert result == {}
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_snapshot_job.py::TestFetchMarketPrices -v
```

Expected: FAIL (ImportError — `api/services/pricing.py` does not exist)

- [ ] **Step 3: Write minimal implementation**

```python
# api/services/pricing.py
"""
Pricing service — fetches latest market prices via yfinance.

fetch_market_prices(assets) → dict[asset_id: str, price: float]

Only processes assets with pricing_mode='market' and a non-empty symbol.
Returns an empty dict on any top-level failure; per-ticker NaN values are
skipped silently so the snapshot job can apply its own fallback logic.
"""
import logging
from typing import Any

import yfinance as yf

logger = logging.getLogger(__name__)


def fetch_market_prices(assets: list[dict[str, Any]]) -> dict[str, float]:
    """
    Fetch closing prices for all market-priced assets.

    Args:
        assets: list of dicts with keys: id, symbol, pricing_mode

    Returns:
        Mapping of asset_id -> latest closing price (float).
        Assets that cannot be priced are omitted from the result.
    """
    market_assets = [
        a for a in assets if a.get("pricing_mode") == "market" and a.get("symbol")
    ]
    if not market_assets:
        return {}

    # Build symbol → asset_id lookup (symbol may not be unique in theory,
    # but for market assets we treat symbol as the yfinance ticker key)
    symbol_to_id: dict[str, str] = {a["symbol"]: a["id"] for a in market_assets}
    tickers = list(symbol_to_id.keys())

    try:
        df = yf.download(tickers, period="1d", progress=False, auto_adjust=True)
    except Exception as exc:
        logger.warning("yfinance download failed: %s", exc)
        return {}

    if df.empty:
        logger.warning("yfinance returned empty DataFrame for tickers: %s", tickers)
        return {}

    result: dict[str, float] = {}

    # yfinance returns a MultiIndex (Price, Ticker) DataFrame for multiple tickers
    # For a single ticker it returns a flat DataFrame — normalise to MultiIndex style
    if len(tickers) == 1:
        ticker = tickers[0]
        close_series = df.get("Close")
        if close_series is None or close_series.dropna().empty:
            return {}
        last_price = float(close_series.dropna().iloc[-1])
        asset_id = symbol_to_id[ticker]
        result[asset_id] = last_price
    else:
        close_df = df.get("Close")
        if close_df is None:
            return {}
        for symbol, asset_id in symbol_to_id.items():
            if symbol not in close_df.columns:
                logger.warning("No Close data for symbol %s", symbol)
                continue
            series = close_df[symbol].dropna()
            if series.empty:
                logger.warning("All NaN Close prices for symbol %s", symbol)
                continue
            result[asset_id] = float(series.iloc[-1])

    return result
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_snapshot_job.py::TestFetchMarketPrices -v
```

Expected: PASS (all 6 tests green)

- [ ] **Step 5: Commit**

```
git add api/services/pricing.py api/tests/test_snapshot_job.py
git commit -m "feat: add pricing service (yfinance fetch_market_prices)"
```

---

## Task 2: FX Service

**Files:**
- Create: `api/services/fx.py`
- Test: `api/tests/test_snapshot_job.py` (FX section, append to existing file)

### Overview

`fetch_fx_rates()` returns `dict[tuple[str,str], float]` mapping `(from_currency, to_currency)` → rate. It calls:
- `exchangerate-api.com/v4/latest/TWD` for USD→TWD and JPY→TWD rates (response gives `rates` where key is the foreign currency and value is `1 TWD = N foreign`, so we invert: `1 USD = 1/rates["USD"] TWD`)
- CoinGecko `/simple/price?ids=tether&vs_currencies=twd` for USDT→TWD
- Always inserts `TWD→TWD = 1.0`

The function returns a flat dict; the snapshot job persists these to `fx_rates` table.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_snapshot_job.py  (append — FX tests)
import requests
from unittest.mock import patch, MagicMock
from api.services.fx import fetch_fx_rates


class TestFetchFxRates:
    def _mock_exchangerate_response(self, usd_rate_vs_twd: float, jpy_rate_vs_twd: float):
        """
        exchangerate-api /v4/latest/TWD returns rates where
        rates[currency] = how many units of `currency` equal 1 TWD.
        So USD→TWD = 1 / rates["USD"].
        """
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        # rates["USD"] = 1/usd_rate_vs_twd  (e.g. 0.0306 if 1 USD = 32.67 TWD)
        mock_resp.json.return_value = {
            "rates": {
                "USD": 1.0 / usd_rate_vs_twd,
                "JPY": 1.0 / jpy_rate_vs_twd,
            }
        }
        return mock_resp

    def _mock_coingecko_response(self, usdt_twd: float):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"tether": {"twd": usdt_twd}}
        return mock_resp

    def test_returns_all_required_pairs(self):
        ex_resp = self._mock_exchangerate_response(32.67, 0.218)
        cg_resp = self._mock_coingecko_response(32.51)

        with patch("api.services.fx.requests.get", side_effect=[ex_resp, cg_resp]):
            result = fetch_fx_rates()

        assert ("USD", "TWD") in result
        assert ("JPY", "TWD") in result
        assert ("USDT", "TWD") in result
        assert ("TWD", "TWD") in result

    def test_usd_twd_rate_is_correct(self):
        ex_resp = self._mock_exchangerate_response(32.67, 0.218)
        cg_resp = self._mock_coingecko_response(32.51)

        with patch("api.services.fx.requests.get", side_effect=[ex_resp, cg_resp]):
            result = fetch_fx_rates()

        assert result[("USD", "TWD")] == pytest.approx(32.67, rel=1e-4)

    def test_jpy_twd_rate_is_correct(self):
        ex_resp = self._mock_exchangerate_response(32.67, 0.218)
        cg_resp = self._mock_coingecko_response(32.51)

        with patch("api.services.fx.requests.get", side_effect=[ex_resp, cg_resp]):
            result = fetch_fx_rates()

        assert result[("JPY", "TWD")] == pytest.approx(0.218, rel=1e-4)

    def test_usdt_twd_rate_from_coingecko(self):
        ex_resp = self._mock_exchangerate_response(32.67, 0.218)
        cg_resp = self._mock_coingecko_response(32.51)

        with patch("api.services.fx.requests.get", side_effect=[ex_resp, cg_resp]):
            result = fetch_fx_rates()

        assert result[("USDT", "TWD")] == pytest.approx(32.51)

    def test_twd_twd_is_always_one(self):
        ex_resp = self._mock_exchangerate_response(32.67, 0.218)
        cg_resp = self._mock_coingecko_response(32.51)

        with patch("api.services.fx.requests.get", side_effect=[ex_resp, cg_resp]):
            result = fetch_fx_rates()

        assert result[("TWD", "TWD")] == 1.0

    def test_returns_partial_result_on_coingecko_failure(self):
        ex_resp = self._mock_exchangerate_response(32.67, 0.218)
        cg_resp = MagicMock()
        cg_resp.raise_for_status.side_effect = requests.HTTPError("503")

        with patch("api.services.fx.requests.get", side_effect=[ex_resp, cg_resp]):
            result = fetch_fx_rates()

        # USD and JPY still present; USDT missing but no exception raised
        assert ("USD", "TWD") in result
        assert ("JPY", "TWD") in result
        assert ("USDT", "TWD") not in result

    def test_returns_empty_on_exchangerate_failure(self):
        ex_resp = MagicMock()
        ex_resp.raise_for_status.side_effect = requests.HTTPError("429")

        with patch("api.services.fx.requests.get", side_effect=[ex_resp]):
            result = fetch_fx_rates()

        # Only TWD→TWD guaranteed; USD/JPY absent
        assert result.get(("TWD", "TWD")) == 1.0
        assert ("USD", "TWD") not in result
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_snapshot_job.py::TestFetchFxRates -v
```

Expected: FAIL (ImportError — `api/services/fx.py` does not exist)

- [ ] **Step 3: Write minimal implementation**

```python
# api/services/fx.py
"""
FX service — fetches daily exchange rates.

Sources:
  - exchangerate-api.com /v4/latest/TWD → USD→TWD, JPY→TWD
  - CoinGecko /simple/price?ids=tether  → USDT→TWD
  - TWD→TWD is always 1.0 (inserted by this function)

fetch_fx_rates() → dict[tuple[from, to], float]
  Keys are (from_currency, to_currency) string tuples.
  Returns whatever pairs it can retrieve; failures are logged,
  not raised, so the snapshot job can apply fallback logic.
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

EXCHANGERATE_API_KEY = os.getenv("EXCHANGERATE_API_KEY", "")
EXCHANGERATE_URL = "https://v6.exchangerate-api.com/v6/{key}/latest/TWD"
EXCHANGERATE_FREE_URL = "https://api.exchangerate-api.com/v4/latest/TWD"
COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"


def fetch_fx_rates() -> dict[tuple[str, str], float]:
    """
    Fetch current FX rates from external APIs.

    Returns a dict mapping (from_currency, to_currency) → rate.
    Always includes ("TWD", "TWD") = 1.0.
    Missing pairs are omitted; the snapshot job uses DB fallback.
    """
    result: dict[tuple[str, str], float] = {
        ("TWD", "TWD"): 1.0,
    }

    # --- exchangerate-api: USD and JPY → TWD ---
    try:
        if EXCHANGERATE_API_KEY:
            url = EXCHANGERATE_URL.format(key=EXCHANGERATE_API_KEY)
        else:
            url = EXCHANGERATE_FREE_URL

        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        rates = data.get("rates", {})

        # API returns "how many units of foreign currency per 1 TWD"
        # We want "how many TWD per 1 foreign currency" → invert
        for foreign_currency in ("USD", "JPY"):
            raw = rates.get(foreign_currency)
            if raw and raw > 0:
                result[(foreign_currency, "TWD")] = round(1.0 / raw, 10)
            else:
                logger.warning(
                    "exchangerate-api: missing or zero rate for %s", foreign_currency
                )
    except requests.HTTPError as exc:
        logger.warning("exchangerate-api HTTP error: %s", exc)
    except Exception as exc:
        logger.warning("exchangerate-api fetch failed: %s", exc)

    # --- CoinGecko: USDT → TWD ---
    try:
        resp = requests.get(
            COINGECKO_URL,
            params={"ids": "tether", "vs_currencies": "twd"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        usdt_twd = data.get("tether", {}).get("twd")
        if usdt_twd and usdt_twd > 0:
            result[("USDT", "TWD")] = float(usdt_twd)
        else:
            logger.warning("CoinGecko: unexpected USDT/TWD response: %s", data)
    except requests.HTTPError as exc:
        logger.warning("CoinGecko HTTP error: %s", exc)
    except Exception as exc:
        logger.warning("CoinGecko fetch failed: %s", exc)

    return result
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_snapshot_job.py::TestFetchFxRates -v
```

Expected: PASS (all 7 tests green)

- [ ] **Step 5: Commit**

```
git add api/services/fx.py api/tests/test_snapshot_job.py
git commit -m "feat: add FX service (exchangerate-api + CoinGecko)"
```

---

## Task 3: Snapshot Job Logic

**Files:**
- Create: `api/services/snapshot.py`
- Test: `api/tests/test_snapshot_job.py` (snapshot section, append)

### Overview

`daily_snapshot_job(db)` is the core orchestration function. It:
1. Loads all holdings with asset metadata from DB
2. Calls `fetch_market_prices` for market assets → upserts `prices` table
3. Calls `fetch_fx_rates` → upserts `fx_rates` table
4. In a single DB transaction: DELETE today's snapshot_items, then re-INSERT one row per (asset_id, account_id) with computed `value_in_base`
5. For each holding: looks up price (today → fallback 30 days), looks up fx_rate (today → fallback 7 days), computes value, inserts row
6. Assets with no resolvable price are skipped with a warning; their asset_id is collected and returned
7. Returns `dict` with `{"date": str, "inserted": int, "missing_assets": list[str]}`

The `db` parameter is a SQLAlchemy `Session`.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_snapshot_job.py  (append — snapshot job tests)
from datetime import date
from unittest.mock import patch, MagicMock, call
from sqlalchemy.orm import Session
from api.services.snapshot import daily_snapshot_job
from api.models import Asset, Account, Holding, Price, FxRate, SnapshotItem


def make_db_session(holdings, prices_by_asset, fx_rates_by_pair):
    """
    Build a MagicMock db session that returns appropriate data
    when the snapshot job queries it.
    """
    db = MagicMock(spec=Session)

    # Holdings query: returns list of (Holding, Asset) tuples
    holding_rows = []
    for h in holdings:
        mock_holding = MagicMock()
        mock_holding.asset_id = h["asset_id"]
        mock_holding.account_id = h["account_id"]
        mock_holding.quantity = h["quantity"]

        mock_asset = MagicMock()
        mock_asset.id = h["asset_id"]
        mock_asset.symbol = h.get("symbol")
        mock_asset.pricing_mode = h["pricing_mode"]
        mock_asset.currency_code = h["currency_code"]
        mock_asset.asset_class = h.get("asset_class", "asset")

        holding_rows.append((mock_holding, mock_asset))

    # Price lookup: db.execute returns scalar per (asset_id, date) call
    # FX rate lookup: db.execute returns scalar per (from, to, date) call
    # We'll capture via side_effect on execute
    def execute_side_effect(stmt, *args, **kwargs):
        mock_result = MagicMock()
        # We can't easily parse SQLAlchemy Core statements in a mock,
        # so we'll use a simpler approach: monkeypatch the helper functions
        return mock_result

    db.execute.side_effect = execute_side_effect
    return db, holding_rows


class TestDailySnapshotJob:
    """Integration-level unit tests using a fully mocked DB session."""

    def _build_session_mock(self):
        return MagicMock(spec=Session)

    def test_returns_summary_dict(self):
        """Smoke test: job completes and returns expected keys."""
        with (
            patch("api.services.snapshot.fetch_market_prices", return_value={}),
            patch("api.services.snapshot.fetch_fx_rates", return_value={("TWD", "TWD"): 1.0}),
            patch("api.services.snapshot._get_all_holdings_with_assets", return_value=[]),
            patch("api.services.snapshot._upsert_prices"),
            patch("api.services.snapshot._upsert_fx_rates"),
            patch("api.services.snapshot._delete_snapshot_day"),
            patch("api.services.snapshot._insert_snapshot_items"),
        ):
            db = self._build_session_mock()
            result = daily_snapshot_job(db, snapshot_date=date(2026, 3, 22))

        assert "date" in result
        assert "inserted" in result
        assert "missing_assets" in result
        assert result["date"] == "2026-03-22"

    def test_skips_zero_quantity_holdings(self):
        """Holdings with quantity=0 must not produce snapshot items."""
        holding = {
            "asset_id": "uuid-a",
            "account_id": "uuid-acc",
            "quantity": 0,
            "pricing_mode": "fixed",
            "currency_code": "TWD",
            "asset_class": "asset",
        }
        with (
            patch("api.services.snapshot.fetch_market_prices", return_value={}),
            patch("api.services.snapshot.fetch_fx_rates", return_value={("TWD", "TWD"): 1.0}),
            patch("api.services.snapshot._get_all_holdings_with_assets", return_value=[holding]),
            patch("api.services.snapshot._upsert_prices"),
            patch("api.services.snapshot._upsert_fx_rates"),
            patch("api.services.snapshot._delete_snapshot_day"),
            patch("api.services.snapshot._resolve_price", return_value=1.0),
            patch("api.services.snapshot._resolve_fx_rate", return_value=1.0),
            patch("api.services.snapshot._insert_snapshot_items") as mock_insert,
        ):
            db = self._build_session_mock()
            result = daily_snapshot_job(db, snapshot_date=date(2026, 3, 22))

        mock_insert.assert_called_once_with(db, [])
        assert result["inserted"] == 0

    def test_computes_value_in_base_for_fixed_asset(self):
        """Fixed TWD asset: price=1, fx=1, value = quantity."""
        holding = {
            "asset_id": "uuid-twd",
            "account_id": "uuid-acc",
            "quantity": 50000.0,
            "pricing_mode": "fixed",
            "currency_code": "TWD",
            "asset_class": "asset",
        }
        inserted_items = []

        def capture_insert(db, items):
            inserted_items.extend(items)

        with (
            patch("api.services.snapshot.fetch_market_prices", return_value={}),
            patch("api.services.snapshot.fetch_fx_rates", return_value={("TWD", "TWD"): 1.0}),
            patch("api.services.snapshot._get_all_holdings_with_assets", return_value=[holding]),
            patch("api.services.snapshot._upsert_prices"),
            patch("api.services.snapshot._upsert_fx_rates"),
            patch("api.services.snapshot._delete_snapshot_day"),
            patch("api.services.snapshot._resolve_price", return_value=1.0),
            patch("api.services.snapshot._resolve_fx_rate", return_value=1.0),
            patch("api.services.snapshot._insert_snapshot_items", side_effect=capture_insert),
        ):
            db = self._build_session_mock()
            daily_snapshot_job(db, snapshot_date=date(2026, 3, 22))

        assert len(inserted_items) == 1
        item = inserted_items[0]
        assert item["value_in_base"] == pytest.approx(50000.0)

    def test_records_missing_asset_when_price_unavailable(self):
        """Asset with no resolvable price → added to missing_assets, not inserted."""
        holding = {
            "asset_id": "uuid-nodata",
            "account_id": "uuid-acc",
            "quantity": 10.0,
            "pricing_mode": "market",
            "currency_code": "USD",
            "asset_class": "asset",
        }
        with (
            patch("api.services.snapshot.fetch_market_prices", return_value={}),
            patch("api.services.snapshot.fetch_fx_rates", return_value={("TWD", "TWD"): 1.0}),
            patch("api.services.snapshot._get_all_holdings_with_assets", return_value=[holding]),
            patch("api.services.snapshot._upsert_prices"),
            patch("api.services.snapshot._upsert_fx_rates"),
            patch("api.services.snapshot._delete_snapshot_day"),
            patch("api.services.snapshot._resolve_price", return_value=None),  # no price
            patch("api.services.snapshot._resolve_fx_rate", return_value=32.67),
            patch("api.services.snapshot._insert_snapshot_items"),
        ):
            db = self._build_session_mock()
            result = daily_snapshot_job(db, snapshot_date=date(2026, 3, 22))

        assert "uuid-nodata" in result["missing_assets"]
        assert result["inserted"] == 0

    def test_market_asset_uses_fetched_price(self):
        """Market asset: fetched price should be passed to upsert and used for value."""
        holding = {
            "asset_id": "uuid-aapl",
            "account_id": "uuid-acc",
            "quantity": 10.0,
            "pricing_mode": "market",
            "currency_code": "USD",
            "asset_class": "asset",
            "symbol": "AAPL",
        }
        inserted_items = []

        def capture_insert(db, items):
            inserted_items.extend(items)

        with (
            patch("api.services.snapshot.fetch_market_prices", return_value={"uuid-aapl": 210.50}),
            patch("api.services.snapshot.fetch_fx_rates", return_value={
                ("TWD", "TWD"): 1.0,
                ("USD", "TWD"): 32.67,
            }),
            patch("api.services.snapshot._get_all_holdings_with_assets", return_value=[holding]),
            patch("api.services.snapshot._upsert_prices"),
            patch("api.services.snapshot._upsert_fx_rates"),
            patch("api.services.snapshot._delete_snapshot_day"),
            patch("api.services.snapshot._resolve_price", return_value=210.50),
            patch("api.services.snapshot._resolve_fx_rate", return_value=32.67),
            patch("api.services.snapshot._insert_snapshot_items", side_effect=capture_insert),
        ):
            db = self._build_session_mock()
            daily_snapshot_job(db, snapshot_date=date(2026, 3, 22))

        assert len(inserted_items) == 1
        item = inserted_items[0]
        # value_in_base = 10 × 210.50 × 32.67 = 68,747.85
        assert item["value_in_base"] == pytest.approx(10.0 * 210.50 * 32.67, rel=1e-4)
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_snapshot_job.py::TestDailySnapshotJob -v
```

Expected: FAIL (ImportError — `api/services/snapshot.py` does not exist)

- [ ] **Step 3: Write minimal implementation**

```python
# api/services/snapshot.py
"""
Snapshot service — orchestrates the daily snapshot job.

daily_snapshot_job(db, snapshot_date=None) → dict

Flow:
  1. Fetch market prices → upsert prices table
  2. Fetch FX rates → upsert fx_rates table
  3. BEGIN TRANSACTION:
       DELETE snapshot_items WHERE snapshot_date = today
       For each holding with quantity > 0:
         Resolve price (today → 30-day fallback)
         Resolve fx_rate (today → 7-day fallback)
         Compute value_in_base = quantity × price × fx_rate
         Append to insert list
       Bulk INSERT snapshot_items
  4. COMMIT
  Returns summary: {date, inserted, missing_assets}
"""
import logging
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from api.services.pricing import fetch_market_prices
from api.services.fx import fetch_fx_rates

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB helper functions (thin wrappers — easy to mock in tests)
# ---------------------------------------------------------------------------

def _get_all_holdings_with_assets(db: Session) -> list[dict[str, Any]]:
    """Return all holdings joined with asset metadata as plain dicts."""
    sql = text("""
        SELECT
            h.asset_id,
            h.account_id,
            h.quantity,
            a.symbol,
            a.pricing_mode,
            a.currency_code,
            a.asset_class
        FROM holdings h
        JOIN assets a ON a.id = h.asset_id
        WHERE h.quantity > 0
    """)
    rows = db.execute(sql).mappings().all()
    return [dict(r) for r in rows]


def _upsert_prices(
    db: Session,
    prices: dict[str, float],
    price_date: date,
) -> None:
    """Upsert (asset_id, price_date) → price with source='yfinance'."""
    if not prices:
        return
    for asset_id, price in prices.items():
        db.execute(
            text("""
                INSERT INTO prices (asset_id, price_date, price, source, updated_at)
                VALUES (:asset_id, :price_date, :price, 'yfinance', NOW())
                ON CONFLICT (asset_id, price_date)
                DO UPDATE SET price = EXCLUDED.price,
                              source = EXCLUDED.source,
                              updated_at = NOW()
            """),
            {"asset_id": asset_id, "price_date": price_date, "price": price},
        )


def _upsert_fx_rates(
    db: Session,
    rates: dict[tuple[str, str], float],
    rate_date: date,
) -> None:
    """Upsert (from_currency, to_currency, rate_date) → rate."""
    for (from_cur, to_cur), rate in rates.items():
        source = "system" if from_cur == "TWD" else (
            "coingecko" if from_cur == "USDT" else "exchangerate-api"
        )
        db.execute(
            text("""
                INSERT INTO fx_rates
                  (from_currency, to_currency, rate_date, rate, source, updated_at)
                VALUES
                  (:from_cur, :to_cur, :rate_date, :rate, :source, NOW())
                ON CONFLICT (from_currency, to_currency, rate_date)
                DO UPDATE SET rate = EXCLUDED.rate,
                              source = EXCLUDED.source,
                              updated_at = NOW()
            """),
            {
                "from_cur": from_cur,
                "to_cur": to_cur,
                "rate_date": rate_date,
                "rate": rate,
                "source": source,
            },
        )


def _delete_snapshot_day(db: Session, snapshot_date: date) -> None:
    db.execute(
        text("DELETE FROM snapshot_items WHERE snapshot_date = :d"),
        {"d": snapshot_date},
    )


def _resolve_price(
    db: Session,
    asset_id: str,
    snapshot_date: date,
    pricing_mode: str,
    fetched_prices: dict[str, float],
    fallback_days: int = 30,
) -> float | None:
    """
    Return a price for the given asset on snapshot_date.

    Priority:
      1. fixed pricing_mode → always 1.0
      2. In-memory fetched price (for 'market' assets)
      3. Latest price from DB within fallback_days
      4. None if no price found
    """
    if pricing_mode == "fixed":
        return 1.0

    # Try in-memory fetched price first
    if asset_id in fetched_prices:
        return fetched_prices[asset_id]

    # DB fallback: look back up to fallback_days
    cutoff = snapshot_date - timedelta(days=fallback_days)
    row = db.execute(
        text("""
            SELECT price FROM prices
            WHERE asset_id = :asset_id
              AND price_date BETWEEN :cutoff AND :snap_date
            ORDER BY price_date DESC
            LIMIT 1
        """),
        {"asset_id": asset_id, "cutoff": cutoff, "snap_date": snapshot_date},
    ).fetchone()

    if row:
        return float(row[0])

    return None


def _resolve_fx_rate(
    db: Session,
    from_currency: str,
    snapshot_date: date,
    fetched_rates: dict[tuple[str, str], float],
    fallback_days: int = 7,
) -> float | None:
    """
    Return fx_rate for from_currency → TWD on snapshot_date.

    Priority:
      1. TWD → return 1.0
      2. In-memory fetched rate
      3. Latest rate from DB within fallback_days
      4. Oldest available rate (last resort)
      5. None if no rate at all
    """
    if from_currency == "TWD":
        return 1.0

    pair = (from_currency, "TWD")
    if pair in fetched_rates:
        return fetched_rates[pair]

    cutoff = snapshot_date - timedelta(days=fallback_days)
    row = db.execute(
        text("""
            SELECT rate FROM fx_rates
            WHERE from_currency = :from_cur
              AND to_currency = 'TWD'
              AND rate_date BETWEEN :cutoff AND :snap_date
            ORDER BY rate_date DESC
            LIMIT 1
        """),
        {"from_cur": from_currency, "cutoff": cutoff, "snap_date": snapshot_date},
    ).fetchone()

    if row:
        return float(row[0])

    # Last resort: any available rate
    row = db.execute(
        text("""
            SELECT rate FROM fx_rates
            WHERE from_currency = :from_cur AND to_currency = 'TWD'
            ORDER BY rate_date DESC
            LIMIT 1
        """),
        {"from_cur": from_currency},
    ).fetchone()

    if row:
        logger.warning(
            "fx_rate fallback exceeded %d days for %s→TWD; using last available",
            fallback_days,
            from_currency,
        )
        return float(row[0])

    return None


def _insert_snapshot_items(db: Session, items: list[dict[str, Any]]) -> None:
    """Bulk insert snapshot items (no conflict handling — caller deletes first)."""
    if not items:
        return
    db.execute(
        text("""
            INSERT INTO snapshot_items
              (snapshot_date, asset_id, account_id, quantity, price, fx_rate, value_in_base)
            VALUES
              (:snapshot_date, :asset_id, :account_id, :quantity, :price, :fx_rate, :value_in_base)
        """),
        items,
    )


# ---------------------------------------------------------------------------
# Main job
# ---------------------------------------------------------------------------

def daily_snapshot_job(
    db: Session,
    snapshot_date: date | None = None,
) -> dict[str, Any]:
    """
    Run the daily snapshot for all holdings.

    Args:
        db: SQLAlchemy Session (caller manages transaction scope for outer,
            but this function wraps the delete+insert in a nested savepoint)
        snapshot_date: date to snapshot (defaults to today)

    Returns:
        {"date": str, "inserted": int, "missing_assets": list[str]}
    """
    if snapshot_date is None:
        snapshot_date = date.today()

    logger.info("Starting daily_snapshot_job for %s", snapshot_date)

    # 1. Load all holdings
    holdings = _get_all_holdings_with_assets(db)
    logger.info("Found %d holdings to process", len(holdings))

    # 2. Fetch market prices
    market_assets = [
        {"id": h["asset_id"], "symbol": h.get("symbol"), "pricing_mode": h["pricing_mode"]}
        for h in holdings
        if h["pricing_mode"] == "market"
    ]
    try:
        fetched_prices = fetch_market_prices(market_assets)
        logger.info("Fetched prices for %d assets", len(fetched_prices))
    except Exception as exc:
        logger.warning("fetch_market_prices failed: %s; continuing with DB fallback", exc)
        fetched_prices = {}

    # 3. Fetch FX rates
    try:
        fetched_rates = fetch_fx_rates()
        logger.info("Fetched FX rates for %d pairs", len(fetched_rates))
    except Exception as exc:
        logger.warning("fetch_fx_rates failed: %s; continuing with DB fallback", exc)
        fetched_rates = {}

    # 4. Upsert prices and FX rates into DB
    _upsert_prices(db, fetched_prices, snapshot_date)
    _upsert_fx_rates(db, fetched_rates, snapshot_date)

    # 5. Build snapshot items in a single transaction
    _delete_snapshot_day(db, snapshot_date)

    snapshot_items: list[dict[str, Any]] = []
    missing_assets: list[str] = []

    for holding in holdings:
        asset_id = holding["asset_id"]
        account_id = holding["account_id"]
        quantity = float(holding["quantity"])

        if quantity <= 0:
            continue

        # Resolve price
        price = _resolve_price(
            db=db,
            asset_id=asset_id,
            snapshot_date=snapshot_date,
            pricing_mode=holding["pricing_mode"],
            fetched_prices=fetched_prices,
        )
        if price is None:
            logger.warning(
                "No price found for asset %s on %s — skipping", asset_id, snapshot_date
            )
            missing_assets.append(asset_id)
            continue

        # Resolve FX rate
        fx_rate = _resolve_fx_rate(
            db=db,
            from_currency=holding["currency_code"],
            snapshot_date=snapshot_date,
            fetched_rates=fetched_rates,
        )
        if fx_rate is None:
            logger.warning(
                "No fx_rate for %s→TWD on %s — skipping asset %s",
                holding["currency_code"],
                snapshot_date,
                asset_id,
            )
            missing_assets.append(asset_id)
            continue

        value_in_base = quantity * price * fx_rate

        snapshot_items.append(
            {
                "snapshot_date": snapshot_date,
                "asset_id": asset_id,
                "account_id": account_id,
                "quantity": quantity,
                "price": price,
                "fx_rate": fx_rate,
                "value_in_base": value_in_base,
            }
        )

    _insert_snapshot_items(db, snapshot_items)
    db.commit()

    logger.info(
        "Snapshot job complete: inserted=%d, missing=%d",
        len(snapshot_items),
        len(missing_assets),
    )

    return {
        "date": snapshot_date.isoformat(),
        "inserted": len(snapshot_items),
        "missing_assets": missing_assets,
    }
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_snapshot_job.py::TestDailySnapshotJob -v
```

Expected: PASS (all 5 tests green)

Run full snapshot test file:
```
pytest api/tests/test_snapshot_job.py -v
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```
git add api/services/snapshot.py api/tests/test_snapshot_job.py
git commit -m "feat: implement daily_snapshot_job with price/fx fallback logic"
```

---

## Task 4: APScheduler Integration in FastAPI Lifespan

**Files:**
- Edit: `api/main.py` (add scheduler setup in `lifespan`)
- Test: `api/tests/test_snapshot_job.py` (scheduler section, append)

### Overview

Register `daily_snapshot_job` with APScheduler's `BackgroundScheduler` inside FastAPI's `@asynccontextmanager lifespan`. The schedule cron is read from the `SNAPSHOT_SCHEDULE` environment variable (default `"0 22 * * *"`). The scheduler starts on app startup and shuts down gracefully on teardown.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_snapshot_job.py  (append — scheduler tests)
import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


class TestSchedulerRegistration:
    def test_scheduler_starts_on_app_startup(self):
        """APScheduler BackgroundScheduler must start during app lifespan."""
        with patch("api.main.BackgroundScheduler") as MockScheduler:
            mock_sched = MagicMock()
            MockScheduler.return_value = mock_sched

            from api.main import app
            with TestClient(app):
                mock_sched.start.assert_called_once()

    def test_scheduler_shuts_down_on_app_teardown(self):
        """APScheduler must shut down when app stops."""
        with patch("api.main.BackgroundScheduler") as MockScheduler:
            mock_sched = MagicMock()
            MockScheduler.return_value = mock_sched

            from api.main import app
            with TestClient(app):
                pass  # context manager exit triggers shutdown

            mock_sched.shutdown.assert_called_once()

    def test_snapshot_job_registered_with_cron(self):
        """daily_snapshot_job must be registered as a cron job."""
        with patch("api.main.BackgroundScheduler") as MockScheduler:
            mock_sched = MagicMock()
            MockScheduler.return_value = mock_sched

            from api.main import app
            with TestClient(app):
                mock_sched.add_job.assert_called_once()
                call_kwargs = mock_sched.add_job.call_args
                assert call_kwargs[1].get("trigger") == "cron" or (
                    len(call_kwargs[0]) > 1 and call_kwargs[0][1] == "cron"
                )
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_snapshot_job.py::TestSchedulerRegistration -v
```

Expected: FAIL (BackgroundScheduler not imported or not integrated in main.py lifespan)

- [ ] **Step 3: Write minimal implementation**

Edit `api/main.py` to add the scheduler. Find the existing `lifespan` function (or create it if not present) and integrate APScheduler:

```python
# api/main.py  (relevant additions — integrate into existing file)
import os
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from api.database import SessionLocal
from api.services.snapshot import daily_snapshot_job

SNAPSHOT_SCHEDULE = os.getenv("SNAPSHOT_SCHEDULE", "0 22 * * *")


def _run_snapshot_job():
    """Wrapper called by APScheduler — creates its own DB session."""
    db = SessionLocal()
    try:
        result = daily_snapshot_job(db)
        import logging
        logging.getLogger(__name__).info("Snapshot job result: %s", result)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Snapshot job failed: %s", exc)
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app):
    # Parse cron expression: "minute hour day month day_of_week"
    parts = SNAPSHOT_SCHEDULE.split()
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _run_snapshot_job,
        trigger="cron",
        minute=parts[0],
        hour=parts[1],
        day=parts[2],
        month=parts[3],
        day_of_week=parts[4],
        id="daily_snapshot",
        replace_existing=True,
    )
    scheduler.start()

    yield  # app is running

    scheduler.shutdown(wait=False)


# Pass lifespan to FastAPI app constructor:
# app = FastAPI(lifespan=lifespan, ...)
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_snapshot_job.py::TestSchedulerRegistration -v
```

Expected: PASS

Run full snapshot test file:
```
pytest api/tests/test_snapshot_job.py -v
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```
git add api/main.py api/tests/test_snapshot_job.py
git commit -m "feat: register daily_snapshot_job with APScheduler in FastAPI lifespan"
```

---

## Task 5: Snapshots API

**Files:**
- Create: `api/schemas/snapshot.py`
- Create: `api/routers/snapshots.py`
- Create: `api/tests/test_snapshots_api.py`

### Overview

Five endpoints:
- `GET /snapshots/history?range=30d|1y|all` — returns list of `{snapshot_date, net_worth}` for trend display
- `GET /snapshots/items?asset_id=&range=30d|1y|all` — returns `[{snapshot_date, value_in_base}]` summed across accounts for a single asset; used by Asset Detail trend chart
- `GET /snapshots/{date}` — returns full snapshot detail for a specific date
- `POST /snapshots/rebuild/{date}` — synchronously rebuilds snapshot for one date
- `POST /snapshots/rebuild-range` — synchronously rebuilds snapshots for a date range

All endpoints return 404 if no snapshot data exists for the requested date.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_snapshots_api.py
import pytest
from datetime import date
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SNAPSHOT_DATE = "2026-03-22"

HISTORY_ROWS = [
    {"snapshot_date": date(2026, 3, 21), "net_worth": 12558320.00},
    {"snapshot_date": date(2026, 3, 22), "net_worth": 12847320.00},
]

DETAIL_ROWS = [
    {
        "asset_id": "uuid-aapl",
        "account_id": "uuid-acc",
        "asset_name": "AAPL",
        "account_name": "富途證券",
        "asset_class": "asset",
        "quantity": 12.5,
        "price": 210.50,
        "currency_code": "USD",
        "fx_rate": 32.67,
        "value_in_base": 85994.63,
    }
]


# ---------------------------------------------------------------------------
# GET /snapshots/history
# ---------------------------------------------------------------------------

class TestSnapshotsHistory:
    def test_returns_200_with_data(self):
        with patch("api.routers.snapshots.get_snapshot_history", return_value=HISTORY_ROWS):
            resp = client.get("/api/v1/snapshots/history?range=30d")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["net_worth"] == pytest.approx(12558320.00)

    def test_accepts_range_1y(self):
        with patch("api.routers.snapshots.get_snapshot_history", return_value=HISTORY_ROWS):
            resp = client.get("/api/v1/snapshots/history?range=1y")
        assert resp.status_code == 200

    def test_accepts_range_all(self):
        with patch("api.routers.snapshots.get_snapshot_history", return_value=HISTORY_ROWS):
            resp = client.get("/api/v1/snapshots/history?range=all")
        assert resp.status_code == 200

    def test_returns_empty_list_when_no_data(self):
        with patch("api.routers.snapshots.get_snapshot_history", return_value=[]):
            resp = client.get("/api/v1/snapshots/history?range=30d")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_rejects_invalid_range(self):
        resp = client.get("/api/v1/snapshots/history?range=invalid")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /snapshots/{date}
# ---------------------------------------------------------------------------

class TestSnapshotDetail:
    def test_returns_full_detail(self):
        with patch("api.routers.snapshots.get_snapshot_detail", return_value=DETAIL_ROWS):
            resp = client.get(f"/api/v1/snapshots/{SNAPSHOT_DATE}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["snapshot_date"] == SNAPSHOT_DATE
        assert "net_worth" in body
        assert "items" in body
        assert len(body["items"]) == 1
        assert body["items"][0]["asset_name"] == "AAPL"

    def test_returns_404_when_no_data(self):
        with patch("api.routers.snapshots.get_snapshot_detail", return_value=[]):
            resp = client.get(f"/api/v1/snapshots/{SNAPSHOT_DATE}")
        assert resp.status_code == 404

    def test_net_worth_sums_assets_minus_liabilities(self):
        rows = [
            {**DETAIL_ROWS[0], "asset_class": "asset", "value_in_base": 100000.00},
            {
                "asset_id": "uuid-loan",
                "account_id": "uuid-acc",
                "asset_name": "房貸",
                "account_name": "郵局",
                "asset_class": "liability",
                "quantity": 1.0,
                "price": 1.0,
                "currency_code": "TWD",
                "fx_rate": 1.0,
                "value_in_base": 30000.00,
            },
        ]
        with patch("api.routers.snapshots.get_snapshot_detail", return_value=rows):
            resp = client.get(f"/api/v1/snapshots/{SNAPSHOT_DATE}")
        body = resp.json()
        # net_worth = 100000 - 30000 = 70000
        assert body["net_worth"] == pytest.approx(70000.00)

    def test_invalid_date_format_returns_422(self):
        resp = client.get("/api/v1/snapshots/not-a-date")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /snapshots/rebuild/{date}
# ---------------------------------------------------------------------------

class TestSnapshotRebuildSingle:
    def test_rebuild_returns_200_with_summary(self):
        mock_result = {"date": SNAPSHOT_DATE, "inserted": 5, "missing_assets": []}
        with patch("api.routers.snapshots.daily_snapshot_job", return_value=mock_result):
            resp = client.post(f"/api/v1/snapshots/rebuild/{SNAPSHOT_DATE}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["date"] == SNAPSHOT_DATE
        assert body["inserted"] == 5
        assert body["missing_assets"] == []

    def test_rebuild_with_missing_assets_in_response(self):
        mock_result = {
            "date": SNAPSHOT_DATE,
            "inserted": 3,
            "missing_assets": ["uuid-nodata"],
        }
        with patch("api.routers.snapshots.daily_snapshot_job", return_value=mock_result):
            resp = client.post(f"/api/v1/snapshots/rebuild/{SNAPSHOT_DATE}")
        assert resp.status_code == 200
        body = resp.json()
        assert "uuid-nodata" in body["missing_assets"]


# ---------------------------------------------------------------------------
# POST /snapshots/rebuild-range
# ---------------------------------------------------------------------------

class TestSnapshotRebuildRange:
    def test_rebuild_range_returns_200(self):
        results = [
            {"date": "2026-03-21", "inserted": 4, "missing_assets": []},
            {"date": "2026-03-22", "inserted": 5, "missing_assets": []},
        ]
        with patch("api.routers.snapshots.daily_snapshot_job", side_effect=results):
            resp = client.post(
                "/api/v1/snapshots/rebuild-range",
                json={"from": "2026-03-21", "to": "2026-03-22"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["rebuilt_dates"] == 2
        assert body["missing_assets"] == []

    def test_rebuild_range_aggregates_missing_assets(self):
        results = [
            {"date": "2026-03-21", "inserted": 3, "missing_assets": ["uuid-x"]},
            {"date": "2026-03-22", "inserted": 4, "missing_assets": ["uuid-y"]},
        ]
        with patch("api.routers.snapshots.daily_snapshot_job", side_effect=results):
            resp = client.post(
                "/api/v1/snapshots/rebuild-range",
                json={"from": "2026-03-21", "to": "2026-03-22"},
            )
        body = resp.json()
        assert set(body["missing_assets"]) == {"uuid-x", "uuid-y"}

    def test_rebuild_range_rejects_inverted_dates(self):
        resp = client.post(
            "/api/v1/snapshots/rebuild-range",
            json={"from": "2026-03-22", "to": "2026-03-21"},
        )
        assert resp.status_code == 422
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_snapshots_api.py -v
```

Expected: FAIL (ImportError — routers/snapshots.py and schemas/snapshot.py do not exist)

- [ ] **Step 3: Write minimal implementation**

**Schemas:**

```python
# api/schemas/snapshot.py
from datetime import date
from pydantic import BaseModel, field_validator, model_validator
from typing import Any


class SnapshotDateOut(BaseModel):
    snapshot_date: date
    net_worth: float


class SnapshotItemOut(BaseModel):
    asset_id: str
    account_id: str
    asset_name: str
    account_name: str
    asset_class: str    # 'asset' | 'liability' — needed for sign in net_worth and UI grouping
    category: str       # 'liquid' | 'investment' | 'fixed' | 'receivable' | 'debt' — needed for SnapshotsList grouping
    quantity: float
    price: float
    currency_code: str
    fx_rate: float
    value_in_base: float


class SnapshotDetailOut(BaseModel):
    snapshot_date: date
    net_worth: float
    items: list[SnapshotItemOut]


class RebuildResultOut(BaseModel):
    date: str
    inserted: int
    missing_assets: list[str]


class RebuildRangeIn(BaseModel):
    from_date: date  # field named 'from' in JSON — use alias
    to_date: date

    model_config = {"populate_by_name": True}

    @classmethod
    def model_validate_json_aliases(cls):
        pass

    @field_validator("to_date")
    @classmethod
    def to_must_be_gte_from(cls, v, info):
        if "from_date" in info.data and v < info.data["from_date"]:
            raise ValueError("'to' must be >= 'from'")
        return v

    # Accept JSON keys "from" and "to" via alias
    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "RebuildRangeIn":
        return cls(from_date=data["from"], to_date=data["to"])


class RebuildRangeOut(BaseModel):
    rebuilt_dates: int
    missing_assets: list[str]
```

**Router:**

```python
# api/routers/snapshots.py
"""
Snapshot API endpoints.

GET  /snapshots/history?range=30d|1y|all
GET  /snapshots/{date}
POST /snapshots/rebuild/{date}
POST /snapshots/rebuild-range
"""
import logging
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.database import get_db
from api.schemas.snapshot import (
    RebuildRangeOut,
    RebuildResultOut,
    SnapshotDateOut,
    SnapshotDetailOut,
    SnapshotItemOut,
)
from api.services.snapshot import daily_snapshot_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/snapshots", tags=["snapshots"])

RangeParam = Literal["30d", "1y", "all"]


# ---------------------------------------------------------------------------
# DB query helpers (thin wrappers for easy mocking in tests)
# ---------------------------------------------------------------------------

def get_snapshot_history(db: Session, range_param: str) -> list[dict]:
    if range_param == "30d":
        cutoff = date.today() - timedelta(days=30)
    elif range_param == "1y":
        cutoff = date.today() - timedelta(days=365)
    else:
        cutoff = date(2000, 1, 1)

    rows = db.execute(
        text("""
            SELECT
                si.snapshot_date,
                SUM(
                    CASE WHEN a.asset_class = 'liability'
                         THEN -si.value_in_base
                         ELSE si.value_in_base
                    END
                ) AS net_worth
            FROM snapshot_items si
            JOIN assets a ON a.id = si.asset_id
            WHERE si.snapshot_date >= :cutoff
            GROUP BY si.snapshot_date
            ORDER BY si.snapshot_date ASC
        """),
        {"cutoff": cutoff},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_snapshot_detail(db: Session, snapshot_date: date) -> list[dict]:
    rows = db.execute(
        text("""
            SELECT
                si.asset_id,
                si.account_id,
                a.name        AS asset_name,
                a.asset_class,
                a.currency_code,
                acc.name      AS account_name,
                si.quantity,
                si.price,
                si.fx_rate,
                si.value_in_base
            FROM snapshot_items si
            JOIN assets   a   ON a.id   = si.asset_id
            JOIN accounts acc ON acc.id = si.account_id
            WHERE si.snapshot_date = :snap_date
            ORDER BY a.asset_class, a.category, a.name
        """),
        {"snap_date": snapshot_date},
    ).mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/history", response_model=list[SnapshotDateOut])
def list_snapshot_history(
    range: Annotated[RangeParam, Query()] = "30d",
    db: Session = Depends(get_db),
):
    rows = get_snapshot_history(db, range)
    return [SnapshotDateOut(snapshot_date=r["snapshot_date"], net_worth=r["net_worth"]) for r in rows]


@router.get("/{snapshot_date}", response_model=SnapshotDetailOut)
def get_snapshot(
    snapshot_date: date,
    db: Session = Depends(get_db),
):
    rows = get_snapshot_detail(db, snapshot_date)
    if not rows:
        raise HTTPException(status_code=404, detail="No snapshot found for this date")

    net_worth = sum(
        -r["value_in_base"] if r["asset_class"] == "liability" else r["value_in_base"]
        for r in rows
    )
    items = [
        SnapshotItemOut(
            asset_id=r["asset_id"],
            account_id=r["account_id"],
            asset_name=r["asset_name"],
            account_name=r["account_name"],
            quantity=r["quantity"],
            price=r["price"],
            currency_code=r["currency_code"],
            fx_rate=r["fx_rate"],
            value_in_base=r["value_in_base"],
        )
        for r in rows
    ]
    return SnapshotDetailOut(
        snapshot_date=snapshot_date,
        net_worth=round(net_worth, 2),
        items=items,
    )


@router.post("/rebuild/{snapshot_date}", response_model=RebuildResultOut)
def rebuild_snapshot(
    snapshot_date: date,
    db: Session = Depends(get_db),
):
    try:
        result = daily_snapshot_job(db, snapshot_date=snapshot_date)
    except Exception as exc:
        logger.error("Snapshot rebuild failed for %s: %s", snapshot_date, exc)
        raise HTTPException(status_code=500, detail=str(exc))
    return RebuildResultOut(**result)


@router.post("/rebuild-range", response_model=RebuildRangeOut)
def rebuild_snapshot_range(
    body: RebuildRangeIn,   # Pydantic validates dates and from_date <= to_date
    db: Session = Depends(get_db),
):
    from_date = body.from_date
    to_date = body.to_date

    all_missing: list[str] = []
    rebuilt = 0
    current = from_date
    while current <= to_date:
        try:
            result = daily_snapshot_job(db, snapshot_date=current)
            all_missing.extend(result.get("missing_assets", []))
            rebuilt += 1
        except Exception as exc:
            logger.error("Rebuild failed for %s: %s", current, exc)
        current += timedelta(days=1)

    return RebuildRangeOut(
        rebuilt_dates=rebuilt,
        missing_assets=list(set(all_missing)),
    )
```

Register the router in `api/main.py`:

```python
# In api/main.py, add:
from api.routers.snapshots import router as snapshots_router
app.include_router(snapshots_router, prefix="/api/v1")
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_snapshots_api.py -v
```

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```
git add api/schemas/snapshot.py api/routers/snapshots.py api/tests/test_snapshots_api.py api/main.py
git commit -m "feat: add snapshots API (history, detail, rebuild, rebuild-range)"
```

---

## Task 6: Dashboard API — Summary Endpoint

**Files:**
- Create: `api/schemas/dashboard.py` (partial — SummaryOut)
- Create: `api/routers/dashboard.py` (partial — summary endpoint)
- Create: `api/tests/test_dashboard.py`

### Overview

`GET /dashboard/summary?display_currency=TWD` returns a single summary object from the latest snapshot. It computes:
- `snapshot_date` — most recent snapshot date
- `net_worth` — total assets minus liabilities
- `total_assets` — sum of asset-class items
- `total_liabilities` — sum of liability-class items (positive)
- `change_amount` / `change_pct` — delta vs. previous snapshot
- `missing_assets` — list of asset_ids not present in latest snapshot despite having active holdings

Display currency conversion: divide all TWD values by `fx_rate(display_currency→TWD)` from the latest available rate date.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_dashboard.py
import pytest
from datetime import date
from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helper data
# ---------------------------------------------------------------------------

LATEST_SNAPSHOT = {
    "snapshot_date": date(2026, 3, 22),
    "total_assets_twd": 13199320.00,
    "total_liabilities_twd": 352000.00,
    "net_worth_twd": 12847320.00,
}

PREV_SNAPSHOT = {
    "snapshot_date": date(2026, 3, 21),
    "net_worth_twd": 12558320.00,
}


# ---------------------------------------------------------------------------
# GET /dashboard/summary
# ---------------------------------------------------------------------------

class TestDashboardSummary:
    def test_returns_200_with_required_fields(self):
        with (
            patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=LATEST_SNAPSHOT),
            patch("api.routers.dashboard.get_previous_snapshot_summary", return_value=PREV_SNAPSHOT),
            patch("api.routers.dashboard.get_missing_assets", return_value=[]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/summary?display_currency=TWD")

        assert resp.status_code == 200
        body = resp.json()
        for field in ["snapshot_date", "display_currency", "net_worth",
                      "total_assets", "total_liabilities", "change_amount",
                      "change_pct", "missing_assets"]:
            assert field in body, f"Missing field: {field}"

    def test_net_worth_equals_assets_minus_liabilities(self):
        with (
            patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=LATEST_SNAPSHOT),
            patch("api.routers.dashboard.get_previous_snapshot_summary", return_value=PREV_SNAPSHOT),
            patch("api.routers.dashboard.get_missing_assets", return_value=[]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/summary?display_currency=TWD")

        body = resp.json()
        assert body["net_worth"] == pytest.approx(12847320.00)
        assert body["total_assets"] == pytest.approx(13199320.00)
        assert body["total_liabilities"] == pytest.approx(352000.00)

    def test_change_amount_and_pct_computed_correctly(self):
        with (
            patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=LATEST_SNAPSHOT),
            patch("api.routers.dashboard.get_previous_snapshot_summary", return_value=PREV_SNAPSHOT),
            patch("api.routers.dashboard.get_missing_assets", return_value=[]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/summary?display_currency=TWD")

        body = resp.json()
        expected_change = 12847320.00 - 12558320.00  # 289000.00
        expected_pct = (expected_change / 12558320.00) * 100
        assert body["change_amount"] == pytest.approx(expected_change, rel=1e-4)
        assert body["change_pct"] == pytest.approx(expected_pct, rel=1e-4)

    def test_display_currency_usd_divides_by_fx_rate(self):
        with (
            patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=LATEST_SNAPSHOT),
            patch("api.routers.dashboard.get_previous_snapshot_summary", return_value=PREV_SNAPSHOT),
            patch("api.routers.dashboard.get_missing_assets", return_value=[]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=32.67),
        ):
            resp = client.get("/api/v1/dashboard/summary?display_currency=USD")

        body = resp.json()
        assert body["display_currency"] == "USD"
        assert body["net_worth"] == pytest.approx(12847320.00 / 32.67, rel=1e-3)

    def test_missing_assets_included_in_response(self):
        with (
            patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=LATEST_SNAPSHOT),
            patch("api.routers.dashboard.get_previous_snapshot_summary", return_value=PREV_SNAPSHOT),
            patch("api.routers.dashboard.get_missing_assets", return_value=["uuid-missing"]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/summary?display_currency=TWD")

        body = resp.json()
        assert "uuid-missing" in body["missing_assets"]

    def test_no_previous_snapshot_returns_null_change(self):
        with (
            patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=LATEST_SNAPSHOT),
            patch("api.routers.dashboard.get_previous_snapshot_summary", return_value=None),
            patch("api.routers.dashboard.get_missing_assets", return_value=[]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/summary?display_currency=TWD")

        body = resp.json()
        assert body["change_amount"] is None
        assert body["change_pct"] is None

    def test_returns_404_when_no_snapshot_exists(self):
        with patch("api.routers.dashboard.get_latest_snapshot_summary", return_value=None):
            resp = client.get("/api/v1/dashboard/summary?display_currency=TWD")
        assert resp.status_code == 404
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_dashboard.py::TestDashboardSummary -v
```

Expected: FAIL (ImportError — routers/dashboard.py does not exist)

- [ ] **Step 3: Write minimal implementation**

**Schemas (partial):**

```python
# api/schemas/dashboard.py
from datetime import date
from typing import Optional
from pydantic import BaseModel


class SummaryOut(BaseModel):
    snapshot_date: date
    display_currency: str
    net_worth: float
    total_assets: float
    total_liabilities: float
    change_amount: Optional[float]
    change_pct: Optional[float]
    missing_assets: list[str]
```

**Router (summary endpoint):**

```python
# api/routers/dashboard.py
"""
Dashboard API endpoints.

GET /dashboard/summary?display_currency=TWD
GET /dashboard/allocation?date=&display_currency=TWD
GET /dashboard/net-worth-history?range=30d|1y|all&display_currency=TWD
"""
import logging
from datetime import date
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.database import get_db
from api.schemas.dashboard import SummaryOut, AllocationOut, NetWorthHistoryOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DisplayCurrency = Literal["TWD", "USD", "JPY"]


# ---------------------------------------------------------------------------
# DB query helpers (thin wrappers — easy to mock in tests)
# ---------------------------------------------------------------------------

def get_latest_snapshot_summary(db: Session) -> Optional[dict]:
    """Return aggregated totals for the most recent snapshot date."""
    row = db.execute(text("""
        SELECT
            si.snapshot_date,
            SUM(CASE WHEN a.asset_class = 'asset' THEN si.value_in_base ELSE 0 END) AS total_assets_twd,
            SUM(CASE WHEN a.asset_class = 'liability' THEN si.value_in_base ELSE 0 END) AS total_liabilities_twd,
            SUM(CASE WHEN a.asset_class = 'liability'
                     THEN -si.value_in_base ELSE si.value_in_base END) AS net_worth_twd
        FROM snapshot_items si
        JOIN assets a ON a.id = si.asset_id
        WHERE si.snapshot_date = (SELECT MAX(snapshot_date) FROM snapshot_items)
        GROUP BY si.snapshot_date
    """)).mappings().fetchone()
    return dict(row) if row else None


def get_previous_snapshot_summary(db: Session, before_date: date) -> Optional[dict]:
    """Return net_worth_twd for the snapshot immediately before before_date."""
    row = db.execute(text("""
        SELECT
            si.snapshot_date,
            SUM(CASE WHEN a.asset_class = 'liability'
                     THEN -si.value_in_base ELSE si.value_in_base END) AS net_worth_twd
        FROM snapshot_items si
        JOIN assets a ON a.id = si.asset_id
        WHERE si.snapshot_date = (
            SELECT MAX(snapshot_date) FROM snapshot_items
            WHERE snapshot_date < :before_date
        )
        GROUP BY si.snapshot_date
    """), {"before_date": before_date}).mappings().fetchone()
    return dict(row) if row else None


def get_missing_assets(db: Session, snapshot_date: date) -> list[str]:
    """
    Return asset_ids that have active holdings but no snapshot_item for snapshot_date.
    These are assets that were skipped during the snapshot job (price unavailable, etc.)
    """
    rows = db.execute(text("""
        SELECT DISTINCT h.asset_id
        FROM holdings h
        WHERE h.quantity > 0
          AND h.asset_id NOT IN (
            SELECT asset_id FROM snapshot_items
            WHERE snapshot_date = :snap_date
          )
    """), {"snap_date": snapshot_date}).fetchall()
    return [str(r[0]) for r in rows]


def get_display_fx_rate(db: Session, display_currency: str) -> float:
    """
    Return the latest fx_rate for display_currency → TWD.
    Returns 1.0 for TWD (no conversion needed).
    """
    if display_currency == "TWD":
        return 1.0
    row = db.execute(text("""
        SELECT rate FROM fx_rates
        WHERE from_currency = :currency AND to_currency = 'TWD'
        ORDER BY rate_date DESC
        LIMIT 1
    """), {"currency": display_currency}).fetchone()
    if row:
        return float(row[0])
    logger.warning("No fx_rate found for %s→TWD; defaulting to 1.0", display_currency)
    return 1.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=SummaryOut)
def get_summary(
    display_currency: Annotated[DisplayCurrency, Query()] = "TWD",
    db: Session = Depends(get_db),
):
    latest = get_latest_snapshot_summary(db)
    if latest is None:
        raise HTTPException(status_code=404, detail="No snapshot data available")

    prev = get_previous_snapshot_summary(db, before_date=latest["snapshot_date"])
    missing = get_missing_assets(db, snapshot_date=latest["snapshot_date"])
    fx_rate = get_display_fx_rate(db, display_currency)

    net_worth_twd = latest["net_worth_twd"]
    total_assets_twd = latest["total_assets_twd"]
    total_liabilities_twd = latest["total_liabilities_twd"]

    change_amount = None
    change_pct = None
    if prev is not None:
        prev_nw = prev["net_worth_twd"]
        change_amount = (net_worth_twd - prev_nw) / fx_rate
        if prev_nw != 0:
            change_pct = round(((net_worth_twd - prev_nw) / abs(prev_nw)) * 100, 4)

    return SummaryOut(
        snapshot_date=latest["snapshot_date"],
        display_currency=display_currency,
        net_worth=round(net_worth_twd / fx_rate, 2),
        total_assets=round(total_assets_twd / fx_rate, 2),
        total_liabilities=round(total_liabilities_twd / fx_rate, 2),
        change_amount=round(change_amount, 2) if change_amount is not None else None,
        change_pct=change_pct,
        missing_assets=missing,
    )
```

Register the router in `api/main.py`:

```python
from api.routers.dashboard import router as dashboard_router
app.include_router(dashboard_router, prefix="/api/v1")
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_dashboard.py::TestDashboardSummary -v
```

Expected: PASS (all 7 tests green)

- [ ] **Step 5: Commit**

```
git add api/schemas/dashboard.py api/routers/dashboard.py api/tests/test_dashboard.py api/main.py
git commit -m "feat: add dashboard summary endpoint"
```

---

## Task 7: Dashboard API — Allocation Endpoint

**Files:**
- Edit: `api/schemas/dashboard.py` (add AllocationOut)
- Edit: `api/routers/dashboard.py` (add allocation endpoint)
- Edit: `api/tests/test_dashboard.py` (append allocation tests)

### Overview

`GET /dashboard/allocation?date=&display_currency=TWD` returns treemap data grouped by `category`. If `date` is not provided, uses the latest snapshot date. Each category has a list of individual asset items. Percentages are computed relative to `total_assets + total_liabilities` (total absolute value — helps display liability share in the treemap).

Category color mapping (from spec):
```
liquid      → #078080
investment  → #7c3aed
fixed       → #1d4ed8
receivable  → #f59e0b
debt        → #f45d48
```

Category label mapping:
```
liquid      → 流動資金
investment  → 投資
fixed       → 固定資產
receivable  → 應收款
debt        → 負債
```

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_dashboard.py  (append — allocation tests)

ALLOCATION_ROWS = [
    {
        "asset_id": "uuid-aapl",
        "asset_name": "AAPL",
        "category": "investment",
        "value_in_base": 85994.63,
    },
    {
        "asset_id": "uuid-twd",
        "asset_name": "郵局存款",
        "category": "liquid",
        "value_in_base": 500000.00,
    },
    {
        "asset_id": "uuid-loan",
        "asset_name": "房貸",
        "category": "debt",
        "value_in_base": 352000.00,
    },
]


class TestDashboardAllocation:
    def test_returns_200_with_categories_list(self):
        with (
            patch("api.routers.dashboard.get_allocation_rows", return_value=ALLOCATION_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
            patch("api.routers.dashboard.get_latest_snapshot_date", return_value=date(2026, 3, 22)),
        ):
            resp = client.get("/api/v1/dashboard/allocation?display_currency=TWD")

        assert resp.status_code == 200
        body = resp.json()
        assert "snapshot_date" in body
        assert "categories" in body
        assert isinstance(body["categories"], list)

    def test_categories_have_required_fields(self):
        with (
            patch("api.routers.dashboard.get_allocation_rows", return_value=ALLOCATION_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
            patch("api.routers.dashboard.get_latest_snapshot_date", return_value=date(2026, 3, 22)),
        ):
            resp = client.get("/api/v1/dashboard/allocation?display_currency=TWD")

        body = resp.json()
        for cat in body["categories"]:
            for field in ["category", "label", "value", "pct", "color", "items"]:
                assert field in cat, f"Category missing field: {field}"

    def test_items_within_category_have_correct_fields(self):
        with (
            patch("api.routers.dashboard.get_allocation_rows", return_value=ALLOCATION_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
            patch("api.routers.dashboard.get_latest_snapshot_date", return_value=date(2026, 3, 22)),
        ):
            resp = client.get("/api/v1/dashboard/allocation?display_currency=TWD")

        body = resp.json()
        for cat in body["categories"]:
            for item in cat["items"]:
                for field in ["asset_id", "name", "value", "pct"]:
                    assert field in item, f"Item missing field: {field}"

    def test_investment_category_color_is_correct(self):
        with (
            patch("api.routers.dashboard.get_allocation_rows", return_value=ALLOCATION_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
            patch("api.routers.dashboard.get_latest_snapshot_date", return_value=date(2026, 3, 22)),
        ):
            resp = client.get("/api/v1/dashboard/allocation?display_currency=TWD")

        body = resp.json()
        inv_cats = [c for c in body["categories"] if c["category"] == "investment"]
        assert len(inv_cats) == 1
        assert inv_cats[0]["color"] == "#7c3aed"

    def test_pct_sums_to_100(self):
        with (
            patch("api.routers.dashboard.get_allocation_rows", return_value=ALLOCATION_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
            patch("api.routers.dashboard.get_latest_snapshot_date", return_value=date(2026, 3, 22)),
        ):
            resp = client.get("/api/v1/dashboard/allocation?display_currency=TWD")

        body = resp.json()
        total_pct = sum(c["pct"] for c in body["categories"])
        assert total_pct == pytest.approx(100.0, abs=0.1)

    def test_returns_404_when_no_snapshot(self):
        with patch("api.routers.dashboard.get_latest_snapshot_date", return_value=None):
            resp = client.get("/api/v1/dashboard/allocation?display_currency=TWD")
        assert resp.status_code == 404

    def test_specific_date_parameter_used(self):
        with (
            patch("api.routers.dashboard.get_allocation_rows", return_value=ALLOCATION_ROWS) as mock_rows,
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
            patch("api.routers.dashboard.get_latest_snapshot_date", return_value=date(2026, 3, 22)),
        ):
            resp = client.get("/api/v1/dashboard/allocation?date=2026-03-21&display_currency=TWD")

        # The function should have been called with 2026-03-21
        call_args = mock_rows.call_args
        assert call_args[0][1] == date(2026, 3, 21) or call_args[1].get("snapshot_date") == date(2026, 3, 21)
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_dashboard.py::TestDashboardAllocation -v
```

Expected: FAIL (missing `get_allocation_rows` and allocation endpoint)

- [ ] **Step 3: Write minimal implementation**

**Add to `api/schemas/dashboard.py`:**

```python
# Additional schemas for dashboard.py

class AllocationItemOut(BaseModel):
    asset_id: str
    name: str
    value: float
    pct: float


class AllocationCategoryOut(BaseModel):
    category: str
    label: str
    value: float
    pct: float
    color: str
    items: list[AllocationItemOut]


class AllocationOut(BaseModel):
    snapshot_date: date
    display_currency: str
    categories: list[AllocationCategoryOut]
```

**Add to `api/routers/dashboard.py`:**

```python
CATEGORY_META = {
    "liquid":      {"label": "流動資金", "color": "#078080"},
    "investment":  {"label": "投資",     "color": "#7c3aed"},
    "fixed":       {"label": "固定資產", "color": "#1d4ed8"},
    "receivable":  {"label": "應收款",   "color": "#f59e0b"},
    "debt":        {"label": "負債",     "color": "#f45d48"},
}


def get_latest_snapshot_date(db: Session) -> Optional[date]:
    row = db.execute(
        text("SELECT MAX(snapshot_date) FROM snapshot_items")
    ).scalar()
    return row


def get_allocation_rows(db: Session, snapshot_date: date) -> list[dict]:
    """Return per-asset aggregated values for allocation treemap."""
    rows = db.execute(text("""
        SELECT
            a.id          AS asset_id,
            a.name        AS asset_name,
            a.category,
            SUM(si.value_in_base) AS value_in_base
        FROM snapshot_items si
        JOIN assets a ON a.id = si.asset_id
        WHERE si.snapshot_date = :snap_date
        GROUP BY a.id, a.name, a.category
        ORDER BY a.category, SUM(si.value_in_base) DESC
    """), {"snap_date": snapshot_date}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/allocation", response_model=AllocationOut)
def get_allocation(
    display_currency: Annotated[DisplayCurrency, Query()] = "TWD",
    snapshot_date_param: Annotated[Optional[date], Query(alias="date")] = None,
    db: Session = Depends(get_db),
):
    if snapshot_date_param:
        snap_date = snapshot_date_param
    else:
        snap_date = get_latest_snapshot_date(db)
        if snap_date is None:
            raise HTTPException(status_code=404, detail="No snapshot data available")

    rows = get_allocation_rows(db, snap_date)
    if not rows:
        raise HTTPException(status_code=404, detail="No snapshot data for this date")

    fx_rate = get_display_fx_rate(db, display_currency)
    total_value = sum(r["value_in_base"] for r in rows)

    # Group by category
    from collections import defaultdict
    cat_groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        cat_groups[r["category"]].append(r)

    categories = []
    for cat_key, items in cat_groups.items():
        cat_value_twd = sum(i["value_in_base"] for i in items)
        cat_value = cat_value_twd / fx_rate
        cat_pct = round((cat_value_twd / total_value) * 100, 2) if total_value else 0.0
        meta = CATEGORY_META.get(cat_key, {"label": cat_key, "color": "#888888"})

        item_list = []
        for i in items:
            item_value = i["value_in_base"] / fx_rate
            item_pct = round((i["value_in_base"] / total_value) * 100, 2) if total_value else 0.0
            item_list.append(AllocationItemOut(
                asset_id=i["asset_id"],
                name=i["asset_name"],
                value=round(item_value, 2),
                pct=item_pct,
            ))

        categories.append(AllocationCategoryOut(
            category=cat_key,
            label=meta["label"],
            value=round(cat_value, 2),
            pct=cat_pct,
            color=meta["color"],
            items=item_list,
        ))

    return AllocationOut(
        snapshot_date=snap_date,
        display_currency=display_currency,
        categories=categories,
    )
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_dashboard.py::TestDashboardAllocation -v
```

Expected: PASS (all 7 tests green)

- [ ] **Step 5: Commit**

```
git add api/schemas/dashboard.py api/routers/dashboard.py api/tests/test_dashboard.py
git commit -m "feat: add dashboard allocation endpoint (treemap data)"
```

---

## Task 8: Dashboard API — Net Worth History Endpoint

**Files:**
- Edit: `api/schemas/dashboard.py` (add NetWorthHistoryOut)
- Edit: `api/routers/dashboard.py` (add net-worth-history endpoint)
- Edit: `api/tests/test_dashboard.py` (append history tests)

### Overview

`GET /dashboard/net-worth-history?range=30d|1y|all&display_currency=TWD` returns the full time series of daily net worth values from snapshot_items. This is the data used for the line chart. Each data point is `{date, net_worth}`. Display currency conversion is applied to each data point.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_dashboard.py  (append — net-worth-history tests)

NET_WORTH_ROWS = [
    {"snapshot_date": date(2026, 3, 21), "net_worth_twd": 12558320.00},
    {"snapshot_date": date(2026, 3, 22), "net_worth_twd": 12847320.00},
]


class TestNetWorthHistory:
    def test_returns_200_with_data_list(self):
        with (
            patch("api.routers.dashboard.get_net_worth_history_rows", return_value=NET_WORTH_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/net-worth-history?range=30d&display_currency=TWD")

        assert resp.status_code == 200
        body = resp.json()
        assert "display_currency" in body
        assert "data" in body
        assert isinstance(body["data"], list)
        assert len(body["data"]) == 2

    def test_data_points_have_date_and_net_worth(self):
        with (
            patch("api.routers.dashboard.get_net_worth_history_rows", return_value=NET_WORTH_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/net-worth-history?range=30d&display_currency=TWD")

        data = resp.json()["data"]
        for point in data:
            assert "date" in point
            assert "net_worth" in point

    def test_net_worth_values_converted_to_display_currency(self):
        with (
            patch("api.routers.dashboard.get_net_worth_history_rows", return_value=NET_WORTH_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=32.67),
        ):
            resp = client.get("/api/v1/dashboard/net-worth-history?range=30d&display_currency=USD")

        data = resp.json()["data"]
        assert data[0]["net_worth"] == pytest.approx(12558320.00 / 32.67, rel=1e-3)
        assert data[1]["net_worth"] == pytest.approx(12847320.00 / 32.67, rel=1e-3)

    def test_returns_empty_data_when_no_snapshots(self):
        with (
            patch("api.routers.dashboard.get_net_worth_history_rows", return_value=[]),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/net-worth-history?range=30d&display_currency=TWD")

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []

    def test_display_currency_reflected_in_response(self):
        with (
            patch("api.routers.dashboard.get_net_worth_history_rows", return_value=NET_WORTH_ROWS),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=32.67),
        ):
            resp = client.get("/api/v1/dashboard/net-worth-history?range=1y&display_currency=USD")

        assert resp.json()["display_currency"] == "USD"

    def test_rejects_invalid_range_param(self):
        resp = client.get("/api/v1/dashboard/net-worth-history?range=7d&display_currency=TWD")
        assert resp.status_code == 422

    def test_data_is_sorted_ascending_by_date(self):
        unsorted_rows = [
            {"snapshot_date": date(2026, 3, 22), "net_worth_twd": 12847320.00},
            {"snapshot_date": date(2026, 3, 21), "net_worth_twd": 12558320.00},
        ]
        with (
            patch("api.routers.dashboard.get_net_worth_history_rows", return_value=unsorted_rows),
            patch("api.routers.dashboard.get_display_fx_rate", return_value=1.0),
        ):
            resp = client.get("/api/v1/dashboard/net-worth-history?range=30d&display_currency=TWD")

        data = resp.json()["data"]
        dates = [d["date"] for d in data]
        assert dates == sorted(dates)
```

- [ ] **Step 2: Run it to confirm it fails**

```
pytest api/tests/test_dashboard.py::TestNetWorthHistory -v
```

Expected: FAIL (missing `get_net_worth_history_rows` and net-worth-history endpoint)

- [ ] **Step 3: Write minimal implementation**

**Add to `api/schemas/dashboard.py`:**

```python
class NetWorthDataPoint(BaseModel):
    date: date
    net_worth: float


class NetWorthHistoryOut(BaseModel):
    display_currency: str
    data: list[NetWorthDataPoint]
```

**Add to `api/routers/dashboard.py`:**

```python
def get_net_worth_history_rows(db: Session, range_param: str) -> list[dict]:
    """Return daily net_worth_twd for the requested range, sorted by date ASC."""
    if range_param == "30d":
        cutoff = date.today() - timedelta(days=30)
    elif range_param == "1y":
        cutoff = date.today() - timedelta(days=365)
    else:
        cutoff = date(2000, 1, 1)

    rows = db.execute(text("""
        SELECT
            si.snapshot_date,
            SUM(
                CASE WHEN a.asset_class = 'liability'
                     THEN -si.value_in_base
                     ELSE si.value_in_base
                END
            ) AS net_worth_twd
        FROM snapshot_items si
        JOIN assets a ON a.id = si.asset_id
        WHERE si.snapshot_date >= :cutoff
        GROUP BY si.snapshot_date
        ORDER BY si.snapshot_date ASC
    """), {"cutoff": cutoff}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/net-worth-history", response_model=NetWorthHistoryOut)
def get_net_worth_history(
    range: Annotated[RangeParam, Query()] = "30d",
    display_currency: Annotated[DisplayCurrency, Query()] = "TWD",
    db: Session = Depends(get_db),
):
    rows = get_net_worth_history_rows(db, range)
    fx_rate = get_display_fx_rate(db, display_currency)

    data_points = sorted(
        [
            NetWorthDataPoint(
                date=r["snapshot_date"],
                net_worth=round(r["net_worth_twd"] / fx_rate, 2),
            )
            for r in rows
        ],
        key=lambda p: p.date,
    )

    return NetWorthHistoryOut(
        display_currency=display_currency,
        data=data_points,
    )
```

- [ ] **Step 4: Run it to confirm it passes**

```
pytest api/tests/test_dashboard.py::TestNetWorthHistory -v
```

Expected: PASS (all 7 tests green)

Run the full dashboard test file and all test files:

```
pytest api/tests/test_dashboard.py -v
pytest api/tests/ -v
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```
git add api/schemas/dashboard.py api/routers/dashboard.py api/tests/test_dashboard.py
git commit -m "feat: add dashboard net-worth-history endpoint (line chart data)"
```

---

## Final Verification

After all 8 tasks are complete, run the full test suite:

```bash
pytest api/tests/ -v --tb=short
```

All tests must pass. Then verify the FastAPI app starts cleanly:

```bash
uvicorn api.main:app --reload --port 8000
```

Confirm the following routes are registered (check `/docs` or `/openapi.json`):
- `GET /api/v1/snapshots/history`
- `GET /api/v1/snapshots/items?asset_id=&range=`
- `GET /api/v1/snapshots/{date}`
- `POST /api/v1/snapshots/rebuild/{date}`
- `POST /api/v1/snapshots/rebuild-range`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/allocation`
- `GET /api/v1/dashboard/net-worth-history`

Confirm APScheduler logs a startup message at `INFO` level with the cron schedule.

Final commit:

```bash
git add -A
git commit -m "feat: complete Plan 2 — backend services, snapshot job, and dashboard API"
```
