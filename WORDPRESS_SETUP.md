# WordPress 發布功能設定指南

本系統已添加將處理後的新聞自動發布到 WordPress 的功能。

## 📋 功能特色

- ✅ 選擇多則新聞批量發布到 WordPress
- ✅ 優先使用 AI 重寫後的標題和內容
- ✅ 自動上傳第一張圖片作為特色圖片
- ✅ 在文章末尾添加原始來源連結
- ✅ 發布為草稿狀態（可修改為直接發布）

## 🔧 設定步驟

### 1. 生成 WordPress 應用程式密碼

1. 登入您的 WordPress 網站後台
2. 前往 **用戶 → 個人資料**
3. 滾動到 **應用程式密碼** 區塊
4. 輸入應用程式名稱（例如：「新聞發布系統」）
5. 點擊 **添加新應用程式密碼**
6. **立即複製並保存**生成的密碼（只會顯示一次）

> ⚠️ **注意**：應用程式密碼與您的登入密碼不同，是用於 REST API 訪問的專用密碼。

### 2. 設定環境變數

編輯專案根目錄的 `.env` 檔案，填入以下資訊：

```bash
# WordPress 設定
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

**說明：**
- `WORDPRESS_URL`: 您的 WordPress 網站完整網址（含 https://）
- `WORDPRESS_USERNAME`: 您的 WordPress 用戶名稱
- `WORDPRESS_APP_PASSWORD`: 剛才生成的應用程式密碼

### 3. 安裝必要套件

```bash
cd backend
pip install -r requirements.txt
```

### 4. 重啟後端服務

```bash
cd backend
python main.py
```

看到以下訊息表示設定成功：
```
✅ WordPress 配置已載入
📍 WordPress 網站: https://your-wordpress-site.com
```

## 📱 使用方式

### 在前端介面操作：

1. 點擊 **「處理後新聞列表」** 標籤頁
2. 勾選要發布的新聞（可多選）
3. 點擊 **「發布到 WordPress」** 按鈕
4. 系統會：
   - 上傳第一張圖片作為特色圖片
   - 使用 AI 重寫後的標題和內容（如果有）
   - 在文章末尾添加原始來源連結
   - 將文章發布為 **草稿** 狀態
5. 查看發布結果，包含每則新聞的 WordPress 文章連結

### 發布狀態

預設情況下，文章會以 **草稿 (draft)** 狀態發布，您可以在 WordPress 後台預覽後再手動發布。

如果想要直接發布，修改 `backend/main.py` 第 480 行：

```python
# 改為 "publish" 直接發布
"status": "publish",
```

## 🔍 故障排除

### 問題：顯示「WordPress 配置未設定」

**解決方法：**
- 確認 `.env` 檔案中的 WordPress 配置已正確填寫
- 重啟後端服務

### 問題：發布失敗，顯示認證錯誤

**解決方法：**
- 確認 WordPress 用戶名稱正確
- 重新生成應用程式密碼並更新 `.env`
- 確認您的 WordPress 網站已啟用 REST API

### 問題：圖片上傳失敗

**解決方法：**
- 確認 WordPress 允許通過 REST API 上傳媒體
- 檢查圖片網址是否可訪問
- 檢查 WordPress 媒體庫空間是否足夠

### 問題：無法連接到 WordPress

**解決方法：**
- 確認 WordPress 網站網址正確（包含 https://）
- 確認網站可以從後端服務器訪問
- 檢查防火牆或網絡設定

## 📝 API 端點

### POST /api/wordpress-publish

**請求格式：**
```json
{
  "news_ids": [1, 2, 3]
}
```

**回應格式：**
```json
{
  "total": 3,
  "success": 2,
  "failed": 1,
  "results": [
    {
      "news_id": 1,
      "news_url": "https://source.com/news/1",
      "wordpress_post_id": 123,
      "wordpress_post_url": "https://your-site.com/2025/11/post-title",
      "success": true,
      "error": null
    }
  ]
}
```

## 🔐 安全性建議

1. **不要將 `.env` 檔案提交到版本控制**
   - `.env` 已在 `.gitignore` 中
2. **定期更換應用程式密碼**
3. **使用 HTTPS 連接**
4. **限制應用程式密碼的權限**（如果 WordPress 支援）

## 💡 進階設定

### 自訂文章類型

修改 `backend/main.py` 中的 `post_data`：

```python
post_data = {
    "title": title,
    "content": content_with_source,
    "status": "draft",
    "format": "standard",
    "categories": [1],  # 添加分類 ID
    "tags": [1, 2, 3],  # 添加標籤 ID
}
```

### 修改文章格式

支援的格式：
- `standard` - 標準文章
- `aside` - 旁註
- `gallery` - 相簿
- `link` - 連結
- `image` - 圖片
- `quote` - 引文
- `status` - 狀態
- `video` - 視訊
- `audio` - 音訊
- `chat` - 聊天

---

如有任何問題，請檢查後端控制台的詳細日誌輸出。

