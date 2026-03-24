# Atom Fortune

**隱私優先的個人淨值追蹤工具。**
所有資料存放在你自己的 PostgreSQL，完全自架，不依賴任何雲端帳號或訂閱服務。

---

## 這是什麼？

Atom Fortune 讓你在一個介面上追蹤所有資產與負債：

- 銀行存款、現金、電子錢包
- 股票、ETF、加密貨幣（自動抓取市價）
- 房地產、車輛、貴金屬（手動輸入估值）
- 房貸、信用卡等負債

每天自動抓取市價與匯率，計算你的即時淨值，並記錄長期趨勢。

---

## 功能

- **儀表板** — 淨值總覽、資產結構圖、30 天 / 1 年 / 全期趨勢、財務自由進度估算
- **持倉管理** — 依帳戶分組，快速新增、編輯、刪除持倉
- **自動記** — 設定固定收入/支出（薪水、房租等），自動追蹤每月現金流
- **資產管理** — 管理資產清單，查看各資產的持倉分佈與歷史趨勢
- **帳戶管理** — 管理銀行、券商、錢包等帳戶
- **多幣顯示** — 基準幣 TWD，可切換 USD / JPY 等顯示
- **備份/還原** — 一鍵匯出全部資料為 JSON，隨時還原
- **深色模式**

---

## 安裝（Docker Compose）

**需要：** Docker + Docker Compose

所有外部資料來源均免費且無需 API 金鑰。

```bash
# 1. 下載專案
git clone https://github.com/Xavier9031/AtomFortune.git
cd AtomFortune

# 2. 啟動
docker compose up -d

# 3. 執行資料庫遷移（首次啟動）
docker compose exec api npm run db:migrate
```

啟動後開啟瀏覽器前往 **http://localhost:3000**

---

## 技術堆疊

| 層  | 技術 |
|-----|------|
| 後端 | [Hono](https://hono.dev/) + TypeScript |
| 資料庫 | PostgreSQL 16 + [Drizzle ORM](https://orm.drizzle.team/) |
| 前端 | Next.js 16 + Tailwind CSS v4 + Recharts |
| 市價 | yahoo-finance2（股票/ETF/加密貨幣）、open.er-api（匯率） |

---

## 進階文件

- [技術參考（API 端點、環境變數、快照機制）](docs/technical-reference.md)
