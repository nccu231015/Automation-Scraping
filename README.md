# Automation Scraping - AI News Rewriting & Multi-Platform Publishing System

A full-stack news management and AI rewriting system that allows you to process news articles with customizable AI prompts and publish to multiple platforms.

## 🚀 Features

- **Original News List**: Display news fetched from Supabase with filtering by source and keywords
- **AI News Rewriting**: Rewrite news titles and content using OpenAI GPT models
- **System Prompt Management**: Create and manage custom AI prompts stored in browser localStorage
- **Processed News List**: View AI-rewritten news (displays only AI results, not original content)
- **🖼️ Image Selection**: Select specific images for each news item before publishing
- **📤 Multi-Platform Publishing**: 
  - **WordPress**: Batch publish with custom featured images
  - **PIXNET**: Publish to PIXNET blog platform
  - **Facebook**: Post to Facebook Pages with automatic token management
  - **Threads**: Publish to Threads with automatic token refresh (60-day auto-renewal)
  - **Instagram**: Publish to Instagram with automatic token refresh (60-day auto-renewal)
  - **Multi-Platform Mode**: Select multiple platforms and publish to all at once
- **Multi-selection**: Select multiple news articles and system prompts for batch processing
- **Preview Modal**: Preview news content before processing
- **Filtering**: Filter by website source and title keywords across all tabs
- **Image Upload**: Automatically upload featured images to WordPress media library
- **🔄 Auto Token Refresh**: Threads & Instagram tokens automatically refresh before expiration

## 📦 Tech Stack

### Frontend
- React + TypeScript
- Vite
- Axios
- CSS

### Backend
- Python 3.12
- FastAPI
- Supabase (PostgreSQL)
- OpenAI API
- WordPress REST API
- Facebook Graph API
- Threads API

## 🛠️ Local Development

### 1. Setup Environment Variables
Create a `.env` file in the project root:
```env
# Supabase 設定
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_TABLE_NAME=news_data

# OpenAI 設定
OPENAI_API_KEY=your_openai_api_key

# WordPress 設定（選填，用於發布功能）
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_APP_PASSWORD=your_app_password

# PIXNET 設定（選填）
PIXNET_CLIENT_KEY=your_pixnet_client_key
PIXNET_CLIENT_SECRET=your_pixnet_client_secret
PIXNET_ACCESS_TOKEN=your_pixnet_access_token
PIXNET_ACCESS_TOKEN_SECRET=your_pixnet_access_token_secret

# Facebook 設定（選填）
FACEBOOK_PAGE_ACCESS_TOKEN=your_facebook_page_access_token

# Threads 設定（選填）
THREADS_USER_ID=your_threads_user_id
THREADS_ACCESS_TOKEN=your_threads_long_lived_token
THREADS_APP_SECRET=your_threads_app_secret

# Instagram 設定（選填）
IG_USER_ID=your_instagram_business_account_id
IG_ACCESS_TOKEN=your_instagram_long_lived_token
IG_APP_SECRET=your_instagram_app_secret
```

## 🔐 Token Configuration Guide

### Facebook Page Access Token
- **類型**: Page Access Token
- **有效期**: ⏰ **永久有效**（除非改密碼或撤銷授權）
- **刷新機制**: ❌ 不需要刷新

**獲取步驟**:
1. 前往 [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. 選擇您的應用程式
3. 點擊 "Get Token" → "Get User Access Token"
4. 轉換為 Long-Lived User Token:
   ```bash
   GET /oauth/access_token?
       grant_type=fb_exchange_token&
       client_id={APP_ID}&
       client_secret={APP_SECRET}&
       fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
5. 用 Long-Lived User Token 獲取 Page Token:
   ```bash
   GET /me/accounts?access_token={LONG_LIVED_USER_TOKEN}
   ```
6. 返回的 `access_token` 就是永久有效的 Page Access Token

**驗證**: 使用 [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- 類型應顯示: **Page**
- 到期: **Never** 或無到期日

---

### Threads Access Token
- **類型**: Long-Lived User Access Token
- **有效期**: ⏰ **60 天**
- **刷新機制**: ✅ **自動刷新**（系統會在第 59 天自動刷新，延長 60 天）

**獲取步驟**:
1. 前往 [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. 選擇您的 Threads 應用程式
3. 點擊 "Get Token" → "Get User Access Token"
4. 勾選權限:
   - `threads_basic`
   - `threads_content_publish`
   - `threads_manage_insights`
   - `threads_manage_replies`
   - `threads_read_replies`
5. 轉換為 Long-Lived Token:
   ```bash
   GET https://graph.threads.net/access_token?
       grant_type=th_exchange_token&
       client_secret={THREADS_APP_SECRET}&
       access_token={SHORT_LIVED_TOKEN}
   ```
6. 返回的 `access_token` 就是 60 天有效的 Long-Lived Token

**驗證**: 使用 [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- 到期日應為約 **60 天後**
- 有效: **是**

⚠️ **重要**: Token 必須至少 24 小時舊才能刷新，剛獲取的 token 會有刷新警告是正常的。

---

### Instagram Access Token
- **類型**: Long-Lived User Access Token
- **有效期**: ⏰ **60 天**
- **刷新機制**: ✅ **自動刷新**（系統會在第 59 天自動刷新，延長 60 天）

**前置要求**:
- Instagram 帳號必須是 **Business Account** 或 **Creator Account**
- Instagram 帳號必須連結到 Facebook Page

**獲取步驟**:
1. 前往 [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. 選擇您的應用程式
3. 添加權限:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
4. 生成 Short-Lived Token
5. 轉換為 Long-Lived Token:
   ```bash
   GET https://graph.instagram.com/access_token?
       grant_type=ig_exchange_token&
       client_secret={APP_SECRET}&
       access_token={SHORT_LIVED_TOKEN}
   ```
6. 獲取 Instagram Business Account ID:
   ```bash
   GET /me/accounts?fields=instagram_business_account
   ```

**驗證**: 使用 [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- 到期日應為約 **60 天後**
- 權限應包含 `instagram_basic` 和 `instagram_content_publish`

---

## 🔄 Auto Token Refresh Mechanism

系統已實現智能 Token 管理機制，確保長期穩定運行：

### Token 刷新策略

| 平台 | 刷新機制 | 持久化存儲 | 說明 |
|------|---------|-----------|------|
| **Facebook** | ❌ 不需要 | N/A | Page Token 永久有效 |
| **Threads** | ✅ 自動 | `token_metadata.json` | 59天自動刷新 |
| **Instagram** | ✅ 自動 | `token_metadata.json` | 59天自動刷新 |

### 刷新流程

1. **初始配置**（僅第一次）:
   - 獲取新 Token 並配置到 `.env`
   - 系統自動記錄刷新時間到 `token_metadata.json`

2. **自動刷新**（之後無需手動）:
   ```
   第 1 天: Token 開始使用，記錄刷新時間
   第 59 天: 系統自動刷新，延長 60 天
   第 119 天: 系統自動刷新，延長 60 天
   第 179 天: 系統自動刷新，延長 60 天
   ... (無限循環，永不過期)
   ```

3. **持久化存儲**:
   - 刷新時間保存在 `token_metadata.json`
   - 重啟服務器後自動恢復狀態
   - 無需擔心服務中斷導致 token 過期

### 刷新 API 端點

**Threads**:
```bash
GET https://graph.threads.net/access_token?
    grant_type=th_exchange_token&
    client_secret={THREADS_APP_SECRET}&
    access_token={CURRENT_TOKEN}
```

**Instagram**:
```bash
GET https://graph.instagram.com/refresh_access_token?
    grant_type=ig_refresh_token&
    access_token={CURRENT_TOKEN}
```

### 注意事項

⚠️ **Token 過期後無法刷新**: 
- 刷新只能對**未過期**的 token 生效
- 如果 token 已過期，必須重新獲取新 token
- 系統會在過期前 1 天自動刷新，避免過期

⚠️ **刷新條件**:
- Threads & Instagram token 必須**至少 24 小時舊**才能刷新
- 剛獲取的 token 在 24 小時內無法刷新（會有警告但不影響使用）

> 📖 **WordPress 設定詳細說明**: 請參閱 [WORDPRESS_SETUP.md](WORDPRESS_SETUP.md)

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
cd backend
python main.py
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
- `images` (text/json) - Array of image URLs
- `sourceWebsite` (text)
- `url` (text) - Required for AI rewriting
- `title_modified` (text) - Populated after AI processing
- `content_modified` (text) - Populated after AI processing

## 💡 Usage Tips

### AI Rewriting Workflow
1. Go to \"System Prompt 設定專區\" and create your custom prompts
2. Navigate to \"AI 寫新聞\" tab
3. Use filters to find desired news articles
4. Select multiple news articles (checkboxes)
5. Select one or more system prompts
6. Click submit to process (all prompts are combined and applied to each news article)
7. View results in \"處理後新聞列表\"

### Processing with Multiple Prompts
If you need to use different prompts for different news articles:
- **Option 1** (Recommended): Process in batches - select news set A with prompt A, submit, then select news set B with prompt B, submit
- **Option 2**: Select multiple prompts - they will be combined and applied to all selected news

### Multi-Platform Publishing Workflow

#### 1. Image Selection
1. In \"處理後新聞列表\" tab, select news articles (checkboxes)
2. For each news item, click on the image thumbnails below to select your preferred featured image
3. Selected images will have a purple border and checkmark

#### 2. Publishing to WordPress
1. Select news articles with checkboxes
2. Optionally select specific images for each article
3. Click \"發布到 WordPress\" button
4. The system will:
   - Upload selected image (or first image) as featured image
   - Use AI-rewritten content (or original if not rewritten)
   - Add source link at the end of the article
   - Publish as draft by default
5. Check the results and WordPress post URLs

#### 3. Publishing to Facebook
1. Select news articles and images
2. Click \"發布到 Facebook\" button
3. Posts will include title, content, source link, and selected image
4. Published directly to your Facebook Page

#### 4. Publishing to Threads
1. Select news articles and images
2. Click \"發布到 Threads\" button
3. System will automatically:
   - Refresh access token if needed (valid for 60 days)
   - Create Threads container with image
   - Publish the post
4. Content automatically truncated to 500 characters (Threads limit)

### Platform-Specific Notes

**WordPress:**
- Supports custom featured images
- Published as drafts by default
- Includes full content and source links

**PIXNET:**
- OAuth 1.0 authentication
- Published as drafts by default
- Full HTML content support

**Facebook:**
- Requires Page Access Token
- Uses `/me/photos` endpoint
- Image required for each post

**Threads:**
- Two-step publishing process (create container → publish)
- Automatic token refresh every 60 days
- 500 character limit (auto-truncated)
- Image required for each post

## 🔧 API Endpoints

- `GET /api/news` - Fetch news from Supabase
- `POST /api/ai-rewrite` - Process news with AI
- `POST /api/wordpress-publish` - Publish to WordPress
- `POST /api/pixnet-publish` - Publish to PIXNET
- `POST /api/facebook-publish` - Publish to Facebook
- `POST /api/threads-publish` - Publish to Threads
- `POST /api/instagram-publish` - Publish to Instagram

## 📝 License

MIT License
