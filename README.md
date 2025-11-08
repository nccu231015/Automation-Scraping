# Automation Scraping - 新聞發佈系統

一個全端新聞管理和 AI 重寫系統。

## 🚀 功能特色

- **原始新聞列表**：顯示從 Supabase 抓取的新聞
- **AI 寫新聞**：使用 OpenAI GPT-4o 重寫新聞標題和內容
- **System Prompt 管理**：自定義 AI 重寫的提示詞
- **處理後新聞列表**：查看 AI 重寫後的新聞
- **篩選功能**：按網站來源和標題關鍵字過濾

## 📦 技術棧

### 前端
- React + TypeScript
- Vite
- Axios
- Tailwind CSS

### 後端
- Python FastAPI
- Supabase
- OpenAI API

## 🛠️ 本地開發

### 前端
```bash
cd frontend
npm install
npm run dev
```

### 後端
```bash
pip install -r requirements.txt
python backend/main.py
```

### 環境變數
在根目錄創建 `.env` 文件：
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_TABLE_NAME=your_table_name
OPENAI_API_KEY=your_openai_api_key
```

## 🌐 部署

### Vercel（前端）
1. 連接 GitHub 倉庫
2. 設定 Root Directory 為 `frontend`
3. Build Command: `npm run build`
4. Output Directory: `dist`

### Railway/Render（後端）
1. 部署 Python FastAPI 應用
2. 設定環境變數
3. 啟動命令：`uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## 📝 授權

MIT License
