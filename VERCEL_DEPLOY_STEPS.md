# 🚀 Vercel 分離部署步驟

## 📦 專案結構
我們會創建 **2 個獨立的 Vercel 專案**：
1. 後端專案（FastAPI Serverless）
2. 前端專案（React + Vite）

---

## 🔵 步驟 1：部署後端（先做）

### 1.1 準備後端配置
```bash
# 將 vercel-backend.json 複製為 vercel.json
cp vercel-backend.json vercel.json
```

### 1.2 部署到 Vercel
1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 點擊 **"New Project"**
3. Import GitHub 倉庫：`nccu231015/Automation-Scraping`
4. **專案設定**：
   - Project Name: `automation-scraping-backend`
   - Framework Preset: **Other**
   - Root Directory: `.` (保持預設)
   
### 1.3 設定環境變數 ⚠️
在專案設定中添加：
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key  
SUPABASE_TABLE_NAME=news_data
OPENAI_API_KEY=your_openai_api_key
```

### 1.4 部署並取得 URL
- 點擊 **"Deploy"**
- 部署完成後，複製 URL（例如：`https://automation-scraping-backend.vercel.app`）

---

## 🟢 步驟 2：部署前端

### 2.1 準備前端配置
```bash
# 刪除後端的 vercel.json，使用前端配置
rm vercel.json
cp vercel-frontend.json vercel.json
```

### 2.2 部署到 Vercel
1. 返回 [Vercel Dashboard](https://vercel.com/dashboard)
2. **再次**點擊 **"New Project"**
3. Import **相同的** GitHub 倉庫
4. **專案設定**：
   - Project Name: `automation-scraping-frontend`
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 2.3 設定環境變數
```
VITE_API_URL=https://automation-scraping-backend.vercel.app
```
⚠️ 使用步驟 1.4 取得的後端 URL

### 2.4 部署
點擊 **"Deploy"**

---

## ✅ 步驟 3：測試

### 測試後端
訪問：`https://your-backend.vercel.app/api/health`

應該看到：
```json
{"status": "healthy", "supabase_connected": true}
```

### 測試前端
訪問：`https://your-frontend.vercel.app`
- 檢查新聞列表是否載入
- 測試 AI 寫新聞功能

---

## 📝 重要提醒

### ⚠️ vercel.json 的使用
由於兩個專案共用一個 Git 倉庫：

**方法 1：手動切換（推薦）**
- 後端部署時：確保根目錄有 `vercel.json`（從 `vercel-backend.json` 複製）
- 前端部署時：Vercel 會自動使用 `frontend/` 目錄下的配置

**方法 2：分別配置**
- 後端專案：在 Vercel Dashboard 手動設定
- 前端專案：使用 `vercel-frontend.json`

### 🔄 重新部署
```bash
git add .
git commit -m "Update"
git push origin main
```
兩個專案都會自動重新部署。

---

## 🐛 常見問題

**Q: 為什麼要分開兩個專案？**
A: Vercel 對 Python serverless functions 和 Node.js 前端的配置不同，分開部署更清晰。

**Q: 環境變數在哪裡設定？**
A: Vercel Dashboard → 選擇專案 → Settings → Environment Variables

**Q: 如何查看後端日誌？**
A: Vercel Dashboard → 後端專案 → Deployments → 點擊部署 → Functions

**Q: CORS 錯誤？**
A: 確認 `backend/main.py` 的 CORS 設定包含前端 URL
