# Automation Scraping - AI News Rewriting System

A full-stack news management and AI rewriting system that allows you to process news articles with customizable AI prompts.

## 🚀 Features

- **Original News List**: Display news fetched from Supabase with filtering by source and keywords
- **AI News Rewriting**: Rewrite news titles and content using OpenAI GPT models
- **System Prompt Management**: Create and manage custom AI prompts stored in browser localStorage
- **Processed News List**: View AI-rewritten news (displays only AI results, not original content)
- **Multi-selection**: Select multiple news articles and system prompts for batch processing
- **Preview Modal**: Preview news content before processing
- **Filtering**: Filter by website source and title keywords across all tabs

## 📦 Tech Stack

### Frontend
- React + TypeScript
- Vite
- Axios
- Tailwind CSS

### Backend
- Python 3.12
- FastAPI
- Supabase (PostgreSQL)
- OpenAI API

## 🛠️ Local Development

### 1. Setup Environment Variables
Create a `.env` file in the project root:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_TABLE=your_table_name
OPENAI_API_KEY=your_openai_api_key
ALLOWED_SOURCE_WEBSITES=https://example.com/,https://another-site.com/
```

### 2. Install Dependencies

**Backend:**
```bash
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### 3. Start Services

**Terminal 1 - Backend:**
```bash
python3.12 backend/main.py
# Runs on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

## 🌐 Share with ngrok

To share your local development with clients:

### 1. Start Backend and Frontend
Follow the steps in Local Development above.

### 2. Expose Frontend with ngrok
```bash
ngrok http 3000
```

### 3. Share the ngrok URL
Send the ngrok URL (e.g., `https://xxx.ngrok-free.app`) to your client. The frontend will automatically proxy API requests to your local backend through Vite's proxy configuration.

**Note**: Only the frontend needs ngrok. The backend stays on localhost:8000.

## 📋 Database Schema

Your Supabase table should include these columns:
- `id` (integer, primary key)
- `title_translated` (text)
- `content_translated` (text)
- `images` (text/json)
- `sourceWebsite` (text)
- `url` (text) - Required for AI rewriting
- `title_modified` (text) - Populated after AI processing
- `content_modified` (text) - Populated after AI processing

## 💡 Usage Tips

### AI Rewriting Workflow
1. Go to "System Prompt 設定專區" and create your custom prompts
2. Navigate to "AI 寫新聞" tab
3. Use filters to find desired news articles
4. Select multiple news articles (checkboxes)
5. Select one or more system prompts
6. Click submit to process (all prompts are combined and applied to each news article)
7. View results in "處理後新聞列表"

### Processing with Multiple Prompts
If you need to use different prompts for different news articles:
- **Option 1** (Recommended): Process in batches - select news set A with prompt A, submit, then select news set B with prompt B, submit
- **Option 2**: Select multiple prompts - they will be combined and applied to all selected news

## 📝 License

MIT License
