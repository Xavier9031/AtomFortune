# AtomWorth — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the AtomWorth backend with FastAPI, PostgreSQL, and all CRUD API endpoints.

**Architecture:** FastAPI (sync) + SQLAlchemy ORM (sync, psycopg2) + PostgreSQL 16. Each resource has a model, Pydantic schema, and router. Tests use pytest + FastAPI TestClient against a real PostgreSQL test database.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x (sync), psycopg2-binary, pydantic-settings, pytest, httpx

**Prerequisite:** Plan Part 2 (services + dashboard) and Plan Part 3 (frontend) follow this plan.

---

## Project File Structure

```
AtomWorth/
├── api/
│   ├── main.py                    # FastAPI app + router registration
│   ├── config.py                  # pydantic-settings: DATABASE_URL, BASE_CURRENCY, etc.
│   ├── database.py                # SQLAlchemy engine, SessionLocal, Base, get_db dependency
│   ├── models/
│   │   ├── __init__.py
│   │   ├── asset.py               # Asset ORM model
│   │   ├── account.py             # Account ORM model
│   │   ├── holding.py             # Holding ORM model (composite PK: asset_id + account_id)
│   │   ├── transaction.py         # Transaction ORM model
│   │   ├── price.py               # Price ORM model
│   │   ├── fx_rate.py             # FxRate ORM model
│   │   └── snapshot_item.py       # SnapshotItem ORM model
│   ├── schemas/
│   │   ├── asset.py               # AssetCreate, AssetUpdate, AssetOut
│   │   ├── account.py             # AccountCreate, AccountUpdate, AccountOut
│   │   ├── holding.py             # HoldingUpsert, HoldingOut
│   │   ├── transaction.py         # TransactionCreate, TransactionPatch, TransactionOut
│   │   ├── price.py               # PriceManualCreate, PriceOut
│   │   └── fx_rate.py             # FxRateManualCreate, FxRateOut
│   ├── routers/
│   │   ├── assets.py              # GET/POST/PATCH/DELETE /assets
│   │   ├── accounts.py            # GET/POST/PATCH/DELETE /accounts
│   │   ├── holdings.py            # GET/PUT/DELETE /holdings
│   │   ├── transactions.py        # GET/POST/PATCH/DELETE /transactions
│   │   ├── prices.py              # GET /prices, POST /prices/manual
│   │   └── fx_rates.py            # GET /fx-rates, POST /fx-rates/manual
│   ├── migrations/
│   │   └── 001_init.sql           # Full DDL for all 7 tables
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
│       ├── conftest.py            # Test DB setup, TestClient fixture
│       ├── test_assets.py
│       ├── test_accounts.py
│       ├── test_holdings.py
│       ├── test_transactions.py
│       ├── test_prices.py
│       └── test_fx_rates.py
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## Task 1: Docker Compose + Project Scaffold

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `api/Dockerfile`
- Create: `api/requirements.txt`
- Create: `api/.env.example`

- [ ] **Step 1: Write the failing test**

No automated test for Docker Compose itself. Verify manually by checking that `docker compose config` validates without errors. Skip to Step 3.

- [ ] **Step 2: Run it to confirm it fails**

Run: `docker compose config`
Expected: Error — files don't exist yet.

- [ ] **Step 3: Write minimal implementation**

`api/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
pydantic-settings==2.5.2
httpx==0.27.2
pytest==8.3.3
pytest-cov==5.0.0
python-dotenv==1.0.1
```

`api/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

`api/.env.example`:
```
DATABASE_URL=postgresql://atomworth:atomworth@db:5432/atomworth
BASE_CURRENCY=TWD
SNAPSHOT_SCHEDULE=0 22 * * *
EXCHANGERATE_API_KEY=your_key_here
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: atomworth
      POSTGRES_PASSWORD: atomworth
      POSTGRES_DB: atomworth
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U atomworth"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://atomworth:atomworth@db:5432/atomworth
      BASE_CURRENCY: TWD
      SNAPSHOT_SCHEDULE: "0 22 * * *"
      EXCHANGERATE_API_KEY: ${EXCHANGERATE_API_KEY:-}
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./api:/app

  web:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://localhost:8000/api/v1
    depends_on:
      - api

volumes:
  pgdata:
```

`docker-compose.dev.yml`:
```yaml
# Overrides for local development — use with:
# docker compose -f docker-compose.yml -f docker-compose.dev.yml up
services:
  db:
    ports:
      - "5432:5432"

  api:
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./api:/app
    environment:
      DATABASE_URL: postgresql://atomworth:atomworth@db:5432/atomworth

  web:
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://localhost:8000/api/v1
```

Create directory structure:
```
mkdir -p api/models api/schemas api/routers api/migrations api/tests
touch api/models/__init__.py
touch api/schemas/__init__.py
touch api/routers/__init__.py
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `docker compose config`
Expected: Validates without errors (web service will warn if `./web` does not exist yet — that is expected).

- [ ] **Step 5: Commit**
`git add docker-compose.yml docker-compose.dev.yml api/Dockerfile api/requirements.txt api/.env.example && git commit -m "chore: add Docker Compose scaffold and API Dockerfile"`

---

## Task 2: PostgreSQL Schema Migration (001_init.sql)

**Files:**
- Create: `api/migrations/001_init.sql`

- [ ] **Step 1: Write the failing test**

No automated test for raw SQL. Manually verify by running the migration against a fresh database. Skip to Step 3.

- [ ] **Step 2: Run it to confirm it fails**

Run: `psql $DATABASE_URL -f api/migrations/001_init.sql`
Expected: Error — file doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`api/migrations/001_init.sql`:
```sql
-- AtomWorth — Initial Schema
-- Run once against a fresh database:
--   psql $DATABASE_URL -f api/migrations/001_init.sql

-- ─────────────────────────────────────────────
-- 1. assets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  asset_class   TEXT        NOT NULL CHECK (asset_class IN ('asset', 'liability')),
  category      TEXT        NOT NULL,
  sub_kind      TEXT        NOT NULL,
  symbol        TEXT,
  market        TEXT,
  currency_code TEXT        NOT NULL,
  pricing_mode  TEXT        NOT NULL CHECK (pricing_mode IN ('market', 'fixed', 'manual')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. accounts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  institution  TEXT,
  account_type TEXT        NOT NULL CHECK (account_type IN (
                 'bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. holdings
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  asset_id   UUID           NOT NULL REFERENCES assets(id)   ON DELETE CASCADE,
  account_id UUID           NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity   NUMERIC(24,8)  NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);

-- ─────────────────────────────────────────────
-- 4. transactions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID           NOT NULL REFERENCES assets(id)   ON DELETE CASCADE,
  account_id UUID           NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  txn_type   TEXT           NOT NULL CHECK (txn_type IN (
               'buy', 'sell', 'transfer_in', 'transfer_out', 'adjustment')),
  quantity   NUMERIC(24,8)  NOT NULL,
  txn_date   DATE           NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_asset   ON transactions(asset_id,   txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id, txn_date DESC);

-- ─────────────────────────────────────────────
-- 5. prices
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prices (
  asset_id   UUID           NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price_date DATE           NOT NULL,
  price      NUMERIC(24,8)  NOT NULL CHECK (price >= 0),
  source     TEXT           NOT NULL,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, price_date)
);

CREATE INDEX IF NOT EXISTS idx_prices_date ON prices(price_date);

-- ─────────────────────────────────────────────
-- 6. fx_rates
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fx_rates (
  from_currency TEXT           NOT NULL,
  to_currency   TEXT           NOT NULL,
  rate_date     DATE           NOT NULL,
  rate          NUMERIC(24,10) NOT NULL CHECK (rate > 0),
  source        TEXT           NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_currency, to_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON fx_rates(rate_date);

-- ─────────────────────────────────────────────
-- 7. snapshot_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshot_items (
  snapshot_date DATE           NOT NULL,
  asset_id      UUID           NOT NULL REFERENCES assets(id)   ON DELETE CASCADE,
  account_id    UUID           NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity      NUMERIC(24,8)  NOT NULL CHECK (quantity >= 0),
  price         NUMERIC(24,8)  NOT NULL CHECK (price >= 0),
  fx_rate       NUMERIC(24,10) NOT NULL CHECK (fx_rate > 0),
  value_in_base NUMERIC(24,8)  NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (snapshot_date, asset_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_items_date    ON snapshot_items(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_asset   ON snapshot_items(asset_id,    snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_account ON snapshot_items(account_id,  snapshot_date DESC);
```

- [ ] **Step 4: Run it to confirm it passes**

Start the database:
```
docker compose up db -d
```

Run the migration:
```
docker compose exec db psql -U atomworth -d atomworth -f /dev/stdin < api/migrations/001_init.sql
```

Verify all 7 tables exist:
```
docker compose exec db psql -U atomworth -d atomworth -c "\dt"
```
Expected: 7 rows — assets, accounts, holdings, transactions, prices, fx_rates, snapshot_items.

- [ ] **Step 5: Commit**
`git add api/migrations/001_init.sql && git commit -m "feat: add initial PostgreSQL schema with all 7 tables"`

---

## Task 3: FastAPI App + DB Connection + Test conftest.py

**Files:**
- Create: `api/config.py`
- Create: `api/database.py`
- Create: `api/models/asset.py`, `account.py`, `holding.py`, `transaction.py`, `price.py`, `fx_rate.py`, `snapshot_item.py`
- Create: `api/models/__init__.py`
- Create: `api/main.py`
- Create: `api/tests/conftest.py`
- Test: `api/tests/conftest.py` (session-scoped fixture)

- [ ] **Step 1: Write the failing test**

`api/tests/conftest.py`:
```python
import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Point at a dedicated test database
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://atomworth:atomworth@localhost:5432/test_atomworth",
)


@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DATABASE_URL)
    # Import all models so Base.metadata knows about them
    from models import Base  # noqa: F401
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    from main import app
    from database import get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Write a smoke test to ensure the TestClient starts:
`api/tests/test_health.py`:
```python
def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run it to confirm it fails**

Ensure `test_atomworth` database exists first:
```
docker compose exec db psql -U atomworth -c "CREATE DATABASE test_atomworth;"
```

Run: `cd api && pytest tests/test_health.py -v`
Expected: FAIL — `main.py`, `database.py`, `config.py`, models do not exist yet.

- [ ] **Step 3: Write minimal implementation**

`api/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://atomworth:atomworth@localhost:5432/atomworth"
    base_currency: str = "TWD"
    snapshot_schedule: str = "0 22 * * *"
    exchangerate_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

`api/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

`api/models/__init__.py`:
```python
from database import Base  # noqa: F401
from models.asset import Asset  # noqa: F401
from models.account import Account  # noqa: F401
from models.holding import Holding  # noqa: F401
from models.transaction import Transaction  # noqa: F401
from models.price import Price  # noqa: F401
from models.fx_rate import FxRate  # noqa: F401
from models.snapshot_item import SnapshotItem  # noqa: F401
```

`api/models/asset.py`:
```python
import uuid
from sqlalchemy import Column, Text, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Asset(Base):
    __tablename__ = "assets"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(Text, nullable=False)
    asset_class   = Column(Text, nullable=False)
    category      = Column(Text, nullable=False)
    sub_kind      = Column(Text, nullable=False)
    symbol        = Column(Text, nullable=True)
    market        = Column(Text, nullable=True)
    currency_code = Column(Text, nullable=False)
    pricing_mode  = Column(Text, nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/models/account.py`:
```python
import uuid
from sqlalchemy import Column, Text, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Account(Base):
    __tablename__ = "accounts"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = Column(Text, nullable=False)
    institution  = Column(Text, nullable=True)
    account_type = Column(Text, nullable=False)
    note         = Column(Text, nullable=True)
    created_at   = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/models/holding.py`:
```python
from sqlalchemy import Column, Numeric, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Holding(Base):
    __tablename__ = "holdings"

    asset_id   = Column(UUID(as_uuid=True), ForeignKey("assets.id",   ondelete="CASCADE"), primary_key=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    quantity   = Column(Numeric(24, 8), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/models/transaction.py`:
```python
import uuid
from sqlalchemy import Column, Text, Date, Numeric, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id   = Column(UUID(as_uuid=True), ForeignKey("assets.id",   ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    txn_type   = Column(Text, nullable=False)
    quantity   = Column(Numeric(24, 8), nullable=False)
    txn_date   = Column(Date, nullable=False)
    note       = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/models/price.py`:
```python
from sqlalchemy import Column, Text, Date, Numeric, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Price(Base):
    __tablename__ = "prices"

    asset_id   = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True)
    price_date = Column(Date, primary_key=True)
    price      = Column(Numeric(24, 8), nullable=False)
    source     = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/models/fx_rate.py`:
```python
from sqlalchemy import Column, Text, Date, Numeric, TIMESTAMP, func
from database import Base


class FxRate(Base):
    __tablename__ = "fx_rates"

    from_currency = Column(Text, primary_key=True)
    to_currency   = Column(Text, primary_key=True)
    rate_date     = Column(Date, primary_key=True)
    rate          = Column(Numeric(24, 10), nullable=False)
    source        = Column(Text, nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/models/snapshot_item.py`:
```python
from sqlalchemy import Column, Date, Numeric, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class SnapshotItem(Base):
    __tablename__ = "snapshot_items"

    snapshot_date = Column(Date, primary_key=True)
    asset_id      = Column(UUID(as_uuid=True), ForeignKey("assets.id",   ondelete="CASCADE"), primary_key=True)
    account_id    = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    quantity      = Column(Numeric(24, 8),  nullable=False)
    price         = Column(Numeric(24, 8),  nullable=False)
    fx_rate       = Column(Numeric(24, 10), nullable=False)
    value_in_base = Column(Numeric(24, 8),  nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

`api/main.py`:
```python
from fastapi import FastAPI

app = FastAPI(title="AtomWorth API", version="1.0.0")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd api && pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
`git add api/config.py api/database.py api/models/ api/main.py api/tests/conftest.py api/tests/test_health.py && git commit -m "feat: add FastAPI app skeleton, SQLAlchemy models, and test infrastructure"`

---

## Task 4: Assets API (CRUD with Full Validation)

**Files:**
- Create: `api/schemas/asset.py`
- Create: `api/routers/assets.py`
- Modify: `api/main.py`
- Test: `api/tests/test_assets.py`

### Validation Rules (from spec)
- `asset_class` must be `'asset'` or `'liability'`
- `asset_class='asset'` → `category` in `{'liquid', 'investment', 'fixed', 'receivable'}`
- `asset_class='liability'` → `category` must be `'debt'`
- PATCH only allows: `name`, `symbol`, `market`
- `asset_class`, `category`, `sub_kind`, `currency_code`, `pricing_mode` are **immutable** once any `snapshot_items` row exists for this asset → return 422

- [ ] **Step 1: Write the failing test**

`api/tests/test_assets.py`:
```python
import pytest


ASSET_PAYLOAD = {
    "name": "AAPL",
    "asset_class": "asset",
    "category": "investment",
    "sub_kind": "stock",
    "symbol": "AAPL",
    "market": "NASDAQ",
    "currency_code": "USD",
    "pricing_mode": "market",
}


# ── POST /api/v1/assets ────────────────────────────────────────────────────────

def test_create_asset(client):
    r = client.post("/api/v1/assets", json=ASSET_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "AAPL"
    assert data["asset_class"] == "asset"
    assert "id" in data


def test_create_asset_invalid_class(client):
    payload = {**ASSET_PAYLOAD, "asset_class": "unknown"}
    r = client.post("/api/v1/assets", json=payload)
    assert r.status_code == 422


def test_create_asset_invalid_category_for_asset(client):
    # 'asset' class cannot have category='debt'
    payload = {**ASSET_PAYLOAD, "category": "debt"}
    r = client.post("/api/v1/assets", json=payload)
    assert r.status_code == 422


def test_create_asset_invalid_category_for_liability(client):
    # 'liability' class must have category='debt'
    payload = {**ASSET_PAYLOAD, "asset_class": "liability", "category": "liquid"}
    r = client.post("/api/v1/assets", json=payload)
    assert r.status_code == 422


def test_create_liability_asset(client):
    payload = {
        "name": "Credit Card",
        "asset_class": "liability",
        "category": "debt",
        "sub_kind": "credit_card",
        "currency_code": "TWD",
        "pricing_mode": "fixed",
    }
    r = client.post("/api/v1/assets", json=payload)
    assert r.status_code == 201
    assert r.json()["asset_class"] == "liability"


# ── GET /api/v1/assets ────────────────────────────────────────────────────────

def test_list_assets_empty(client):
    r = client.get("/api/v1/assets")
    assert r.status_code == 200
    assert r.json() == []


def test_list_assets_returns_created(client):
    client.post("/api/v1/assets", json=ASSET_PAYLOAD)
    r = client.get("/api/v1/assets")
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── PATCH /api/v1/assets/{id} ─────────────────────────────────────────────────

def test_patch_asset_mutable_fields(client):
    created = client.post("/api/v1/assets", json=ASSET_PAYLOAD).json()
    asset_id = created["id"]
    r = client.patch(f"/api/v1/assets/{asset_id}", json={"name": "Apple Inc.", "symbol": "AAPL", "market": "NYSE"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Apple Inc."
    assert data["market"] == "NYSE"


def test_patch_asset_immutable_field_rejected(client):
    created = client.post("/api/v1/assets", json=ASSET_PAYLOAD).json()
    asset_id = created["id"]
    # Attempting to patch an immutable field should return 422
    r = client.patch(f"/api/v1/assets/{asset_id}", json={"currency_code": "EUR"})
    assert r.status_code == 422


def test_patch_asset_immutable_when_snapshot_exists(client, db_session):
    from models.asset import Asset
    from models.account import Account
    from models.snapshot_item import SnapshotItem
    import uuid
    from datetime import date, datetime, timezone

    created = client.post("/api/v1/assets", json=ASSET_PAYLOAD).json()
    asset_id = created["id"]

    # Create an account and a snapshot_item to simulate a snapshot existing
    account = Account(
        id=uuid.uuid4(),
        name="Test Broker",
        account_type="broker",
    )
    db_session.add(account)
    db_session.flush()

    snap = SnapshotItem(
        snapshot_date=date(2026, 3, 22),
        asset_id=uuid.UUID(asset_id),
        account_id=account.id,
        quantity=10,
        price=210,
        fx_rate=32.5,
        value_in_base=68250,
    )
    db_session.add(snap)
    db_session.flush()

    # Now patching an immutable field should be rejected
    r = client.patch(f"/api/v1/assets/{asset_id}", json={"pricing_mode": "manual"})
    assert r.status_code == 422


def test_patch_asset_not_found(client):
    r = client.patch("/api/v1/assets/00000000-0000-0000-0000-000000000000", json={"name": "X"})
    assert r.status_code == 404


# ── DELETE /api/v1/assets/{id} ────────────────────────────────────────────────

def test_delete_asset(client):
    created = client.post("/api/v1/assets", json=ASSET_PAYLOAD).json()
    asset_id = created["id"]
    r = client.delete(f"/api/v1/assets/{asset_id}")
    assert r.status_code == 204
    # Confirm gone
    r2 = client.get("/api/v1/assets")
    assert all(a["id"] != asset_id for a in r2.json())


def test_delete_asset_not_found(client):
    r = client.delete("/api/v1/assets/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd api && pytest tests/test_assets.py -v`
Expected: FAIL — router and schemas don't exist yet.

- [ ] **Step 3: Write minimal implementation**

`api/schemas/asset.py`:
```python
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, model_validator

ASSET_CATEGORIES = {"liquid", "investment", "fixed", "receivable"}
LIABILITY_CATEGORIES = {"debt"}


class AssetCreate(BaseModel):
    name: str
    asset_class: str
    category: str
    sub_kind: str
    symbol: Optional[str] = None
    market: Optional[str] = None
    currency_code: str
    pricing_mode: str

    @model_validator(mode="after")
    def validate_class_category(self) -> AssetCreate:
        if self.asset_class not in ("asset", "liability"):
            raise ValueError("asset_class must be 'asset' or 'liability'")
        if self.pricing_mode not in ("market", "fixed", "manual"):
            raise ValueError("pricing_mode must be 'market', 'fixed', or 'manual'")
        if self.asset_class == "asset" and self.category not in ASSET_CATEGORIES:
            raise ValueError(
                f"For asset_class='asset', category must be one of {sorted(ASSET_CATEGORIES)}"
            )
        if self.asset_class == "liability" and self.category not in LIABILITY_CATEGORIES:
            raise ValueError("For asset_class='liability', category must be 'debt'")
        return self


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    market: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def reject_immutable_fields(cls, values: dict) -> dict:
        immutable = {"asset_class", "category", "sub_kind", "currency_code", "pricing_mode"}
        found = immutable & set(values.keys())
        if found:
            raise ValueError(
                f"Fields {sorted(found)} are immutable and cannot be patched"
            )
        return values


class AssetOut(BaseModel):
    id: uuid.UUID
    name: str
    asset_class: str
    category: str
    sub_kind: str
    symbol: Optional[str]
    market: Optional[str]
    currency_code: str
    pricing_mode: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

`api/routers/assets.py`:
```python
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.asset import Asset
from models.snapshot_item import SnapshotItem
from schemas.asset import AssetCreate, AssetUpdate, AssetOut

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.get("", response_model=List[AssetOut])
def list_assets(db: Session = Depends(get_db)):
    return db.query(Asset).all()


@router.post("", response_model=AssetOut, status_code=201)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)):
    asset = Asset(
        id=uuid.uuid4(),
        **payload.model_dump(),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
def patch_asset(asset_id: uuid.UUID, payload: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Check snapshot guard: if any snapshot exists, immutable fields cannot change
    # (AssetUpdate schema already rejects immutable fields in the payload,
    #  but we still guard here in case someone sends a non-empty mutable payload
    #  when snapshots exist and a future developer adds immutable fields by mistake.)
    has_snapshot = db.query(SnapshotItem).filter(SnapshotItem.asset_id == asset_id).first()

    updates = payload.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(asset, field, value)

    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: uuid.UUID, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
```

Update `api/main.py`:
```python
from fastapi import FastAPI
from routers import assets

app = FastAPI(title="AtomWorth API", version="1.0.0")

app.include_router(assets.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd api && pytest tests/test_assets.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**
`git add api/schemas/asset.py api/routers/assets.py api/main.py api/tests/test_assets.py && git commit -m "feat: add Assets CRUD API with class/category validation and immutable field guard"`

---

## Task 5: Accounts API (CRUD with 409 on Delete-with-Holdings)

**Files:**
- Create: `api/schemas/account.py`
- Create: `api/routers/accounts.py`
- Modify: `api/main.py`
- Test: `api/tests/test_accounts.py`

### Validation Rules
- `account_type` must be one of: `bank`, `broker`, `crypto_exchange`, `e_wallet`, `cash`, `other`
- `DELETE /accounts/{id}` returns **409 Conflict** if any holdings exist for this account

- [ ] **Step 1: Write the failing test**

`api/tests/test_accounts.py`:
```python
import pytest
import uuid

ACCOUNT_PAYLOAD = {
    "name": "富途證券",
    "institution": "Futu Securities",
    "account_type": "broker",
    "note": "港股/美股",
}


# ── POST /api/v1/accounts ─────────────────────────────────────────────────────

def test_create_account(client):
    r = client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "富途證券"
    assert data["account_type"] == "broker"
    assert "id" in data


def test_create_account_invalid_type(client):
    payload = {**ACCOUNT_PAYLOAD, "account_type": "invalid"}
    r = client.post("/api/v1/accounts", json=payload)
    assert r.status_code == 422


def test_create_account_minimal(client):
    r = client.post("/api/v1/accounts", json={"name": "Cash Wallet", "account_type": "cash"})
    assert r.status_code == 201


# ── GET /api/v1/accounts ──────────────────────────────────────────────────────

def test_list_accounts_empty(client):
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200
    assert r.json() == []


def test_list_accounts(client):
    client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD)
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── PATCH /api/v1/accounts/{id} ──────────────────────────────────────────────

def test_patch_account(client):
    created = client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD).json()
    account_id = created["id"]
    r = client.patch(f"/api/v1/accounts/{account_id}", json={"name": "Futu Updated", "note": "Updated note"})
    assert r.status_code == 200
    assert r.json()["name"] == "Futu Updated"


def test_patch_account_not_found(client):
    r = client.patch("/api/v1/accounts/00000000-0000-0000-0000-000000000000", json={"name": "X"})
    assert r.status_code == 404


# ── DELETE /api/v1/accounts/{id} ─────────────────────────────────────────────

def test_delete_account(client):
    created = client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD).json()
    account_id = created["id"]
    r = client.delete(f"/api/v1/accounts/{account_id}")
    assert r.status_code == 204


def test_delete_account_not_found(client):
    r = client.delete("/api/v1/accounts/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_delete_account_with_holdings_returns_409(client, db_session):
    from models.asset import Asset
    from models.account import Account
    from models.holding import Holding

    # Create an account via API
    acc_resp = client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD).json()
    account_id = acc_resp["id"]

    # Directly insert a holding via ORM to simulate holdings existing
    asset = Asset(
        id=uuid.uuid4(),
        name="Test Asset",
        asset_class="asset",
        category="investment",
        sub_kind="stock",
        currency_code="USD",
        pricing_mode="market",
    )
    db_session.add(asset)
    db_session.flush()

    holding = Holding(
        asset_id=asset.id,
        account_id=uuid.UUID(account_id),
        quantity=10,
    )
    db_session.add(holding)
    db_session.flush()

    r = client.delete(f"/api/v1/accounts/{account_id}")
    assert r.status_code == 409
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd api && pytest tests/test_accounts.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`api/schemas/account.py`:
```python
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator

VALID_ACCOUNT_TYPES = {"bank", "broker", "crypto_exchange", "e_wallet", "cash", "other"}


class AccountCreate(BaseModel):
    name: str
    institution: Optional[str] = None
    account_type: str
    note: Optional[str] = None

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        if v not in VALID_ACCOUNT_TYPES:
            raise ValueError(f"account_type must be one of {sorted(VALID_ACCOUNT_TYPES)}")
        return v


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    account_type: Optional[str] = None
    note: Optional[str] = None

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ACCOUNT_TYPES:
            raise ValueError(f"account_type must be one of {sorted(VALID_ACCOUNT_TYPES)}")
        return v


class AccountOut(BaseModel):
    id: uuid.UUID
    name: str
    institution: Optional[str]
    account_type: str
    note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

`api/routers/accounts.py`:
```python
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.account import Account
from models.holding import Holding
from schemas.account import AccountCreate, AccountUpdate, AccountOut

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.get("", response_model=List[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()


@router.post("", response_model=AccountOut, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)):
    account = Account(id=uuid.uuid4(), **payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountOut)
def patch_account(account_id: uuid.UUID, payload: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: uuid.UUID, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    has_holdings = db.query(Holding).filter(Holding.account_id == account_id).first()
    if has_holdings:
        raise HTTPException(status_code=409, detail="Cannot delete account with existing holdings")
    db.delete(account)
    db.commit()
```

Update `api/main.py` to include accounts router:
```python
from fastapi import FastAPI
from routers import assets, accounts

app = FastAPI(title="AtomWorth API", version="1.0.0")

app.include_router(assets.router)
app.include_router(accounts.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd api && pytest tests/test_accounts.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
`git add api/schemas/account.py api/routers/accounts.py api/main.py api/tests/test_accounts.py && git commit -m "feat: add Accounts CRUD API with 409 guard on delete-with-holdings"`

---

## Task 6: Holdings API (PUT Upsert, GET with Joins, DELETE)

**Files:**
- Create: `api/schemas/holding.py`
- Create: `api/routers/holdings.py`
- Modify: `api/main.py`
- Test: `api/tests/test_holdings.py`

### Endpoint Rules
- `GET /holdings` — returns list with joined `asset_name`, `account_name`, and `latest_value_in_base` from the most recent `snapshot_items` row (can be `null`)
- `GET /holdings?account_id=` — filter by account
- `PUT /holdings/{asset_id}/{account_id}` — upsert `quantity` only; both `asset_id` and `account_id` must exist, else 404
- `DELETE /holdings/{asset_id}/{account_id}` — 404 if not found

- [ ] **Step 1: Write the failing test**

`api/tests/test_holdings.py`:
```python
import uuid
import pytest

ASSET_PAYLOAD = {
    "name": "BTC",
    "asset_class": "asset",
    "category": "investment",
    "sub_kind": "crypto",
    "symbol": "BTC-USD",
    "currency_code": "USD",
    "pricing_mode": "market",
}

ACCOUNT_PAYLOAD = {
    "name": "Binance",
    "account_type": "crypto_exchange",
}


def _create_asset_and_account(client):
    asset_id = client.post("/api/v1/assets", json=ASSET_PAYLOAD).json()["id"]
    account_id = client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD).json()["id"]
    return asset_id, account_id


# ── GET /api/v1/holdings ──────────────────────────────────────────────────────

def test_list_holdings_empty(client):
    r = client.get("/api/v1/holdings")
    assert r.status_code == 200
    assert r.json() == []


def test_list_holdings_after_upsert(client):
    asset_id, account_id = _create_asset_and_account(client)
    client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "2.5"})
    r = client.get("/api/v1/holdings")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    h = items[0]
    assert h["asset_id"] == asset_id
    assert h["account_id"] == account_id
    assert float(h["quantity"]) == 2.5
    assert h["asset_name"] == "BTC"
    assert h["account_name"] == "Binance"
    assert h["latest_value_in_base"] is None  # no snapshot yet


def test_list_holdings_filter_by_account(client):
    asset_id, account_id = _create_asset_and_account(client)
    client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "1.0"})

    # Create a second account with its own holding
    other_account_id = client.post(
        "/api/v1/accounts", json={"name": "OKX", "account_type": "crypto_exchange"}
    ).json()["id"]
    client.put(f"/api/v1/holdings/{asset_id}/{other_account_id}", json={"quantity": "3.0"})

    r = client.get(f"/api/v1/holdings?account_id={account_id}")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["account_id"] == account_id


# ── PUT /api/v1/holdings/{asset_id}/{account_id} ──────────────────────────────

def test_upsert_holding_create(client):
    asset_id, account_id = _create_asset_and_account(client)
    r = client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "5.0"})
    assert r.status_code == 200
    assert float(r.json()["quantity"]) == 5.0


def test_upsert_holding_update(client):
    asset_id, account_id = _create_asset_and_account(client)
    client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "5.0"})
    r = client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "7.25"})
    assert r.status_code == 200
    assert float(r.json()["quantity"]) == 7.25


def test_upsert_holding_asset_not_found(client):
    _, account_id = _create_asset_and_account(client)
    fake_asset_id = str(uuid.uuid4())
    r = client.put(f"/api/v1/holdings/{fake_asset_id}/{account_id}", json={"quantity": "1.0"})
    assert r.status_code == 404


def test_upsert_holding_account_not_found(client):
    asset_id, _ = _create_asset_and_account(client)
    fake_account_id = str(uuid.uuid4())
    r = client.put(f"/api/v1/holdings/{asset_id}/{fake_account_id}", json={"quantity": "1.0"})
    assert r.status_code == 404


def test_upsert_holding_negative_quantity_rejected(client):
    asset_id, account_id = _create_asset_and_account(client)
    r = client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "-1.0"})
    assert r.status_code == 422


# ── DELETE /api/v1/holdings/{asset_id}/{account_id} ──────────────────────────

def test_delete_holding(client):
    asset_id, account_id = _create_asset_and_account(client)
    client.put(f"/api/v1/holdings/{asset_id}/{account_id}", json={"quantity": "5.0"})
    r = client.delete(f"/api/v1/holdings/{asset_id}/{account_id}")
    assert r.status_code == 204
    # Confirm gone
    r2 = client.get("/api/v1/holdings")
    assert r2.json() == []


def test_delete_holding_not_found(client):
    fake = str(uuid.uuid4())
    r = client.delete(f"/api/v1/holdings/{fake}/{fake}")
    assert r.status_code == 404
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd api && pytest tests/test_holdings.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`api/schemas/holding.py`:
```python
from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_validator


class HoldingUpsert(BaseModel):
    quantity: Decimal

    @field_validator("quantity")
    @classmethod
    def must_be_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("quantity must be >= 0")
        return v


class HoldingOut(BaseModel):
    asset_id: uuid.UUID
    account_id: uuid.UUID
    quantity: Decimal
    asset_name: str
    asset_class: str
    category: str
    sub_kind: str
    currency_code: str
    pricing_mode: str
    account_name: str
    account_type: str
    latest_value_in_base: Optional[Decimal]
    updated_at: datetime

    model_config = {"from_attributes": True}
```

`api/routers/holdings.py`:
```python
import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from database import get_db
from models.asset import Asset
from models.account import Account
from models.holding import Holding
from models.snapshot_item import SnapshotItem
from schemas.holding import HoldingUpsert, HoldingOut

router = APIRouter(prefix="/api/v1/holdings", tags=["holdings"])


def _build_holdings_query(db: Session, account_id: Optional[uuid.UUID] = None):
    """Return a list of dicts matching HoldingOut."""

    # Subquery: latest value_in_base per (asset_id, account_id) from snapshot_items
    latest_snap = (
        db.query(
            SnapshotItem.asset_id,
            SnapshotItem.account_id,
            SnapshotItem.value_in_base.label("latest_value_in_base"),
        )
        .distinct(SnapshotItem.asset_id, SnapshotItem.account_id)
        .order_by(
            SnapshotItem.asset_id,
            SnapshotItem.account_id,
            SnapshotItem.snapshot_date.desc(),
        )
        .subquery()
    )

    q = (
        db.query(
            Holding.asset_id,
            Holding.account_id,
            Holding.quantity,
            Holding.updated_at,
            Asset.name.label("asset_name"),
            Asset.asset_class,
            Asset.category,
            Asset.sub_kind,
            Asset.currency_code,
            Asset.pricing_mode,
            Account.name.label("account_name"),
            Account.account_type,
            latest_snap.c.latest_value_in_base,
        )
        .join(Asset, Asset.id == Holding.asset_id)
        .join(Account, Account.id == Holding.account_id)
        .outerjoin(
            latest_snap,
            (latest_snap.c.asset_id == Holding.asset_id)
            & (latest_snap.c.account_id == Holding.account_id),
        )
    )

    if account_id is not None:
        q = q.filter(Holding.account_id == account_id)

    return q.all()


@router.get("", response_model=List[HoldingOut])
def list_holdings(
    account_id: Optional[uuid.UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    rows = _build_holdings_query(db, account_id=account_id)
    return [HoldingOut(**row._asdict()) for row in rows]


@router.put("/{asset_id}/{account_id}", response_model=HoldingOut)
def upsert_holding(
    asset_id: uuid.UUID,
    account_id: uuid.UUID,
    payload: HoldingUpsert,
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    holding = db.query(Holding).filter(
        Holding.asset_id == asset_id,
        Holding.account_id == account_id,
    ).first()

    if holding:
        holding.quantity = payload.quantity
    else:
        holding = Holding(
            asset_id=asset_id,
            account_id=account_id,
            quantity=payload.quantity,
        )
        db.add(holding)

    db.commit()
    db.refresh(holding)

    rows = _build_holdings_query(db, account_id=None)
    for row in rows:
        if row.asset_id == asset_id and row.account_id == account_id:
            return HoldingOut(**row._asdict())

    raise HTTPException(status_code=500, detail="Failed to retrieve updated holding")


@router.delete("/{asset_id}/{account_id}", status_code=204)
def delete_holding(
    asset_id: uuid.UUID,
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    holding = db.query(Holding).filter(
        Holding.asset_id == asset_id,
        Holding.account_id == account_id,
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(holding)
    db.commit()
```

Update `api/main.py`:
```python
from fastapi import FastAPI
from routers import assets, accounts, holdings

app = FastAPI(title="AtomWorth API", version="1.0.0")

app.include_router(assets.router)
app.include_router(accounts.router)
app.include_router(holdings.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd api && pytest tests/test_holdings.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
`git add api/schemas/holding.py api/routers/holdings.py api/main.py api/tests/test_holdings.py && git commit -m "feat: add Holdings API with upsert, joined GET, and delete"`

---

## Task 7: Transactions API (CRUD with Type-Based Restrictions)

**Files:**
- Create: `api/schemas/transaction.py`
- Create: `api/routers/transactions.py`
- Modify: `api/main.py`
- Test: `api/tests/test_transactions.py`

### Validation Rules
- `txn_type` must be one of: `buy`, `sell`, `transfer_in`, `transfer_out`, `adjustment`
- Only `adjustment` allows negative `quantity`; all other types require `quantity > 0`
- `PATCH /transactions/{id}` — only allows patching `note`
- `DELETE /transactions/{id}` — only allowed when `txn_type == 'adjustment'`; returns 422 otherwise
- `txn_type`, `quantity`, `txn_date`, `asset_id`, `account_id` are immutable

- [ ] **Step 1: Write the failing test**

`api/tests/test_transactions.py`:
```python
import uuid
import pytest

ASSET_PAYLOAD = {
    "name": "ETH",
    "asset_class": "asset",
    "category": "investment",
    "sub_kind": "crypto",
    "symbol": "ETH-USD",
    "currency_code": "USD",
    "pricing_mode": "market",
}

ACCOUNT_PAYLOAD = {
    "name": "Coinbase",
    "account_type": "crypto_exchange",
}


def _setup(client):
    asset_id = client.post("/api/v1/assets", json=ASSET_PAYLOAD).json()["id"]
    account_id = client.post("/api/v1/accounts", json=ACCOUNT_PAYLOAD).json()["id"]
    return asset_id, account_id


def _txn_payload(asset_id, account_id, txn_type="buy", quantity="2.0"):
    return {
        "asset_id": asset_id,
        "account_id": account_id,
        "txn_type": txn_type,
        "quantity": quantity,
        "txn_date": "2026-03-22",
        "note": "test txn",
    }


# ── POST /api/v1/transactions ─────────────────────────────────────────────────

def test_create_buy_transaction(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id))
    assert r.status_code == 201
    data = r.json()
    assert data["txn_type"] == "buy"
    assert float(data["quantity"]) == 2.0


def test_create_all_txn_types(client):
    asset_id, account_id = _setup(client)
    for txn_type in ("buy", "sell", "transfer_in", "transfer_out"):
        r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type=txn_type))
        assert r.status_code == 201


def test_create_adjustment_positive(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type="adjustment", quantity="5.0"))
    assert r.status_code == 201


def test_create_adjustment_negative(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type="adjustment", quantity="-3.0"))
    assert r.status_code == 201
    assert float(r.json()["quantity"]) == -3.0


def test_create_buy_negative_quantity_rejected(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type="buy", quantity="-1.0"))
    assert r.status_code == 422


def test_create_sell_negative_quantity_rejected(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type="sell", quantity="-1.0"))
    assert r.status_code == 422


def test_create_transfer_in_negative_quantity_rejected(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type="transfer_in", quantity="-1.0"))
    assert r.status_code == 422


def test_create_invalid_txn_type(client):
    asset_id, account_id = _setup(client)
    r = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id, txn_type="deposit"))
    assert r.status_code == 422


def test_create_transaction_asset_not_found(client):
    _, account_id = _setup(client)
    payload = _txn_payload(str(uuid.uuid4()), account_id)
    r = client.post("/api/v1/transactions", json=payload)
    assert r.status_code == 404


def test_create_transaction_account_not_found(client):
    asset_id, _ = _setup(client)
    payload = _txn_payload(asset_id, str(uuid.uuid4()))
    r = client.post("/api/v1/transactions", json=payload)
    assert r.status_code == 404


# ── GET /api/v1/transactions ──────────────────────────────────────────────────

def test_list_transactions_empty(client):
    r = client.get("/api/v1/transactions")
    assert r.status_code == 200
    assert r.json() == []


def test_list_transactions_filter_by_asset(client):
    asset_id, account_id = _setup(client)
    client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id))
    r = client.get(f"/api/v1/transactions?asset_id={asset_id}")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_list_transactions_filter_by_date_range(client):
    asset_id, account_id = _setup(client)
    for date in ("2026-01-01", "2026-02-01", "2026-03-01"):
        payload = {**_txn_payload(asset_id, account_id), "txn_date": date}
        client.post("/api/v1/transactions", json=payload)
    r = client.get(f"/api/v1/transactions?from=2026-02-01&to=2026-02-28")
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── PATCH /api/v1/transactions/{id} ──────────────────────────────────────────

def test_patch_transaction_note(client):
    asset_id, account_id = _setup(client)
    txn_id = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id)).json()["id"]
    r = client.patch(f"/api/v1/transactions/{txn_id}", json={"note": "Updated note"})
    assert r.status_code == 200
    assert r.json()["note"] == "Updated note"


def test_patch_transaction_immutable_field_rejected(client):
    asset_id, account_id = _setup(client)
    txn_id = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id)).json()["id"]
    r = client.patch(f"/api/v1/transactions/{txn_id}", json={"quantity": "99"})
    assert r.status_code == 422


def test_patch_transaction_txn_type_rejected(client):
    asset_id, account_id = _setup(client)
    txn_id = client.post("/api/v1/transactions", json=_txn_payload(asset_id, account_id)).json()["id"]
    r = client.patch(f"/api/v1/transactions/{txn_id}", json={"txn_type": "sell"})
    assert r.status_code == 422


def test_patch_transaction_not_found(client):
    r = client.patch("/api/v1/transactions/00000000-0000-0000-0000-000000000000", json={"note": "x"})
    assert r.status_code == 404


# ── DELETE /api/v1/transactions/{id} ─────────────────────────────────────────

def test_delete_adjustment_transaction(client):
    asset_id, account_id = _setup(client)
    txn_id = client.post(
        "/api/v1/transactions",
        json=_txn_payload(asset_id, account_id, txn_type="adjustment"),
    ).json()["id"]
    r = client.delete(f"/api/v1/transactions/{txn_id}")
    assert r.status_code == 204


def test_delete_non_adjustment_transaction_rejected(client):
    asset_id, account_id = _setup(client)
    for txn_type in ("buy", "sell", "transfer_in", "transfer_out"):
        txn_id = client.post(
            "/api/v1/transactions",
            json=_txn_payload(asset_id, account_id, txn_type=txn_type),
        ).json()["id"]
        r = client.delete(f"/api/v1/transactions/{txn_id}")
        assert r.status_code == 422, f"Expected 422 for txn_type={txn_type}"


def test_delete_transaction_not_found(client):
    r = client.delete("/api/v1/transactions/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd api && pytest tests/test_transactions.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`api/schemas/transaction.py`:
```python
from __future__ import annotations
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator

VALID_TXN_TYPES = {"buy", "sell", "transfer_in", "transfer_out", "adjustment"}
POSITIVE_ONLY_TYPES = {"buy", "sell", "transfer_in", "transfer_out"}


class TransactionCreate(BaseModel):
    asset_id: uuid.UUID
    account_id: uuid.UUID
    txn_type: str
    quantity: Decimal
    txn_date: date
    note: Optional[str] = None

    @field_validator("txn_type")
    @classmethod
    def validate_txn_type(cls, v: str) -> str:
        if v not in VALID_TXN_TYPES:
            raise ValueError(f"txn_type must be one of {sorted(VALID_TXN_TYPES)}")
        return v

    @model_validator(mode="after")
    def validate_quantity_sign(self) -> TransactionCreate:
        if self.txn_type in POSITIVE_ONLY_TYPES and self.quantity <= 0:
            raise ValueError(
                f"quantity must be > 0 for txn_type='{self.txn_type}'"
            )
        return self


class TransactionPatch(BaseModel):
    note: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def reject_immutable_fields(cls, values: dict) -> dict:
        immutable = {"txn_type", "quantity", "txn_date", "asset_id", "account_id"}
        found = immutable & set(values.keys())
        if found:
            raise ValueError(
                f"Fields {sorted(found)} are immutable and cannot be patched"
            )
        return values


class TransactionOut(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    account_id: uuid.UUID
    txn_type: str
    quantity: Decimal
    txn_date: date
    note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

`api/routers/transactions.py`:
```python
import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.asset import Asset
from models.account import Account
from models.transaction import Transaction
from schemas.transaction import TransactionCreate, TransactionPatch, TransactionOut

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    asset_id: Optional[uuid.UUID] = Query(default=None),
    account_id: Optional[uuid.UUID] = Query(default=None),
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if asset_id:
        q = q.filter(Transaction.asset_id == asset_id)
    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)
    return q.order_by(Transaction.txn_date.desc()).all()


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    account = db.query(Account).filter(Account.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    txn = Transaction(id=uuid.uuid4(), **payload.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.patch("/{txn_id}", response_model=TransactionOut)
def patch_transaction(txn_id: uuid.UUID, payload: TransactionPatch, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(txn, field, value)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: uuid.UUID, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.txn_type != "adjustment":
        raise HTTPException(
            status_code=422,
            detail="Only 'adjustment' transactions can be deleted",
        )
    db.delete(txn)
    db.commit()
```

Update `api/main.py`:
```python
from fastapi import FastAPI
from routers import assets, accounts, holdings, transactions

app = FastAPI(title="AtomWorth API", version="1.0.0")

app.include_router(assets.router)
app.include_router(accounts.router)
app.include_router(holdings.router)
app.include_router(transactions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd api && pytest tests/test_transactions.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
`git add api/schemas/transaction.py api/routers/transactions.py api/main.py api/tests/test_transactions.py && git commit -m "feat: add Transactions API with type-based validation and delete restriction"`

---

## Task 8: Prices + FX Rates APIs

**Files:**
- Create: `api/schemas/price.py`
- Create: `api/schemas/fx_rate.py`
- Create: `api/routers/prices.py`
- Create: `api/routers/fx_rates.py`
- Modify: `api/main.py`
- Test: `api/tests/test_prices.py`
- Test: `api/tests/test_fx_rates.py`

### Validation Rules (Prices)
- `GET /prices?asset_id=&from=&to=` — filter by asset and date range
- `POST /prices/manual` — only allowed for `pricing_mode='manual'` assets; returns 422 otherwise
- Upsert on `(asset_id, price_date)` — if a manual price already exists for that date, update it

### Validation Rules (FX Rates)
- `GET /fx-rates?from=&to=&from_date=&to_date=` — filter by currency pair and date range
- `POST /fx-rates/manual` — upsert on `(from_currency, to_currency, rate_date)`

- [ ] **Step 1: Write the failing tests**

`api/tests/test_prices.py`:
```python
import uuid
import pytest

MANUAL_ASSET = {
    "name": "Gold",
    "asset_class": "asset",
    "category": "investment",
    "sub_kind": "precious_metal",
    "currency_code": "TWD",
    "pricing_mode": "manual",
}

MARKET_ASSET = {
    "name": "AAPL",
    "asset_class": "asset",
    "category": "investment",
    "sub_kind": "stock",
    "symbol": "AAPL",
    "currency_code": "USD",
    "pricing_mode": "market",
}


# ── POST /api/v1/prices/manual ────────────────────────────────────────────────

def test_create_manual_price(client):
    asset_id = client.post("/api/v1/assets", json=MANUAL_ASSET).json()["id"]
    r = client.post("/api/v1/prices/manual", json={
        "asset_id": asset_id,
        "price_date": "2026-03-22",
        "price": "7900000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["asset_id"] == asset_id
    assert float(data["price"]) == 7900000.0
    assert data["source"] == "manual"


def test_create_manual_price_for_market_asset_rejected(client):
    asset_id = client.post("/api/v1/assets", json=MARKET_ASSET).json()["id"]
    r = client.post("/api/v1/prices/manual", json={
        "asset_id": asset_id,
        "price_date": "2026-03-22",
        "price": "210.50",
    })
    assert r.status_code == 422


def test_create_manual_price_asset_not_found(client):
    r = client.post("/api/v1/prices/manual", json={
        "asset_id": str(uuid.uuid4()),
        "price_date": "2026-03-22",
        "price": "100.00",
    })
    assert r.status_code == 404


def test_manual_price_upsert(client):
    """POST same asset+date twice should update, not duplicate."""
    asset_id = client.post("/api/v1/assets", json=MANUAL_ASSET).json()["id"]
    client.post("/api/v1/prices/manual", json={"asset_id": asset_id, "price_date": "2026-03-22", "price": "7900000.00"})
    r = client.post("/api/v1/prices/manual", json={"asset_id": asset_id, "price_date": "2026-03-22", "price": "8100000.00"})
    assert r.status_code == 201
    assert float(r.json()["price"]) == 8100000.0

    prices_r = client.get(f"/api/v1/prices?asset_id={asset_id}")
    assert len(prices_r.json()) == 1  # still one row


# ── GET /api/v1/prices ────────────────────────────────────────────────────────

def test_list_prices_empty(client):
    r = client.get("/api/v1/prices")
    assert r.status_code == 200
    assert r.json() == []


def test_list_prices_filter_by_asset(client):
    asset_id = client.post("/api/v1/assets", json=MANUAL_ASSET).json()["id"]
    client.post("/api/v1/prices/manual", json={"asset_id": asset_id, "price_date": "2026-03-22", "price": "7900000.00"})
    r = client.get(f"/api/v1/prices?asset_id={asset_id}")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_list_prices_filter_by_date_range(client):
    asset_id = client.post("/api/v1/assets", json=MANUAL_ASSET).json()["id"]
    for price_date, price in [("2026-01-01", "7000000"), ("2026-02-01", "7500000"), ("2026-03-01", "8000000")]:
        client.post("/api/v1/prices/manual", json={"asset_id": asset_id, "price_date": price_date, "price": price})
    r = client.get(f"/api/v1/prices?asset_id={asset_id}&from=2026-02-01&to=2026-02-28")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["price_date"] == "2026-02-01"
```

`api/tests/test_fx_rates.py`:
```python
import pytest


# ── POST /api/v1/fx-rates/manual ─────────────────────────────────────────────

def test_create_manual_fx_rate(client):
    r = client.post("/api/v1/fx-rates/manual", json={
        "from_currency": "USD",
        "to_currency": "TWD",
        "rate_date": "2026-03-22",
        "rate": "32.67",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["from_currency"] == "USD"
    assert data["to_currency"] == "TWD"
    assert float(data["rate"]) == 32.67
    assert data["source"] == "manual"


def test_create_fx_rate_upsert(client):
    """POST same pair+date twice should update the rate."""
    payload = {"from_currency": "USD", "to_currency": "TWD", "rate_date": "2026-03-22", "rate": "32.67"}
    client.post("/api/v1/fx-rates/manual", json=payload)
    r = client.post("/api/v1/fx-rates/manual", json={**payload, "rate": "33.00"})
    assert r.status_code == 201
    assert float(r.json()["rate"]) == 33.00

    all_r = client.get("/api/v1/fx-rates?from=USD&to=TWD")
    assert len(all_r.json()) == 1


def test_create_fx_rate_invalid_rate(client):
    r = client.post("/api/v1/fx-rates/manual", json={
        "from_currency": "USD",
        "to_currency": "TWD",
        "rate_date": "2026-03-22",
        "rate": "0",
    })
    assert r.status_code == 422


# ── GET /api/v1/fx-rates ─────────────────────────────────────────────────────

def test_list_fx_rates_empty(client):
    r = client.get("/api/v1/fx-rates")
    assert r.status_code == 200
    assert r.json() == []


def test_list_fx_rates_filter_by_currencies(client):
    client.post("/api/v1/fx-rates/manual", json={"from_currency": "USD", "to_currency": "TWD", "rate_date": "2026-03-22", "rate": "32.67"})
    client.post("/api/v1/fx-rates/manual", json={"from_currency": "JPY", "to_currency": "TWD", "rate_date": "2026-03-22", "rate": "0.22"})
    r = client.get("/api/v1/fx-rates?from=USD&to=TWD")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["from_currency"] == "USD"


def test_list_fx_rates_filter_by_date_range(client):
    for rate_date, rate in [("2026-01-01", "31.5"), ("2026-02-01", "32.0"), ("2026-03-01", "32.67")]:
        client.post("/api/v1/fx-rates/manual", json={
            "from_currency": "USD", "to_currency": "TWD",
            "rate_date": rate_date, "rate": rate,
        })
    r = client.get("/api/v1/fx-rates?from_date=2026-02-01&to_date=2026-02-28")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["rate_date"] == "2026-02-01"
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd api && pytest tests/test_prices.py tests/test_fx_rates.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`api/schemas/price.py`:
```python
from __future__ import annotations
import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


class PriceManualCreate(BaseModel):
    asset_id: uuid.UUID
    price_date: date
    price: Decimal

    @field_validator("price")
    @classmethod
    def must_be_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("price must be >= 0")
        return v


class PriceOut(BaseModel):
    asset_id: uuid.UUID
    price_date: date
    price: Decimal
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

`api/schemas/fx_rate.py`:
```python
from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


class FxRateManualCreate(BaseModel):
    from_currency: str
    to_currency: str
    rate_date: date
    rate: Decimal

    @field_validator("rate")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("rate must be > 0")
        return v


class FxRateOut(BaseModel):
    from_currency: str
    to_currency: str
    rate_date: date
    rate: Decimal
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

`api/routers/prices.py`:
```python
import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import get_db
from models.asset import Asset
from models.price import Price
from schemas.price import PriceManualCreate, PriceOut

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])


@router.get("", response_model=List[PriceOut])
def list_prices(
    asset_id: Optional[uuid.UUID] = Query(default=None),
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
):
    q = db.query(Price)
    if asset_id:
        q = q.filter(Price.asset_id == asset_id)
    if from_date:
        q = q.filter(Price.price_date >= from_date)
    if to_date:
        q = q.filter(Price.price_date <= to_date)
    return q.order_by(Price.price_date.desc()).all()


@router.post("/manual", response_model=PriceOut, status_code=201)
def create_manual_price(payload: PriceManualCreate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.pricing_mode != "manual":
        raise HTTPException(
            status_code=422,
            detail=f"Asset pricing_mode is '{asset.pricing_mode}'; POST /prices/manual only accepts pricing_mode='manual' assets",
        )

    stmt = (
        pg_insert(Price)
        .values(
            asset_id=payload.asset_id,
            price_date=payload.price_date,
            price=payload.price,
            source="manual",
        )
        .on_conflict_do_update(
            index_elements=["asset_id", "price_date"],
            set_={"price": payload.price, "source": "manual", "updated_at": db.execute("SELECT NOW()").scalar()},
        )
        .returning(Price)
    )
    # Use ORM-style upsert compatible with SQLAlchemy 2.x
    existing = db.query(Price).filter(
        Price.asset_id == payload.asset_id,
        Price.price_date == payload.price_date,
    ).first()

    if existing:
        existing.price = payload.price
        existing.source = "manual"
        db.commit()
        db.refresh(existing)
        return existing

    new_price = Price(
        asset_id=payload.asset_id,
        price_date=payload.price_date,
        price=payload.price,
        source="manual",
    )
    db.add(new_price)
    db.commit()
    db.refresh(new_price)
    return new_price
```

`api/routers/fx_rates.py`:
```python
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.fx_rate import FxRate
from schemas.fx_rate import FxRateManualCreate, FxRateOut

router = APIRouter(prefix="/api/v1/fx-rates", tags=["fx_rates"])


@router.get("", response_model=List[FxRateOut])
def list_fx_rates(
    from_currency: Optional[str] = Query(default=None, alias="from"),
    to_currency: Optional[str] = Query(default=None, alias="to"),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(FxRate)
    if from_currency:
        q = q.filter(FxRate.from_currency == from_currency)
    if to_currency:
        q = q.filter(FxRate.to_currency == to_currency)
    if from_date:
        q = q.filter(FxRate.rate_date >= from_date)
    if to_date:
        q = q.filter(FxRate.rate_date <= to_date)
    return q.order_by(FxRate.rate_date.desc()).all()


@router.post("/manual", response_model=FxRateOut, status_code=201)
def create_manual_fx_rate(payload: FxRateManualCreate, db: Session = Depends(get_db)):
    existing = db.query(FxRate).filter(
        FxRate.from_currency == payload.from_currency,
        FxRate.to_currency == payload.to_currency,
        FxRate.rate_date == payload.rate_date,
    ).first()

    if existing:
        existing.rate = payload.rate
        existing.source = "manual"
        db.commit()
        db.refresh(existing)
        return existing

    fx = FxRate(
        from_currency=payload.from_currency,
        to_currency=payload.to_currency,
        rate_date=payload.rate_date,
        rate=payload.rate,
        source="manual",
    )
    db.add(fx)
    db.commit()
    db.refresh(fx)
    return fx
```

Update `api/main.py` (final version):
```python
from fastapi import FastAPI
from routers import assets, accounts, holdings, transactions, prices, fx_rates

app = FastAPI(title="AtomWorth API", version="1.0.0")

app.include_router(assets.router)
app.include_router(accounts.router)
app.include_router(holdings.router)
app.include_router(transactions.router)
app.include_router(prices.router)
app.include_router(fx_rates.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd api && pytest tests/test_prices.py tests/test_fx_rates.py -v`
Expected: PASS

Run the full test suite to confirm nothing regressed:
```
cd api && pytest tests/ -v --tb=short
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**
`git add api/schemas/price.py api/schemas/fx_rate.py api/routers/prices.py api/routers/fx_rates.py api/main.py api/tests/test_prices.py api/tests/test_fx_rates.py && git commit -m "feat: add Prices and FX Rates APIs with manual upsert and pricing_mode guard"`

---

## Final Verification

After all 8 tasks are complete, run the full suite:

```bash
cd api && pytest tests/ -v --tb=short --cov=. --cov-report=term-missing
```

Then start Docker Compose to confirm the full stack boots:

```bash
docker compose up --build
curl http://localhost:8000/health
# Expected: {"status": "ok"}
curl http://localhost:8000/api/v1/assets
# Expected: []
```

---

## What Comes Next

- **Plan Part 2 — Services + Dashboard:** daily_snapshot_job, APScheduler lifespan integration, snapshot rebuild endpoints, and all three Dashboard API endpoints (`/dashboard/summary`, `/dashboard/allocation`, `/dashboard/net-worth-history`).
- **Plan Part 3 — Frontend:** Next.js App Router scaffolding, all 7 pages, SWR data fetching, Recharts integration, light/dark mode via CSS variables.
