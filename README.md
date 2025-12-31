# Automation Scraping - AI News Rewriting & Multi-Platform Publishing System

A full-stack news management and AI rewriting system that allows you to process news articles with customizable AI prompts and publish to multiple platforms.

## 🚀 Features

- **Original News List**: Display news fetched from Supabase with filtering by source and keywords
- **AI News Rewriting**: Rewrite news titles and content using OpenAI GPT models
- **System Prompt Management**: Create and manage custom AI prompts stored in browser localStorage
- **Processed News List**: View AI-rewritten news (displays only AI results, not original content)
- **🏷️ AI News Classification**: 
  - **Inline Editing**: Directly edit news categories in the list
  - **Category Display**: View Chinese and English category tags
  - **Advanced Search**: Filter news by category and search across titles and categories
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
- **Type**: Page Access Token
- **Validity**: ⏰ **Permanent** (unless password changed or authorization revoked)
- **Refresh**: ❌ Not required

**Acquisition Steps**:
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your application
3. Click "Get Token" → "Get User Access Token"
4. Convert to Long-Lived User Token:
   ```bash
   GET /oauth/access_token?
       grant_type=fb_exchange_token&
       client_id={APP_ID}&
       client_secret={APP_SECRET}&
       fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
5. Get Page Token using Long-Lived User Token:
   ```bash
   GET /me/accounts?access_token={LONG_LIVED_USER_TOKEN}
   ```
6. The returned `access_token` is the permanent Page Access Token

**Verification**: Use [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- Type should show: **Page**
- Expires: **Never** or no expiration date

---

### Threads Access Token
- **Type**: Long-Lived User Access Token
- **Validity**: ⏰ **60 days**
- **Refresh**: ✅ **Auto-refresh** (System automatically refreshes on day 59, extends for 60 days)

**Acquisition Steps**:
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your Threads application
3. Click "Get Token" → "Get User Access Token"
4. Check permissions:
   - `threads_basic`
   - `threads_content_publish`
   - `threads_manage_insights`
   - `threads_manage_replies`
   - `threads_read_replies`
5. Convert to Long-Lived Token:
   ```bash
   GET https://graph.threads.net/access_token?
       grant_type=th_exchange_token&
       client_secret={THREADS_APP_SECRET}&
       access_token={SHORT_LIVED_TOKEN}
   ```
6. The returned `access_token` is a 60-day valid Long-Lived Token

**Verification**: Use [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- Expiration should be approximately **60 days** later
- Valid: **Yes**

⚠️ **Important**: Token must be at least 24 hours old to refresh. Refresh warnings for newly acquired tokens are normal.

---

### Instagram Access Token
- **Type**: Long-Lived User Access Token
- **Validity**: ⏰ **60 days**
- **Refresh**: ✅ **Auto-refresh** (System automatically refreshes on day 59, extends for 60 days)

**Prerequisites**:
- Instagram account must be **Business Account** or **Creator Account**
- Instagram account must be linked to a Facebook Page

**Acquisition Steps**:
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your application
3. Add permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
4. Generate Short-Lived Token
5. Convert to Long-Lived Token:
   ```bash
   GET https://graph.instagram.com/access_token?
       grant_type=ig_exchange_token&
       client_secret={APP_SECRET}&
       access_token={SHORT_LIVED_TOKEN}
   ```
6. Get Instagram Business Account ID:
   ```bash
   GET /me/accounts?fields=instagram_business_account
   ```

**Verification**: Use [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- Expiration should be approximately **60 days** later
- Permissions should include `instagram_basic` and `instagram_content_publish`

---

## 🔄 Auto Token Refresh Mechanism

The system implements an intelligent token management mechanism to ensure long-term stable operation:

### Token Refresh Strategy

| Platform | Refresh | Persistence | Description |
|----------|---------|-------------|-------------|
| **Facebook** | ❌ Not needed | N/A | Page Token is permanent |
| **Threads** | ✅ Auto | `token_metadata.json` | Auto-refresh on day 59 |
| **Instagram** | ✅ Auto | `token_metadata.json` | Auto-refresh on day 59 |

### Refresh Workflow

1. **Initial Setup** (First time only):
   - Obtain new Token and configure in `.env`
   - System automatically records refresh time to `token_metadata.json`

2. **Auto Refresh** (No manual intervention required):
   ```
   Day 1: Token starts, refresh time recorded
   Day 59: System auto-refreshes, extends for 60 days
   Day 119: System auto-refreshes, extends for 60 days
   Day 179: System auto-refreshes, extends for 60 days
   ... (infinite loop, never expires)
   ```

3. **Persistent Storage**:
   - Refresh times saved in `token_metadata.json`
   - Automatically restores state after server restart
   - No worry about token expiration due to service interruption

### Refresh API Endpoints

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

### Important Notes

⚠️ **Cannot refresh expired tokens**: 
- Refresh only works on **unexpired** tokens
- If token has expired, must obtain a new token
- System auto-refreshes 1 day before expiration to prevent expiry

⚠️ **Refresh Conditions**:
- Threads & Instagram tokens must be **at least 24 hours old** to refresh
- Newly acquired tokens cannot refresh within 24 hours (warnings are normal but don't affect usage)

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
