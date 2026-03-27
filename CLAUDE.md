# 不動產風險評估系統 — Claude Code 開發規劃

## 專案概述

台灣不動產風險評估系統，提供實價登錄查詢、法拍資訊搜尋、謄本風險分析三大核心功能。
以純 HTML + CSS + Vanilla JS 開發，單一 `index.html` 檔案交付，不依賴任何建構工具。

---

## 技術規格

- **框架**：無框架，純 HTML5 + CSS3 + ES6+ JavaScript
- **API**：Anthropic Messages API (`https://api.anthropic.com/v1/messages`)
- **模型**：`claude-sonnet-4-20250514`
- **檔案格式**：單一 `index.html`（所有 CSS / JS 內嵌）
- **瀏覽器支援**：Chrome 90+、Safari 15+、Firefox 90+、Edge 90+
- **語言**：繁體中文介面

---

## 系統架構

```
┌─────────────────────────────────────────────────┐
│                  使用者介面 (HTML)                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ 功能一     │  │ 功能二     │  │ 查詢紀錄   │   │
│  │ 地址查詢   │  │ 謄本分析   │  │ 歷史列表   │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘   │
│        │              │              │           │
│  ┌─────▼──────────────▼──────────────▼─────┐    │
│  │          JavaScript 控制層               │    │
│  │  - API 呼叫管理                          │    │
│  │  - PDF Base64 轉換                       │    │
│  │  - 地址自動提取                          │    │
│  │  - 風險標籤解析                          │    │
│  │  - 查詢紀錄管理 (localStorage)           │    │
│  └─────────────────┬───────────────────────┘    │
│                    │                             │
└────────────────────┼─────────────────────────────┘
                     │ fetch API
     ┌───────────────▼───────────────┐
     │   Anthropic Messages API      │
     │   + Web Search Tool           │
     │   + PDF Document Input        │
     └───────────────┬───────────────┘
                     │
     ┌───────────────▼───────────────┐
     │   資料來源                     │
     │  - 內政部實價登錄              │
     │  - 司法院法拍公告              │
     │  - 591 / 房仲網站             │
     └───────────────────────────────┘
```

---

## 功能規格

### 功能一：地址查詢

**輸入**：不動產完整地址（例：台北市大安區忠孝東路四段100號）

**處理流程**：
1. 使用者輸入地址，點擊「開始查詢」或按 Enter
2. 同時發起兩組 API 呼叫（並行）：
   - **實價登錄查詢**：搜尋內政部實價登錄、591、永慶、信義等網站
   - **法拍資訊查詢**：搜尋司法院法拍公告、透明房訊等網站
3. 顯示即時進度狀態（○ 等待 → ◌ 搜尋中 → ● 完成）
4. 結果呈現於各自區塊

**輸出欄位**：
- 實價登錄：交易日期、地址、建物型態、總價(萬)、單價(萬/坪)、坪數、樓層
- 法拍資訊：法院、案號、拍次、拍賣日期、底價(萬)、坪數、備註

**API 呼叫規格**：
```javascript
// 實價登錄
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  system: "你是台灣不動產實價登錄查詢助手...",
  messages: [{ role: "user", content: "請查詢此地址附近的實價登錄資料：{address}" }],
  tools: [{ type: "web_search_20250305", name: "web_search" }]
}

// 法拍資訊
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  system: "你是台灣法拍屋查詢助手...",
  messages: [{ role: "user", content: "請查詢此地址附近的法拍屋資料：{address}" }],
  tools: [{ type: "web_search_20250305", name: "web_search" }]
}
```

### 功能二：謄本分析

**輸入**：
- PDF 檔案上傳（主要）
- TXT 檔案上傳（備選）
- 直接貼上文字（備選）
- 地址欄位（選填，留空則自動從謄本提取）

**處理流程**：
1. 使用者上傳 PDF / TXT 或貼上謄本內容
2. 四階段管線依序執行：
   - **階段一**：AI 解析謄本內容（PDF 使用 document type，文字使用 text type）
   - **階段二**：從謄本中自動提取建物完整地址
   - **階段三**：用提取的地址搜尋實價登錄（自動觸發功能一）
   - **階段四**：用提取的地址搜尋法拍資訊（自動觸發功能一）
3. 階段三、四與功能一共用同一套搜尋邏輯，並行執行
4. 顯示風險標籤、分析報告、實價登錄、法拍資訊

**PDF 處理**：
```javascript
// 將 PDF 轉為 base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("讀取失敗"));
    reader.readAsDataURL(file);
  });
}

// API 呼叫含 PDF
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  system: "你是台灣不動產謄本風險分析專家...",
  messages: [{
    role: "user",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      { type: "text", text: "請分析這份謄本..." }
    ]
  }]
}
```

**地址自動提取**：
- AI 系統提示中要求回傳 `ADDRESS:完整地址` 格式
- 前端用正則 `/ADDRESS[:：]\s*(.+)/` 擷取
- 若使用者有手動填寫地址，優先使用手動地址

**風險標籤系統**：

| 標籤 ID | 顯示名稱 | 嚴重等級 | 說明 |
|---------|---------|---------|------|
| `mortgage` | 抵押權 | 高 (紅) | 有設定抵押權，需注意債務金額與債權人 |
| `seizure` | 查封/假扣押 | 高 (紅) | 該不動產可能有法律糾紛或強制執行 |
| `restriction` | 限制登記 | 高 (紅) | 有限制登記事項，交易前需確認是否已塗銷 |
| `lease` | 租賃權 | 中 (橙) | 有租賃登記，買受後可能需承受租約 |
| `trust` | 信託 | 中 (橙) | 信託財產處分需經受託人同意 |
| `easement` | 地上權/地役權 | 中 (橙) | 有他項權利設定，可能影響使用權 |
| `lis_pendens` | 預告登記 | 中 (橙) | 有預告登記，處分需經預告登記人同意 |
| `multiple_owners` | 多人持分 | 低 (綠) | 共有人較多，處分需多數決或全體同意 |
| `land_use` | 使用分區 | 低 (綠) | 注意土地使用分區限制 |
| `age` | 屋齡偏高 | 低 (綠) | 建物屋齡較高，需注意結構安全與維修成本 |

AI 回傳格式：最後一行 `RISKS:[mortgage,seizure,...]`
前端解析：`/RISKS:\[(.*?)\]/` → split(",") → 渲染標籤

### 功能三：查詢紀錄

- 所有功能一、功能二的結果自動存入 `localStorage`
- 列表顯示：地址、日期、地區、查詢類型、風險數量
- 點擊展開詳細結果
- 「儲存至 Google 試算表」按鈕：呼叫 `sendPrompt()` 將紀錄交由 Claude 處理

---

## 檔案結構

```
project/
├── CLAUDE.md          ← 本文件（開發規劃）
├── index.html         ← 主應用程式（唯一交付檔案）
├── test-data/         ← 測試用資料
│   ├── sample-transcript.txt    ← 範例謄本文字
│   └── sample-transcript.pdf    ← 範例謄本 PDF
└── docs/
    └── api-reference.md         ← API 呼叫參考
```

---

## 開發階段

### Phase 1：基礎骨架與樣式（預計 1 小時）

**目標**：完成 HTML 結構、CSS 樣式、Tab 切換

**任務清單**：
- [ ] 建立 `index.html` 骨架，含 `<style>` 和 `<script>`
- [ ] 實作 Header（圖標 + 標題 + 副標題）
- [ ] 實作 Tab 導航列（地址查詢 / 謄本分析 / 查詢紀錄）
- [ ] Tab 切換邏輯（顯示/隱藏對應面板）
- [ ] 功能一面板：地址輸入框 + 查詢按鈕 + 結果區塊
- [ ] 功能二面板：地址輸入框 + 檔案上傳區 + 文字輸入區 + 結果區塊
- [ ] 查詢紀錄面板：列表容器 + 空狀態提示
- [ ] 頁尾資料來源說明

**樣式規範**：
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f7f7f5;
  --text-primary: #1a1a1a;
  --text-secondary: #6b6b6b;
  --text-tertiary: #9b9b9b;
  --border-light: rgba(0,0,0,0.08);
  --border-medium: rgba(0,0,0,0.15);
  --accent-blue: #2563eb;
  --accent-blue-bg: #eff6ff;
  --danger-red: #dc2626;
  --danger-bg: #fef2f2;
  --warning-amber: #d97706;
  --warning-bg: #fffbeb;
  --success-green: #16a34a;
  --success-bg: #f0fdf4;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1e1e1e;
    --bg-secondary: #2a2a2a;
    --text-primary: #e5e5e5;
    --text-secondary: #a3a3a3;
    --text-tertiary: #737373;
    --border-light: rgba(255,255,255,0.08);
    --border-medium: rgba(255,255,255,0.15);
  }
}
```

**驗收標準**：
- 三個 Tab 可正確切換
- 所有輸入元素可正常互動
- 支援亮色/暗色模式
- 手機/桌面響應式佈局（max-width: 720px）

---

### Phase 2：API 整合 — 功能一（預計 1.5 小時）

**目標**：完成地址查詢的實價登錄 + 法拍搜尋

**任務清單**：
- [ ] 實作 `callClaude(system, userMessage)` 通用函式
- [ ] 實作 `searchRealPrice(address)` — 實價登錄查詢
- [ ] 實作 `searchAuction(address)` — 法拍資訊查詢
- [ ] 實作進度狀態組件（StatusStep: pending → loading → done → error）
- [ ] 實作結果渲染組件（ResultSection: loading spinner / 內容卡片）
- [ ] 並行呼叫兩組 API（Promise.all）
- [ ] Enter 鍵觸發查詢
- [ ] 按鈕 disabled 狀態管理
- [ ] 錯誤處理與提示

**API 通用函式**：
```javascript
async function callClaude(systemPrompt, userContent) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      tools: [{ type: "web_search_20250305", name: "web_search" }]
    })
  });
  const data = await res.json();
  return data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");
}
```

**驗收標準**：
- 輸入地址後可取得實價登錄結果
- 輸入地址後可取得法拍資訊結果
- 兩組查詢並行執行，進度狀態即時更新
- 網路錯誤有友善提示

---

### Phase 3：API 整合 — 功能二（預計 2 小時）

**目標**：完成謄本分析（含 PDF 上傳）+ 自動提取地址 + 觸發功能一

**任務清單**：
- [ ] 實作 `fileToBase64(file)` — 檔案轉 Base64
- [ ] 實作 PDF 上傳處理（偵測檔案類型，PDF → base64，TXT → readAsText）
- [ ] 實作拖放式上傳區域（drag & drop UI）
- [ ] 實作 `callClaudeWithPDF(system, pdfBase64, textPrompt)` — PDF 分析
- [ ] 實作 `analyzeTranscript()` 主流程：
  1. 判斷輸入來源（PDF / TXT / 貼上）
  2. 呼叫 AI 分析謄本
  3. 解析 `ADDRESS:` 行取得地址
  4. 解析 `RISKS:[]` 行取得風險標籤
  5. 用提取的地址自動觸發 `searchRealPrice()` + `searchAuction()`
- [ ] 實作四階段進度管線
- [ ] 實作風險標籤渲染（RiskBadge + RiskCard）
- [ ] 已上傳檔案顯示（檔名、大小、類型標籤、移除按鈕）
- [ ] 地址手動輸入 vs 自動提取優先級處理

**PDF 分析 API 呼叫**：
```javascript
async function callClaudeWithPDF(systemPrompt, pdfBase64, textPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64
            }
          },
          { type: "text", text: textPrompt }
        ]
      }]
    })
  });
  const data = await res.json();
  return data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");
}
```

**謄本分析 System Prompt**：
```
你是台灣不動產謄本風險分析專家。請完整分析謄本，包含：
1. 基本資訊摘要：所有權人、完整地址、面積、建物型態、屋齡、樓層
2. 他項權利分析：抵押權(金額、債權人、設定日期)、地上權、地役權等
3. 限制登記分析：查封、假扣押、假處分、預告登記等
4. 其他注意事項：信託、租賃、共有狀態、使用分區

【非常重要】從謄本中找出建物的完整地址（含縣市、區、路段、門牌號），
回答第一行格式：ADDRESS:完整地址

最後一行格式：RISKS:[tag1,tag2,...]
可用標籤：mortgage, seizure, restriction, lease, trust, easement,
          lis_pendens, multiple_owners, land_use, age
無風險寫：RISKS:[]
```

**驗收標準**：
- 可上傳 PDF 並正確解析
- 可上傳 TXT 或貼上文字
- AI 能從謄本中提取建物地址
- 提取的地址自動觸發實價登錄 + 法拍查詢
- 風險標籤正確辨識並渲染
- 四階段進度即時更新

---

### Phase 4：查詢紀錄與資料持久化（預計 1 小時）

**目標**：完成查詢紀錄列表、localStorage 持久化、匯出功能

**任務清單**：
- [ ] 定義紀錄資料結構
- [ ] 每次查詢完成自動存入 localStorage
- [ ] 紀錄列表渲染（地址、日期、類型標籤、風險數）
- [ ] 點擊展開/收合詳細內容
- [ ] Tab 上顯示紀錄數量 badge
- [ ] 「儲存至 Google 試算表」按鈕
- [ ] 清除紀錄功能
- [ ] 頁面重新載入後紀錄保留

**紀錄資料結構**：
```javascript
{
  id: "uuid",
  type: "address" | "transcript",
  address: "台北市大安區...",
  district: "台北市大安區",
  date: "2026/3/27",
  timestamp: 1711526400000,
  realPrice: "查詢結果文字...",
  auction: "查詢結果文字...",
  transcript: "分析報告文字...",     // 僅功能二
  risks: ["mortgage", "seizure"],  // 僅功能二
}
```

**localStorage 操作**：
```javascript
const STORAGE_KEY = "realestate_risk_history";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function addRecord(record) {
  const history = loadHistory();
  history.unshift({ ...record, id: crypto.randomUUID(), timestamp: Date.now() });
  saveHistory(history);
  renderHistory();
}
```

**Google 試算表匯出**：
```javascript
function exportToSheet() {
  const history = loadHistory();
  // 使用 sendPrompt 將資料交由 Claude 處理
  // Claude 會透過 Google Sheets MCP 建立/更新試算表
  window.sendPrompt?.(
    `請將以下不動產風險評估紀錄整理後，依地區和時間分類，
     儲存到我的 Google 試算表。欄位：查詢日期、類型、地址、地區、
     實價登錄、法拍資訊、謄本分析、風險標籤。
     紀錄：${JSON.stringify(history)}`
  );
}
```

**驗收標準**：
- 紀錄自動保存並在重新載入後仍在
- 列表可展開/收合
- 匯出按鈕正確呼叫 sendPrompt
- 空狀態有友善提示

---

### Phase 5：UI 打磨與最終測試（預計 1 小時）

**目標**：細節優化、動畫、無障礙、最終測試

**任務清單**：
- [ ] Loading spinner 動畫（CSS @keyframes）
- [ ] 進度指示器脈衝動畫
- [ ] Tab 切換過渡效果
- [ ] 按鈕 hover / active 回饋
- [ ] 上傳區域 hover 邊框變色
- [ ] 結果區塊淡入動畫
- [ ] 輸入框 focus 樣式
- [ ] 表單驗證提示（空地址、空謄本）
- [ ] 手機版響應式測試（360px ~ 720px）
- [ ] 暗色模式全面測試
- [ ] 鍵盤操作（Tab 鍵導航、Enter 送出）
- [ ] 最終整合測試：功能一 → 功能二 → 紀錄 → 匯出

**動畫規範**：
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.spin { animation: spin 0.8s linear infinite; }
.pulse { animation: pulse 1.2s ease-in-out infinite; }
.fade-in { animation: fadeIn 0.3s ease-out; }
```

---

## 關鍵實作注意事項

### API 呼叫
- Anthropic API 不需要在前端傳 API Key（由平台處理）
- `max_tokens` 固定設為 1000
- 所有搜尋類呼叫都要帶 `tools: [{ type: "web_search_20250305", name: "web_search" }]`
- PDF 文件使用 `type: "document"` + `source.type: "base64"`
- 回應解析：`data.content.filter(b => b.type === "text").map(b => b.text).join("\n")`

### 地址提取邏輯
```javascript
// 優先級：手動輸入 > AI 自動提取
const useAddr = manualAddress.trim() || extractedAddress;

// 提取正則
const addrMatch = result.match(/ADDRESS[:：]\s*(.+)/);
const foundAddr = addrMatch ? addrMatch[1].trim() : "";

// 地區提取（用於分類）
const district = addr.match(/([\u4e00-\u9fff]{2,3}[市縣][\u4e00-\u9fff]{2,3}[區鄉鎮市])/)?.[1] || "未知區域";
```

### 風險解析邏輯
```javascript
const riskMatch = result.match(/RISKS:\[(.*?)\]/);
const risks = riskMatch
  ? riskMatch[1].split(",").map(s => s.trim()).filter(Boolean)
  : [];
// 清除標記行
const cleanResult = result
  .replace(/ADDRESS[:：]\s*.+\n?/, "")
  .replace(/RISKS:\[.*?\]/, "")
  .trim();
```

### 錯誤處理
- 所有 API 呼叫包在 try-catch 中
- 網路失敗顯示友善錯誤訊息（非技術語言）
- PDF 讀取失敗有明確提示
- API 回傳非預期格式時有 fallback

---

## 測試清單

### 功能一測試
- [ ] 輸入「台北市大安區忠孝東路四段」→ 取得實價登錄結果
- [ ] 輸入「高雄市前鎮區中華五路」→ 取得法拍資訊結果
- [ ] 空地址點擊查詢 → 按鈕 disabled，不發送請求
- [ ] 查詢中再次點擊 → 無重複請求
- [ ] 網路斷線 → 顯示錯誤訊息

### 功能二測試
- [ ] 上傳 PDF 謄本 → 正確解析並顯示分析報告
- [ ] 上傳 TXT 謄本 → 正確讀取並分析
- [ ] 貼上謄本文字 → 正確分析
- [ ] 未填地址 → AI 自動提取地址並觸發功能一
- [ ] 手動填地址 → 使用手動地址觸發功能一
- [ ] 風險標籤正確渲染（紅/橙/綠三級）
- [ ] 移除已上傳檔案 → 清除狀態

### 查詢紀錄測試
- [ ] 功能一完成後自動新增紀錄
- [ ] 功能二完成後自動新增紀錄（含風險標籤）
- [ ] 紀錄可展開查看詳細
- [ ] 重新載入頁面紀錄仍在
- [ ] 匯出按鈕正確觸發 sendPrompt

### 跨平台測試
- [ ] Chrome 桌面版
- [ ] Safari 桌面版
- [ ] 手機版（360px 寬度）
- [ ] 暗色模式

---

## 參考資源

| 資源 | 網址 |
|------|------|
| 內政部實價登錄查詢 | https://lvr.land.moi.gov.tw/ |
| 591 實價登錄 | https://market.591.com.tw/ |
| 司法院法拍公告 | https://aomp109.judicial.gov.tw/judbp/wkw/WHD1A02.htm |
| 透明房訊法拍 | https://www.sqlaw.com.tw/ |
| Anthropic API 文件 | https://docs.anthropic.com/en/api/messages |
| 政府資料開放平台 | https://data.gov.tw/ |
