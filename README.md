# 台灣求職 Skill：讓 ai-job-search 搜得到台灣的工作

[ai-job-search](https://github.com/MadsLorentzen/ai-job-search) 是一套拿 Claude Code 來找工作的開源工具：讀你的履歷、搜職缺、判斷你適不適合、幫你客製履歷和求職信。但它內建的職缺網站是丹麥的，台灣用不了。

這個 repo 補上台灣的部分：

| 職缺網站 | 狀態 | 怎麼用 |
|---|---|---|
| **Yourator** | ✅ 這個 repo 的 `yourator-search` skill | 照下面的步驟裝 |
| **LinkedIn** | ✅ ai-job-search 內建 | 地點寫 `Taipei City, Taiwan` |
| **104 人力銀行** | ⚠️ 不能自動搜 | 自己逛 104，把職缺內容貼給 AI（見下面） |
| **Cake** | ❌ 擋程式存取 | 同 104，手動貼 |

> 2026-10-19 實測。網站改版後可能會失效，遇到問題請開 issue。

---

## 你需要先有

- **Claude Code**（要付費：Claude Pro／Max，或 API 額度）
- **Git**
- **Bun**（ai-job-search 的職缺搜尋工具用它跑）：https://bun.sh
  - Windows 上 Bun 被擋的話，裝 **Node.js 22 以上** 改用 `npx tsx`（見「常見問題」）
- **Python 3.10 以上**
- 要輸出 PDF 履歷的話，還要 LaTeX（Windows 裝 MiKTeX）。詳見 ai-job-search 的 [SETUP.md](https://github.com/MadsLorentzen/ai-job-search/blob/main/SETUP.md)

---

## 安裝

### 1. 下載 ai-job-search

```bash
git clone https://github.com/MadsLorentzen/ai-job-search.git
```

> ⚠️ **個資提醒**：`/setup` 會把你的姓名、經歷、期望薪資寫進這個資料夾。**不要 fork 成公開 repo、不要 push 到公開的地方。** 要備份就推到你自己的 private repo。

### 2. 下載這個 repo，把 Yourator skill 複製進去

**Windows（PowerShell）**

```powershell
git clone https://github.com/dustynotesai/taiwan-job-search-skills.git
Copy-Item -Recurse taiwan-job-search-skills\yourator-search ai-job-search\.agents\skills\
```

**macOS／Linux**

```bash
git clone https://github.com/dustynotesai/taiwan-job-search-skills.git
cp -R taiwan-job-search-skills/yourator-search ai-job-search/.agents/skills/
```

### 3. 加一行權限

讓 `/scrape` 呼叫 Yourator 時不用每次都問你。打開 `ai-job-search/.claude/settings.json`，在 `"allow"` 清單裡、`linkedin-search` 那行下面加：

```json
"Bash(bun run .agents/skills/yourator-search/cli/src/cli.ts:*)",
```

`ai-job-search/tools/security_guards.py` 的 `ALLOWED_PERMISSIONS` 也加同一行（不加的話它的測試會報錯）：

```python
"Bash(bun run .agents/skills/yourator-search/cli/src/cli.ts:*)",
```

### 4. 試搜一次

在 `ai-job-search` 資料夾裡：

```bash
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "後端工程師" -l 台北 --format table
```

看到一張職缺表（職稱、公司、地點、更新時間、薪資）就裝好了。

---

## 開始找工作

在 `ai-job-search` 資料夾裡開 Claude Code：

```bash
cd ai-job-search
claude
```

### 第一步：建立你的檔案

```
/setup
```

選一種方式：把履歷 PDF 放進 `documents/cv/` 讓它讀、直接貼履歷，或讓它一題一題問你。

### 第二步：搜職缺

直接用中文講就可以：

```
幫我在 Yourator 和 LinkedIn 找台北的資深後端工程師職缺
```

或用 ai-job-search 的搜尋指令（會一起搜所有裝好的網站，包含 Yourator 和 LinkedIn）：

```
/scrape
```

### 第三步：針對一個職缺寫履歷和求職信

```
/apply <職缺網址>
```

LinkedIn 的網址可以直接丟。**Yourator 和 104 建議直接貼職缺全文**（原因見下面）：

```
/apply 〔把整個職缺內容貼在這裡〕
```

它會：評估你適不適合 → 寫客製化履歷和求職信 → 另開一個 AI 審稿挑毛病 → 改稿 → 編成 PDF。

> **寄出去之前，自己逐句對一次。** 檢查有沒有你沒做過的事、沒拿過的數字。作者說它不會亂編，但這是它自己說的。

---

## 各網站的細節

### Yourator

```bash
# 台北的 backend 職缺
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "backend" -l Taipei --format table

# 台北或新北、兩週內有更新、新的排前面
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "後端工程師" -l "台北,新北" --jobage 14 --sort recent --format table

# 看單一職缺（網址從搜尋結果複製）
bun run .agents/skills/yourator-search/cli/src/cli.ts detail https://www.yourator.co/companies/Pinkoi/jobs/48495 --format plain
```

- 城市：`TPE` 臺北市、`NWT` 新北市、`TAO` 桃園市、`HSZ` 新竹市、`HSQ` 新竹縣、`TXG` 臺中市、`TNN` 臺南市、`KHH` 高雄市、`CYI` 嘉義市。寫中文（`台北`）、英文（`Taipei`）都可以。
- **限制：Yourator 只給職缺內容的前 200 字。** 完整內容在職缺頁上，但職缺頁擋程式存取。所以：
  1. 搜尋結果有 `applyUrl`（公司自己的徵才頁）的話，把那個網址丟給 `/apply`。
  2. 沒有的話，用瀏覽器打開職缺頁，把內容整段複製，貼給 `/apply`。
- Yourator 沒有「刊登日期」，只有「一天內／一週內／兩週內／一個月內更新」，`--jobage` 是照這個篩的。

完整參數：`bun run .agents/skills/yourator-search/cli/src/cli.ts --help`

### LinkedIn（ai-job-search 內建）

```bash
bun run .agents/skills/linkedin-search/cli/src/cli.ts search -q "Senior Backend Engineer" -l "Taipei City, Taiwan" --jobage 30 --format table
```

台北的外商、科技公司職缺不少（實測搜到 Appier、TrendAI、Moxa 等）。LinkedIn 的使用條款不允許自動存取，ai-job-search 標明僅供個人使用、量要少。

### 104 人力銀行：為什麼不能自動搜

104 的 [robots.txt](https://www.104.com.tw/robots.txt) 明寫禁止所有程式用關鍵字搜尋職缺（`Disallow: /*keyword=*`），網站前面還有 Cloudflare 真人驗證。ai-job-search 內建的檢查工具也判定「不要抓」。所以這個 repo **不做** 104 的爬蟲，也請不要自己寫繞過驗證的程式。

104 在 robots.txt 裡留了一張申請爬取權限的表單，有正當用途可以去申請。

**手動的做法（一樣很快）**：

1. 用瀏覽器在 104 搜、挑職缺。
2. 把職缺頁的內容整段複製。
3. 在 Claude Code 裡打 `/apply`，後面貼上內容。

人負責找，AI 負責寫。

---

## 常見問題

**Windows 說「An Application Control policy has blocked this file」，Bun 跑不起來？**

這是 Windows 11 的「智慧型應用程式控制」（Smart App Control）擋了 `bun.exe`。**不建議關掉它**：關了之後要重灌 Windows 才能再打開。改用 Node.js 跑：

```bash
cd .agents/skills/yourator-search/cli
npx tsx src/cli.ts search -q "backend" -l Taipei --format table
```

LinkedIn 那支也一樣（在 `.agents/skills/linkedin-search/cli` 裡跑 `npx tsx src/cli.ts ...`）。這時可以直接跟 Claude 說：「Bun 在我電腦上被擋，請改用 `npx tsx` 跑職缺搜尋工具。」

**搜中文還是英文？**

都可以。台灣新創的職稱常常中英並列，兩種都搜一次比較完整。

**會花多少錢？**

ai-job-search 沒寫一次 `/apply` 花多少，看你用的是訂閱還是 API。Yourator skill 本身免費，不需要 API key。

---

## 使用規範

- **僅供個人求職使用。** 一次搜幾頁就好，不要大量抓取，不要拿來做商業用途。
- Yourator 的 robots.txt 允許這些路徑；它的使用條款頁擋程式讀取，我們沒能讀到，請自己用瀏覽器看一次。
- 用 AI 寫的履歷，內容要是真的。

## 授權

MIT。`yourator-search` 的程式結構改寫自 ai-job-search 的 `linkedin-search`、`jobindex-search`（MIT，Copyright (c) 2026 Mads Lorentzen），見 [LICENSE](LICENSE)。

---

*來自 YouTube 頻道「微塵筆記」*
