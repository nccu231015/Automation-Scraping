from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import traceback
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
import requests
import base64
from requests_oauthlib import OAuth1
from datetime import datetime, timedelta
import time

# 載入環境變數
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="新聞發布系統 API")


# 增加驗證錯誤處理器以協助除錯
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details = exc.errors()
    print(f"\n❌ 請求驗證失敗 (422):")
    print(f"   詳細錯誤: {json.dumps(error_details, indent=2, ensure_ascii=False)}")
    try:
        body = await request.json()
        print(f"   請求內容: {json.dumps(body, indent=2, ensure_ascii=False)}")
    except:
        print("   (無法讀取請求內容)")

    return JSONResponse(
        status_code=422,
        content={"detail": error_details},
    )


# CORS 設定 - 支持本地開發和 Vercel 部署
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://*.vercel.app",  # 允許所有 Vercel 部署的前端
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生產環境中應該限制具體域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase 客戶端初始化
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
table_name = os.getenv("SUPABASE_TABLE_NAME", "news_data")

if not supabase_url or not supabase_key:
    raise ValueError("請在 .env 檔案中設定 SUPABASE_URL 和 SUPABASE_KEY")

supabase: Client = create_client(supabase_url, supabase_key)
print(f"✅ Supabase 客戶端已初始化")
print(f"📍 連接至: {supabase_url}")
print(f"📊 使用資料表: {table_name}")

# OpenAI 客戶端初始化
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("⚠️ 警告: 未設定 OPENAI_API_KEY，AI 重寫功能將無法使用")
    openai_client = None
else:
    openai_client = OpenAI(api_key=openai_api_key)
    print(f"✅ OpenAI 客戶端已初始化")

# WordPress 配置初始化
wordpress_url = os.getenv("WORDPRESS_URL")
wordpress_username = os.getenv("WORDPRESS_USERNAME")
wordpress_app_password = os.getenv("WORDPRESS_APP_PASSWORD")

if not wordpress_url or not wordpress_username or not wordpress_app_password:
    print("⚠️ 警告: 未設定完整的 WordPress 配置，發布到 WordPress 功能將無法使用")
    wordpress_configured = False
else:
    wordpress_configured = True
    print(f"✅ WordPress 配置已載入")
    print(f"📍 WordPress 網站: {wordpress_url}")

# PIXNET 配置初始化
pixnet_client_key = os.getenv("PIXNET_CLIENT_KEY")
pixnet_client_secret = os.getenv("PIXNET_CLIENT_SECRET")
pixnet_access_token = os.getenv("PIXNET_ACCESS_TOKEN")
pixnet_access_token_secret = os.getenv("PIXNET_ACCESS_TOKEN_SECRET")

if not all(
    [
        pixnet_client_key,
        pixnet_client_secret,
        pixnet_access_token,
        pixnet_access_token_secret,
    ]
):
    print("⚠️ 警告: 未設定完整的 PIXNET 配置，發布到 PIXNET 功能將無法使用")
    pixnet_configured = False
else:
    pixnet_configured = True
    print(f"✅ PIXNET 配置已載入")

# Facebook 配置初始化
facebook_page_access_token = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN")

if not facebook_page_access_token:
    print("⚠️ 警告: 未設定 FACEBOOK_PAGE_ACCESS_TOKEN，發布到 Facebook 功能將無法使用")
    facebook_configured = False
else:
    facebook_configured = True
    print("✅ Facebook 配置已載入")

# Threads 配置初始化
threads_user_id = os.getenv("THREADS_USER_ID")
threads_access_token = os.getenv("THREADS_ACCESS_TOKEN")
threads_app_secret = os.getenv("THREADS_APP_SECRET")

if not all([threads_user_id, threads_access_token, threads_app_secret]):
    print("⚠️ 警告: 未設定完整的 Threads 配置，發布到 Threads 功能將無法使用")
    threads_configured = False
else:
    threads_configured = True
    print("✅ Threads 配置已載入")
    print(f"📍 Threads User ID: {threads_user_id}")

# Token 元數據存儲 (遷移到 Supabase 以支持 Cloud Run 無狀態部署)
SETTINGS_TABLE = "app_settings"


def load_token_metadata():
    """從 Supabase 加載 token 元數據"""
    try:
        # 讀取 app_settings 表
        response = supabase.table(SETTINGS_TABLE).select("*").execute()
        metadata = {}
        if response.data:
            for item in response.data:
                metadata[item["key"]] = item["value"]
        return metadata
    except Exception as e:
        print(
            f"⚠️ 無法從數據庫讀取 token 元數據 (若是初次運行請確保已建立 app_settings 表): {e}"
        )
    return {}


def save_token_metadata(metadata):
    """保存 token 元數據到 Supabase"""
    try:
        # 將 metadata 的每個 key-value 存入/更新到數據庫
        for key, value in metadata.items():
            data = {
                "key": key,
                "value": str(value) if value is not None else None,
                "updated_at": datetime.now().isoformat(),
            }
            supabase.table(SETTINGS_TABLE).upsert(data).execute()
    except Exception as e:
        print(f"⚠️ 無法保存 token 元數據到數據庫: {e}")


# 加載已存儲的元數據
stored_metadata = load_token_metadata()


# 輔助函數：解析時間字符串
def parse_stored_time(time_str):
    if time_str and isinstance(time_str, str):
        try:
            return datetime.fromisoformat(time_str)
        except:
            pass
    return None


threads_token_data = {
    "access_token": threads_access_token,
    "last_refresh": parse_stored_time(stored_metadata.get("threads_last_refresh")),
    "expires_in": 5184000,  # 60天（秒）
}

# Instagram 配置初始化
instagram_user_id = os.getenv("IG_USER_ID")
instagram_access_token = os.getenv("IG_ACCESS_TOKEN")
instagram_app_secret = os.getenv("IG_APP_SECRET")
instagram_app_id = os.getenv("IG_APP_ID")  # 需要 App ID 來刷新 token

if not all([instagram_user_id, instagram_access_token]):
    print("⚠️ 警告: 未設定完整的 Instagram 配置，發布到 Instagram 功能將無法使用")
    instagram_configured = False
else:
    instagram_configured = True
    print("✅ Instagram 配置已載入")
    print(f"📍 Instagram User ID: {instagram_user_id}")
    if instagram_app_id and instagram_app_secret:
        print("✅ Instagram Token 刷新功能已啟用")

# Instagram token 刷新時間追蹤（存儲在內存中）
instagram_token_data = {
    "access_token": instagram_access_token,
    "last_refresh": None if instagram_configured else None,
    "expires_in": 5184000,  # 60天（秒）
}

# 暫存 system prompts (在實際應用中應該存在資料庫)
system_prompts_storage = []

# 允許的新聞來源網站列表
ALLOWED_SOURCE_WEBSITES = [
    "https://www.thenationalnews.com/",
    "https://www.bbc.com/news/world/middle_east",
    "https://www.bbc.com/thai",
    "https://www.freemalaysiatoday.com/",
    "https://news.web.nhk/newsweb",
    "https://jen.jiji.com/",
    "https://en.yna.co.kr/",
    "https://news.kbs.co.kr/news/pc/main/main.html",
    "https://www.caixin.com/",
    "https://saudigazette.com.sa/",
]


# 資料模型
class NewsItem(BaseModel):
    id: Optional[int] = None
    title_translated: Optional[str] = None
    content_translated: Optional[str] = None
    images: Optional[str] = None  # JSON 字串格式
    sourceWebsite: Optional[str] = None  # 來源網站
    url: Optional[str] = None  # 新聞網址
    title_modified: Optional[str] = None  # AI 重寫的標題
    content_modified: Optional[str] = None  # AI 重寫的內容

    class Config:
        # 允許額外的欄位
        extra = "ignore"


class SystemPrompt(BaseModel):
    id: Optional[int] = None
    name: str
    prompt: str


class SystemPromptCreate(BaseModel):
    name: str
    prompt: str


class AIRewriteRequest(BaseModel):
    news_items: List[
        dict
    ]  # [{"title_translated": "...", "content_translated": "...", "url": "..."}]
    system_prompts: List[dict]  # [{"name": "...", "prompt": "..."}]


class AIRewriteResult(BaseModel):
    url: str
    title_modified: str
    content_modified: str
    success: bool
    error: Optional[str] = None


class PublishItem(BaseModel):
    news_id: int
    selected_image: Optional[str] = None


class WordPressPublishRequest(BaseModel):
    items: List[PublishItem]


class WordPressPublishResult(BaseModel):
    news_id: int
    news_url: str
    wordpress_post_id: Optional[int] = None
    wordpress_post_url: Optional[str] = None
    success: bool
    error: Optional[str] = None


class PixnetPublishRequest(BaseModel):
    news_ids: List[int]  # 要發布的新聞 ID 列表
    status: Optional[str] = "draft"  # publish, draft, pending


class PixnetPublishResult(BaseModel):
    news_id: int
    news_url: str
    pixnet_article_id: Optional[str] = None
    pixnet_article_url: Optional[str] = None
    success: bool
    error: Optional[str] = None


class FacebookPublishRequest(BaseModel):
    items: List[PublishItem]


class FacebookPublishResult(BaseModel):
    news_id: int
    news_url: str
    facebook_post_id: Optional[str] = None
    facebook_post_url: Optional[str] = None
    success: bool
    error: Optional[str] = None


class ThreadsPublishRequest(BaseModel):
    items: List[PublishItem]


class ThreadsPublishResult(BaseModel):
    news_id: int
    news_url: str
    threads_post_id: Optional[str] = None
    threads_post_url: Optional[str] = None
    success: bool
    error: Optional[str] = None


class InstagramPublishRequest(BaseModel):
    items: List[PublishItem]


class InstagramPublishResult(BaseModel):
    news_id: int
    news_url: str
    instagram_post_id: Optional[str] = None
    instagram_post_url: Optional[str] = None
    success: bool
    error: Optional[str] = None


# API Routes
@app.get("/")
async def root():
    return {"message": "新聞發布系統 API"}


@app.get("/api/health")
async def health_check():
    """檢查 Supabase 連接狀態"""
    try:
        # 嘗試查詢一筆資料來測試連接
        response = supabase.table(table_name).select("id").limit(1).execute()
        return {
            "status": "healthy",
            "supabase_connected": True,
            "table_name": table_name,
            "message": "Supabase 連接正常",
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "supabase_connected": False,
            "table_name": table_name,
            "error": str(e),
            "message": "Supabase 連接失敗，請檢查設定",
        }


@app.get("/api/news", response_model=List[NewsItem])
async def get_news():
    """獲取符合條件的新聞（指定來源網站且 images 不為空）"""
    try:
        # 從 Supabase 獲取資料，包含所有需要的欄位
        response = (
            supabase.table(table_name)
            .select(
                "id, title_translated, content_translated, images, sourceWebsite, url, title_modified, content_modified"
            )
            .execute()
        )

        print(f"DEBUG: 收到 {len(response.data)} 筆原始資料")

        news_list = []
        for item in response.data:
            try:
                # 檢查 sourceWebsite 是否在允許列表中
                source_website = item.get("sourceWebsite")
                if source_website not in ALLOWED_SOURCE_WEBSITES:
                    continue  # 跳過不符合來源網站的新聞

                # 處理 images 欄位：如果是 dict 或 list，轉換為 JSON 字串
                images_value = item.get("images")

                # 檢查 images 是否為空
                if images_value is None:
                    continue  # 跳過 images 為空的新聞

                # 如果是空字串，也跳過
                if isinstance(images_value, str) and images_value.strip() == "":
                    continue

                # 如果是空陣列或空物件，也跳過
                if isinstance(images_value, list) and len(images_value) == 0:
                    continue
                if isinstance(images_value, dict) and len(images_value) == 0:
                    continue

                # 轉換 images 格式
                if isinstance(images_value, (dict, list)):
                    images_value = json.dumps(images_value, ensure_ascii=False)
                elif not isinstance(images_value, str):
                    images_value = str(images_value)

                # 確保 id 是整數
                item_id = item.get("id")
                if item_id is not None:
                    try:
                        item_id = int(item_id)
                    except (ValueError, TypeError):
                        item_id = None

                news_item = NewsItem(
                    id=item_id,
                    title_translated=item.get("title_translated"),
                    content_translated=item.get("content_translated"),
                    images=images_value,
                    sourceWebsite=source_website,
                    url=item.get("url"),
                    title_modified=item.get("title_modified"),
                    content_modified=item.get("content_modified"),
                )
                news_list.append(news_item)
            except Exception as item_error:
                print(f"DEBUG: 處理單筆資料時出錯: {item_error}")
                print(f"DEBUG: 問題資料: {item}")
                print(f"DEBUG: 錯誤堆疊: {traceback.format_exc()}")
                # 跳過有問題的資料，繼續處理其他資料
                continue

        print(f"DEBUG: 過濾後符合條件的新聞: {len(news_list)} 筆")
        return news_list
    except Exception as e:
        error_detail = traceback.format_exc()
        print(f"ERROR: 獲取新聞失敗: {str(e)}")
        print(f"ERROR: 詳細錯誤: {error_detail}")
        raise HTTPException(status_code=500, detail=f"獲取新聞失敗: {str(e)}")


@app.get("/api/news/{news_id}", response_model=NewsItem)
async def get_news_by_id(news_id: int):
    """根據 ID 獲取單一新聞"""
    try:
        response = (
            supabase.table(table_name)
            .select(
                "id, title_translated, content_translated, images, sourceWebsite, url, title_modified, content_modified"
            )
            .eq("id", news_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="找不到該新聞")

        item = response.data[0]
        print(f"DEBUG: 獲取單筆新聞資料: {item}")

        # 處理 images 欄位：如果是 dict 或 list，轉換為 JSON 字串
        images_value = item.get("images")
        if images_value is not None:
            if isinstance(images_value, (dict, list)):
                images_value = json.dumps(images_value, ensure_ascii=False)
            elif not isinstance(images_value, str):
                images_value = str(images_value)

        # 確保 id 是整數
        item_id = item.get("id")
        if item_id is not None:
            try:
                item_id = int(item_id)
            except (ValueError, TypeError):
                item_id = None

        return NewsItem(
            id=item_id,
            title_translated=item.get("title_translated"),
            content_translated=item.get("content_translated"),
            images=images_value,
            sourceWebsite=item.get("sourceWebsite"),
            url=item.get("url"),
            title_modified=item.get("title_modified"),
            content_modified=item.get("content_modified"),
        )
    except HTTPException:
        raise
    except Exception as e:
        error_detail = traceback.format_exc()
        print(f"ERROR: 獲取單筆新聞失敗: {str(e)}")
        print(f"ERROR: 詳細錯誤: {error_detail}")
        raise HTTPException(status_code=500, detail=f"獲取新聞失敗: {str(e)}")


@app.get("/api/system-prompts", response_model=List[SystemPrompt])
async def get_system_prompts():
    """獲取所有 system prompts"""
    return system_prompts_storage


@app.post("/api/system-prompts", response_model=SystemPrompt)
async def create_system_prompt(prompt_data: SystemPromptCreate):
    """創建新的 system prompt"""
    new_prompt = SystemPrompt(
        id=len(system_prompts_storage) + 1,
        name=prompt_data.name,
        prompt=prompt_data.prompt,
    )
    system_prompts_storage.append(new_prompt)
    return new_prompt


@app.delete("/api/system-prompts/{prompt_id}")
async def delete_system_prompt(prompt_id: int):
    """刪除 system prompt"""
    global system_prompts_storage
    system_prompts_storage = [p for p in system_prompts_storage if p.id != prompt_id]
    return {"message": "刪除成功"}


@app.post("/api/ai-rewrite")
async def ai_rewrite_news(request: AIRewriteRequest):
    """使用 AI 重寫新聞"""
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI API 未設定")

    if not request.news_items:
        raise HTTPException(status_code=400, detail="至少需要一則新聞")

    if not request.system_prompts:
        raise HTTPException(status_code=400, detail="至少需要一個 System Prompt")

    results = []

    # 組合所有 system prompts
    system_prompt = "\n\n".join([prompt["prompt"] for prompt in request.system_prompts])

    # 添加輸出格式要求
    system_prompt += '\n\n## 輸出格式要求\n你必須嚴格按照以下 JSON 格式輸出，不要包含任何其他文字：\n```json\n{\n  "title_modified": "重新撰寫的標題",\n  "content_modified": "重新撰寫的內容"\n}\n```'

    print("\n" + "=" * 80)
    print(f"🚀 開始 AI 重寫任務")
    print(f"📊 總計：{len(request.news_items)} 則新聞")
    print(f"🎯 使用：{len(request.system_prompts)} 個 System Prompt")
    print("=" * 80 + "\n")

    # 顯示所有 System Prompts
    print("📝 使用的 System Prompts:")
    for idx, prompt in enumerate(request.system_prompts, 1):
        print(f"  {idx}. {prompt['name']}")
    print()

    # 處理每則新聞
    for idx, news_item in enumerate(request.news_items, 1):
        url = news_item.get("url")
        title = news_item.get("title_translated", "")
        content = news_item.get("content_translated", "")

        if not url:
            results.append(
                AIRewriteResult(
                    url="",
                    title_modified="",
                    content_modified="",
                    success=False,
                    error="缺少 URL",
                )
            )
            continue

        try:
            print(f"\n{'─' * 80}")
            print(f"📰 處理第 {idx}/{len(request.news_items)} 則新聞")
            print(f"🔗 URL: {url}")
            print(f"📌 原始標題: {title[:50]}{'...' if len(title) > 50 else ''}")
            print(f"📄 內容長度: {len(content)} 字")

            # 構建用戶消息
            user_message = f"原始標題：{title}\n\n原始內容：{content}"

            print(f"🤖 正在呼叫 OpenAI API (gpt-5-nano)...")

            # 調用 OpenAI API
            response = openai_client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
            )

            # 解析返回的 JSON
            result_text = response.choices[0].message.content
            result_json = json.loads(result_text)

            title_modified = result_json.get("title_modified", "")
            content_modified = result_json.get("content_modified", "")

            if not title_modified or not content_modified:
                raise ValueError("AI 返回的內容不完整")

            print(f"✅ AI 重寫成功")
            print(
                f"   📝 重寫後標題: {title_modified[:50]}{'...' if len(title_modified) > 50 else ''}"
            )
            print(f"   📏 重寫後內容長度: {len(content_modified)} 字")

            # 更新 Supabase 資料庫
            print(f"💾 正在更新資料庫...")
            update_response = (
                supabase.table(table_name)
                .update(
                    {
                        "title_modified": title_modified,
                        "content_modified": content_modified,
                    }
                )
                .eq("url", url)
                .execute()
            )

            if not update_response.data:
                raise ValueError("資料庫更新失敗，可能找不到對應的 URL")

            print(f"✅ 資料庫更新成功")
            print(f"{'─' * 80}\n")

            results.append(
                AIRewriteResult(
                    url=url,
                    title_modified=title_modified,
                    content_modified=content_modified,
                    success=True,
                    error=None,
                )
            )

        except json.JSONDecodeError as e:
            error_msg = f"JSON 解析失敗: {str(e)}"
            print(f"❌ 處理失敗 (第 {idx}/{len(request.news_items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"{'─' * 80}\n")
            results.append(
                AIRewriteResult(
                    url=url,
                    title_modified="",
                    content_modified="",
                    success=False,
                    error=error_msg,
                )
            )
        except Exception as e:
            error_msg = str(e)
            print(f"❌ 處理失敗 (第 {idx}/{len(request.news_items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─' * 80}\n")
            results.append(
                AIRewriteResult(
                    url=url,
                    title_modified="",
                    content_modified="",
                    success=False,
                    error=error_msg,
                )
            )

    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    print("\n" + "=" * 80)
    print(f"🎉 處理完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("=" * 80 + "\n")

    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results,
    }


@app.post("/api/wordpress-publish")
async def publish_to_wordpress(request: WordPressPublishRequest):
    """將選定的新聞發布到 WordPress"""
    if not wordpress_configured:
        raise HTTPException(status_code=503, detail="WordPress 配置未設定")

    if not request.items:
        raise HTTPException(status_code=400, detail="至少需要一則新聞")

    results = []

    # 建立 WordPress 認證 header
    credentials = f"{wordpress_username}:{wordpress_app_password}"
    token = base64.b64encode(credentials.encode()).decode()
    headers = {"Authorization": f"Basic {token}", "Content-Type": "application/json"}

    print("\n" + "=" * 80)
    print(f"🚀 開始發布到 WordPress")
    print(f"📊 總計：{len(request.items)} 則新聞")
    print(f"🌐 WordPress 網站: {wordpress_url}")
    print("=" * 80 + "\n")

    # 處理每則新聞
    for idx, item_data in enumerate(request.items, 1):
        news_id = item_data.news_id
        selected_image = item_data.selected_image

        try:
            print(f"\n{'─' * 80}")
            print(f"📰 處理第 {idx}/{len(request.items)} 則新聞")
            print(f"🆔 新聞 ID: {news_id}")
            if selected_image:
                print(f"🖼️  指定圖片: {selected_image}")

            # 從 Supabase 獲取新聞資料
            print(f"📥 正在從資料庫獲取新聞...")
            response = (
                supabase.table(table_name)
                .select(
                    "id, url, title_translated, content_translated, title_modified, content_modified, images"
                )
                .eq("id", news_id)
                .execute()
            )

            if not response.data:
                raise ValueError(f"找不到 ID 為 {news_id} 的新聞")

            news_item = response.data[0]

            # 優先使用 AI 重寫後的內容，否則使用翻譯內容
            title = news_item.get("title_modified") or news_item.get(
                "title_translated", ""
            )
            content = news_item.get("content_modified") or news_item.get(
                "content_translated", ""
            )
            news_url = news_item.get("url", "")

            if not title or not content:
                raise ValueError("新聞標題或內容為空")

            print(f"📝 標題: {title[:50]}{'...' if len(title) > 50 else ''}")
            print(f"📄 內容長度: {len(content)} 字")

            # 決定要使用哪張圖片
            featured_media_id = None
            image_to_use = None

            if selected_image:
                image_to_use = selected_image
            else:
                # 如果沒有指定，使用原有的第一張（備用邏輯）
                images = news_item.get("images")
                if images:
                    try:
                        if isinstance(images, str):
                            images_list = json.loads(images)
                        else:
                            images_list = images

                        if images_list and len(images_list) > 0:
                            image_to_use = (
                                images_list[0]
                                if isinstance(images_list, list)
                                else images_list.get("url")
                            )
                    except Exception:
                        pass

            if image_to_use:
                try:
                    print(f"🖼️  正在上傳特色圖片: {image_to_use}")
                    featured_media_id = await upload_image_to_wordpress(
                        image_to_use, headers
                    )
                    if featured_media_id:
                        print(f"✅ 特色圖片上傳成功 (ID: {featured_media_id})")
                except Exception as img_error:
                    print(f"⚠️  圖片上傳失敗: {str(img_error)}")
            else:
                print(f"⚠️  無圖片可上傳")

            # 構建 WordPress 文章內容
            # 在內容末尾添加原始來源連結
            content_with_source = content
            if news_url:
                content_with_source += f"\n\n<p><small>原始來源: <a href='{news_url}' target='_blank'>{news_url}</a></small></p>"

            # 準備發布到 WordPress 的資料
            post_data = {
                "title": title,
                "content": content_with_source,
                "status": "draft",  # 設為草稿，可以改為 "publish" 直接發布
                "format": "standard",
            }

            # 如果有特色圖片，加入資料
            if featured_media_id:
                post_data["featured_media"] = featured_media_id

            print(f"📤 正在發布到 WordPress...")

            # 發送請求到 WordPress REST API
            wp_api_url = f"{wordpress_url.rstrip('/')}/wp-json/wp/v2/posts"
            wp_response = requests.post(
                wp_api_url, headers=headers, json=post_data, timeout=30
            )

            if wp_response.status_code in [200, 201]:
                wp_data = wp_response.json()
                wp_post_id = wp_data.get("id")
                wp_post_url = wp_data.get("link")

                print(f"✅ 發布成功")
                print(f"   🆔 WordPress 文章 ID: {wp_post_id}")
                print(f"   🔗 WordPress 文章網址: {wp_post_url}")
                print(f"{'─' * 80}\n")

                results.append(
                    WordPressPublishResult(
                        news_id=news_id,
                        news_url=news_url,
                        wordpress_post_id=wp_post_id,
                        wordpress_post_url=wp_post_url,
                        success=True,
                        error=None,
                    )
                )
            else:
                error_msg = f"WordPress API 返回錯誤: {wp_response.status_code} - {wp_response.text}"
                raise ValueError(error_msg)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ 發布失敗 (第 {idx}/{len(request.items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─' * 80}\n")

            results.append(
                WordPressPublishResult(
                    news_id=news_id,
                    news_url=news_item.get("url", "")
                    if "news_item" in locals()
                    else "",
                    wordpress_post_id=None,
                    wordpress_post_url=None,
                    success=False,
                    error=error_msg,
                )
            )

    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    print("\n" + "=" * 80)
    print(f"🎉 發布完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("=" * 80 + "\n")

    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results,
    }


@app.post("/api/facebook-publish")
async def publish_to_facebook(request: FacebookPublishRequest):
    """將選定的新聞發布到 Facebook 粉絲專頁"""
    if not facebook_configured:
        raise HTTPException(
            status_code=503,
            detail="Facebook 配置未設定，請在 .env 檔案中設定 FACEBOOK_PAGE_ACCESS_TOKEN",
        )

    if not request.items:
        raise HTTPException(status_code=400, detail="至少需要一則新聞")

    results = []

    print("\n" + "=" * 80)
    print("🚀 開始發布到 Facebook 粉絲專頁")
    print(f"📊 總計：{len(request.items)} 則新聞")
    print("=" * 80 + "\n")

    # 處理每則新聞
    for idx, item_data in enumerate(request.items, 1):
        news_id = item_data.news_id
        selected_image = item_data.selected_image

        try:
            print(f"\n{'─' * 80}")
            print(f"📰 處理第 {idx}/{len(request.items)} 則新聞")
            print(f"🆔 新聞 ID: {news_id}")
            if selected_image:
                print(f"🖼️  指定圖片: {selected_image}")

            # 從 Supabase 獲取新聞資料
            print("📥 正在從資料庫獲取新聞...")
            response = (
                supabase.table(table_name)
                .select(
                    "id, url, title_translated, content_translated, title_modified, content_modified, images"
                )
                .eq("id", news_id)
                .execute()
            )

            if not response.data:
                raise ValueError(f"找不到 ID 為 {news_id} 的新聞")

            news_item = response.data[0]

            # 優先使用 AI 重寫後的內容，否則使用翻譯內容
            title = news_item.get("title_modified") or news_item.get(
                "title_translated", ""
            )
            content = news_item.get("content_modified") or news_item.get(
                "content_translated", ""
            )
            news_url = news_item.get("url", "")

            if not title or not content:
                raise ValueError("新聞標題或內容為空")

            print(f"📝 標題: {title[:50]}{'...' if len(title) > 50 else ''}")
            print(f"📄 內容長度: {len(content)} 字")

            # 決定要使用哪張圖片
            image_to_use = None

            if selected_image:
                image_to_use = selected_image
            else:
                # 如果沒有指定，使用原有的第一張（備用邏輯）
                images = news_item.get("images")
                if images:
                    try:
                        if isinstance(images, str):
                            images_list = json.loads(images)
                        else:
                            images_list = images

                        if images_list and len(images_list) > 0:
                            image_to_use = (
                                images_list[0]
                                if isinstance(images_list, list)
                                else images_list.get("url")
                            )
                    except Exception:
                        pass

            if not image_to_use:
                print("⚠️  無圖片可上傳，跳過此新聞")
                raise ValueError("Facebook 發布需要圖片")

            # 構建 Facebook 貼文內容（標題 + 內容 + 來源）
            caption = f"{title}\n\n{content}"
            if news_url:
                caption += f"\n\n原始來源: {news_url}"

            # 發布到 Facebook（使用 Graph API）
            print(f"📤 正在發布到 Facebook...")
            print(f"🖼️  圖片 URL: {image_to_use}")

            fb_api_url = "https://graph.facebook.com/v24.0/me/photos"
            fb_params = {
                "url": image_to_use,
                "caption": caption,
                "access_token": facebook_page_access_token,
            }

            fb_response = requests.post(fb_api_url, params=fb_params, timeout=30)

            if fb_response.status_code == 200:
                fb_data = fb_response.json()
                fb_post_id = fb_data.get("post_id") or fb_data.get("id")
                # Facebook 貼文網址格式
                fb_post_url = (
                    f"https://www.facebook.com/{fb_post_id.replace('_', '/posts/')}"
                    if fb_post_id
                    else None
                )

                print("✅ 發布成功")
                print(f"   🆔 Facebook 貼文 ID: {fb_post_id}")
                if fb_post_url:
                    print(f"   🔗 Facebook 貼文網址: {fb_post_url}")
                print(f"{'─' * 80}\n")

                results.append(
                    FacebookPublishResult(
                        news_id=news_id,
                        news_url=news_url,
                        facebook_post_id=fb_post_id,
                        facebook_post_url=fb_post_url,
                        success=True,
                        error=None,
                    )
                )
            else:
                error_msg = f"Facebook API 返回錯誤: {fb_response.status_code} - {fb_response.text}"
                raise ValueError(error_msg)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ 發布失敗 (第 {idx}/{len(request.items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─' * 80}\n")

            results.append(
                FacebookPublishResult(
                    news_id=news_id,
                    news_url=news_item.get("url", "")
                    if "news_item" in locals()
                    else "",
                    facebook_post_id=None,
                    facebook_post_url=None,
                    success=False,
                    error=error_msg,
                )
            )

    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    print("\n" + "=" * 80)
    print("🎉 發布完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("=" * 80 + "\n")

    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results,
    }


async def upload_image_to_wordpress(image_url: str, headers: dict) -> Optional[int]:
    """上傳圖片到 WordPress 媒體庫"""
    try:
        # 下載圖片
        img_response = requests.get(image_url, timeout=30)
        if img_response.status_code != 200:
            return None

        # 從 URL 提取檔案名稱
        filename = image_url.split("/")[-1].split("?")[0]
        if not filename:
            filename = "image.jpg"

        # 上傳到 WordPress
        wp_media_url = f"{wordpress_url.rstrip('/')}/wp-json/wp/v2/media"

        files = {
            "file": (
                filename,
                img_response.content,
                img_response.headers.get("content-type", "image/jpeg"),
            )
        }

        # 注意：上傳媒體時需要不同的 headers
        upload_headers = {"Authorization": headers["Authorization"]}

        upload_response = requests.post(
            wp_media_url, headers=upload_headers, files=files, timeout=60
        )

        if upload_response.status_code in [200, 201]:
            media_data = upload_response.json()
            return media_data.get("id")

        return None
    except Exception as e:
        print(f"   ⚠️  圖片上傳異常: {str(e)}")
        return None


# Instagram 相關功能
def refresh_instagram_token():
    """刷新 Instagram Long-Lived Access Token（如果需要）"""
    global instagram_token_data

    # 如果沒有 App ID 和 Secret，無法刷新
    if not instagram_app_id or not instagram_app_secret:
        print("⚠️  無法刷新 Instagram Token：未設定 IG_APP_ID 或 IG_APP_SECRET")
        return instagram_token_data["access_token"]

    # 檢查是否需要刷新
    if instagram_token_data["last_refresh"] is not None:
        time_since_refresh = datetime.now() - instagram_token_data["last_refresh"]
        # 如果距離上次刷新不到59天，不需要刷新
        if time_since_refresh.total_seconds() < (
            instagram_token_data["expires_in"] - 86400
        ):
            print("✅ Instagram Token 仍然有效，無需刷新")
            return instagram_token_data["access_token"]

    print("🔄 正在刷新 Instagram Access Token...")

    try:
        # Instagram Long-Lived Token 刷新 API
        # 文檔: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/refresh-access-token
        refresh_url = "https://graph.instagram.com/refresh_access_token"
        params = {
            "grant_type": "ig_refresh_token",
            "access_token": instagram_token_data["access_token"],
        }

        response = requests.get(refresh_url, params=params, timeout=30)

        if response.status_code == 200:
            data = response.json()
            new_token = data.get("access_token")
            expires_in = data.get("expires_in", 5184000)  # 預設60天

            if new_token:
                instagram_token_data["access_token"] = new_token
                instagram_token_data["last_refresh"] = datetime.now()
                instagram_token_data["expires_in"] = expires_in
                print(
                    f"✅ Instagram Token 刷新成功，有效期：{expires_in}秒（{expires_in / 86400:.0f}天）"
                )
                return new_token

        print(f"⚠️ Instagram Token 刷新失敗: {response.status_code} - {response.text}")
        # 刷新失敗時，繼續使用舊 token
        return instagram_token_data["access_token"]

    except Exception as e:
        print(f"⚠️ Instagram Token 刷新異常: {str(e)}")
        # 異常時，繼續使用舊 token
        return instagram_token_data["access_token"]


@app.post("/api/instagram-publish")
async def publish_to_instagram(request: InstagramPublishRequest):
    """將選定的新聞發布到 Instagram"""
    if not instagram_configured:
        raise HTTPException(
            status_code=503,
            detail="Instagram 配置未設定，請在 .env 檔案中設定 IG_USER_ID, IG_ACCESS_TOKEN",
        )

    if not request.items:
        raise HTTPException(status_code=400, detail="至少需要一則新聞")

    # 刷新 token（如果需要）
    current_token = refresh_instagram_token()

    results = []

    print("\n" + "=" * 80)
    print("🚀 開始發布到 Instagram")
    print(f"📊 總計：{len(request.items)} 則新聞")
    print("=" * 80 + "\n")

    # 處理每則新聞
    for idx, item_data in enumerate(request.items, 1):
        news_id = item_data.news_id
        selected_image = item_data.selected_image

        try:
            print(f"\n{'─' * 80}")
            print(f"📰 處理第 {idx}/{len(request.items)} 則新聞")
            print(f"🆔 新聞 ID: {news_id}")
            if selected_image:
                print(f"🖼️  指定圖片: {selected_image}")

            # 從 Supabase 獲取新聞資料
            print("📥 正在從資料庫獲取新聞...")
            response = (
                supabase.table(table_name)
                .select(
                    "id, url, title_translated, content_translated, title_modified, content_modified, images"
                )
                .eq("id", news_id)
                .execute()
            )

            if not response.data:
                raise ValueError(f"找不到 ID 為 {news_id} 的新聞")

            news_item = response.data[0]

            # 優先使用 AI 重寫後的內容，否則使用翻譯內容
            title = news_item.get("title_modified") or news_item.get(
                "title_translated", ""
            )
            content = news_item.get("content_modified") or news_item.get(
                "content_translated", ""
            )
            news_url = news_item.get("url", "")

            if not title or not content:
                raise ValueError("新聞標題或內容為空")

            print(f"📝 標題: {title[:50]}{'...' if len(title) > 50 else ''}")
            print(f"📄 內容長度: {len(content)} 字")

            # 決定要使用哪張圖片
            image_to_use = None

            if selected_image:
                image_to_use = selected_image
            else:
                # 如果沒有指定，使用原有的第一張（備用邏輯）
                images = news_item.get("images")
                if images:
                    try:
                        if isinstance(images, str):
                            images_list = json.loads(images)
                        else:
                            images_list = images

                        if images_list and len(images_list) > 0:
                            image_to_use = (
                                images_list[0]
                                if isinstance(images_list, list)
                                else images_list.get("url")
                            )
                    except Exception:
                        pass

            if not image_to_use:
                print("⚠️  無圖片可上傳，跳過此新聞")
                raise ValueError("Instagram 發布需要圖片")

            # 構建 Instagram 貼文文字（標題 + 內容）
            # Instagram 限制 2200 字
            caption = f"{title}\n\n{content}"
            if news_url:
                caption += f"\n\n🔗 {news_url}"

            # 截斷至 2200 字
            if len(caption) > 2200:
                caption = caption[:2197] + "..."

            # 步驟1: 創建 Instagram 媒體容器
            print("📤 正在創建 Instagram 媒體容器...")
            print(f"🖼️  圖片 URL: {image_to_use}")

            # Debug: 檢查 token
            print(f"🔑 Access Token 前20字符: {current_token[:20]}...")
            print(f"🔑 Access Token 長度: {len(current_token)}")
            print(f"📍 Instagram User ID: {instagram_user_id}")

            # 使用 graph.instagram.com 並使用 Authorization header
            create_url = f"https://graph.instagram.com/v21.0/{instagram_user_id}/media"
            headers = {
                "Authorization": f"Bearer {current_token}",
                "Content-Type": "application/json",
            }
            create_payload = {"image_url": image_to_use, "caption": caption}

            print(f"📤 API URL: {create_url}")
            create_response = requests.post(
                create_url, headers=headers, json=create_payload, timeout=30
            )

            if create_response.status_code != 200:
                error_msg = f"Instagram 媒體容器創建失敗: {create_response.status_code} - {create_response.text}"
                raise ValueError(error_msg)

            create_data_result = create_response.json()
            creation_id = create_data_result.get("id")

            if not creation_id:
                raise ValueError("無法獲取 Creation ID")

            print(f"✅ 媒體容器創建成功 (ID: {creation_id})")

            # 稍等幾秒確保 Meta 伺服器處理完畢
            print("⏳ 等待 Meta 處理媒體...")
            time.sleep(5)

            # 步驟2: 發布媒體容器
            print("📤 正在發布 Instagram 貼文...")

            publish_url = (
                f"https://graph.instagram.com/v21.0/{instagram_user_id}/media_publish"
            )
            publish_payload = {"creation_id": creation_id}

            publish_response = requests.post(
                publish_url, headers=headers, json=publish_payload, timeout=30
            )

            if publish_response.status_code == 200:
                publish_data_result = publish_response.json()
                instagram_post_id = publish_data_result.get("id")
                # Instagram 貼文網址格式
                instagram_post_url = (
                    f"https://www.instagram.com/p/{instagram_post_id}/"
                    if instagram_post_id
                    else None
                )

                print("✅ 發布成功")
                print(f"   🆔 Instagram 貼文 ID: {instagram_post_id}")
                if instagram_post_url:
                    print(f"   🔗 Instagram 貼文網址: {instagram_post_url}")
                print(f"{'─' * 80}\n")

                results.append(
                    InstagramPublishResult(
                        news_id=news_id,
                        news_url=news_url,
                        instagram_post_id=instagram_post_id,
                        instagram_post_url=instagram_post_url,
                        success=True,
                        error=None,
                    )
                )
            else:
                error_msg = f"Instagram 發布失敗: {publish_response.status_code} - {publish_response.text}"
                raise ValueError(error_msg)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ 發布失敗 (第 {idx}/{len(request.items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─' * 80}\n")

            results.append(
                InstagramPublishResult(
                    news_id=news_id,
                    news_url=news_item.get("url", "")
                    if "news_item" in locals()
                    else "",
                    instagram_post_id=None,
                    instagram_post_url=None,
                    success=False,
                    error=error_msg,
                )
            )

    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    print("\n" + "=" * 80)
    print("🎉 發布完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("=" * 80 + "\n")

    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results,
    }


# Threads 相關功能
def refresh_threads_token():
    """刷新 Threads Access Token（如果需要）"""
    global threads_token_data

    # 檢查是否需要刷新
    if threads_token_data["last_refresh"] is not None:
        time_since_refresh = datetime.now() - threads_token_data["last_refresh"]
        # 如果距離上次刷新不到59天，不需要刷新
        if time_since_refresh.total_seconds() < (
            threads_token_data["expires_in"] - 86400  # 提前1天刷新
        ):
            print("✅ Threads Token 仍然有效，無需刷新")
            return threads_token_data["access_token"]

    print("🔄 正在刷新 Threads Access Token...")

    try:
        refresh_url = "https://graph.threads.net/access_token"
        params = {
            "grant_type": "th_exchange_token",
            "client_secret": threads_app_secret,
            "access_token": threads_token_data["access_token"],
        }

        response = requests.get(refresh_url, params=params, timeout=30)

        if response.status_code == 200:
            data = response.json()
            new_token = data.get("access_token")
            expires_in = data.get("expires_in", 5184000)  # 預設60天

            if new_token:
                threads_token_data["access_token"] = new_token
                threads_token_data["last_refresh"] = datetime.now()
                threads_token_data["expires_in"] = expires_in

                # 保存元數據到文件
                metadata = load_token_metadata()
                metadata["threads_last_refresh"] = datetime.now().isoformat()
                save_token_metadata(metadata)

                print(
                    f"✅ Threads Token 刷新成功，有效期：{expires_in}秒（{expires_in / 86400:.0f}天）"
                )
                return new_token

        print(f"⚠️ Threads Token 刷新失敗: {response.status_code} - {response.text}")
        # 刷新失敗時，繼續使用舊 token
        return threads_token_data["access_token"]

    except Exception as e:
        print(f"⚠️ Threads Token 刷新異常: {str(e)}")
        # 異常時，繼續使用舊 token
        return threads_token_data["access_token"]


@app.post("/api/threads-publish")
async def publish_to_threads(request: ThreadsPublishRequest):
    """將選定的新聞發布到 Threads"""
    if not threads_configured:
        raise HTTPException(
            status_code=503,
            detail="Threads 配置未設定，請在 .env 檔案中設定 THREADS_USER_ID, THREADS_ACCESS_TOKEN, THREADS_APP_SECRET",
        )

    if not request.items:
        raise HTTPException(status_code=400, detail="至少需要一則新聞")

    # 刷新 token（如果需要）
    current_token = refresh_threads_token()

    results = []

    print("\n" + "=" * 80)
    print("🚀 開始發布到 Threads")
    print(f"📊 總計：{len(request.items)} 則新聞")
    print("=" * 80 + "\n")

    # 處理每則新聞
    for idx, item_data in enumerate(request.items, 1):
        news_id = item_data.news_id
        selected_image = item_data.selected_image

        try:
            print(f"\n{'─' * 80}")
            print(f"📰 處理第 {idx}/{len(request.items)} 則新聞")
            print(f"🆔 新聞 ID: {news_id}")
            if selected_image:
                print(f"🖼️  指定圖片: {selected_image}")

            # 從 Supabase 獲取新聞資料
            print("📥 正在從資料庫獲取新聞...")
            response = (
                supabase.table(table_name)
                .select(
                    "id, url, title_translated, content_translated, title_modified, content_modified, images"
                )
                .eq("id", news_id)
                .execute()
            )

            if not response.data:
                raise ValueError(f"找不到 ID 為 {news_id} 的新聞")

            news_item = response.data[0]

            # 優先使用 AI 重寫後的內容，否則使用翻譯內容
            title = news_item.get("title_modified") or news_item.get(
                "title_translated", ""
            )
            content = news_item.get("content_modified") or news_item.get(
                "content_translated", ""
            )
            news_url = news_item.get("url", "")

            if not title or not content:
                raise ValueError("新聞標題或內容為空")

            print(f"📝 標題: {title[:50]}{'...' if len(title) > 50 else ''}")
            print(f"📄 內容長度: {len(content)} 字")

            # 決定要使用哪張圖片
            image_to_use = None

            if selected_image:
                image_to_use = selected_image
            else:
                # 如果沒有指定，使用原有的第一張（備用邏輯）
                images = news_item.get("images")
                if images:
                    try:
                        if isinstance(images, str):
                            images_list = json.loads(images)
                        else:
                            images_list = images

                        if images_list and len(images_list) > 0:
                            image_to_use = (
                                images_list[0]
                                if isinstance(images_list, list)
                                else images_list.get("url")
                            )
                    except Exception:
                        pass

            if not image_to_use:
                print("⚠️  無圖片可上傳，跳過此新聞")
                raise ValueError("Threads 發布需要圖片")

            # 構建 Threads 貼文文字（標題 + 內容）
            # Threads 限制 500 字，需要截斷
            text = f"{title}\n\n{content}"
            if news_url:
                text += f"\n\n🔗 {news_url}"

            # 截斷至 500 字
            if len(text) > 500:
                text = text[:497] + "..."

            # 步驟1: 創建 Threads Container
            print("📤 正在創建 Threads Container...")
            print(f"🖼️  圖片 URL: {image_to_use}")

            create_url = f"https://graph.threads.net/v1.0/{threads_user_id}/threads"
            create_data = {
                "media_type": "IMAGE",
                "image_url": image_to_use,
                "text": text,
                "access_token": current_token,
            }

            create_response = requests.post(create_url, data=create_data, timeout=30)

            if create_response.status_code != 200:
                error_msg = f"Threads Container 創建失敗: {create_response.status_code} - {create_response.text}"
                raise ValueError(error_msg)

            create_data_result = create_response.json()
            container_id = create_data_result.get("id")

            if not container_id:
                raise ValueError("無法獲取 Container ID")

            print(f"✅ Container 創建成功 (ID: {container_id})")

            # 步驟2: 發布 Container
            print("📤 正在發布 Threads 貼文...")

            publish_url = (
                f"https://graph.threads.net/v1.0/{threads_user_id}/threads_publish"
            )
            publish_data = {"creation_id": container_id, "access_token": current_token}

            publish_response = requests.post(publish_url, data=publish_data, timeout=30)

            if publish_response.status_code == 200:
                publish_data_result = publish_response.json()
                threads_post_id = publish_data_result.get("id")
                # Threads 貼文網址格式（需要用戶名，這裡簡化處理）
                threads_post_url = (
                    f"https://www.threads.net/@username/post/{threads_post_id}"
                    if threads_post_id
                    else None
                )

                print("✅ 發布成功")
                print(f"   🆔 Threads 貼文 ID: {threads_post_id}")
                print(f"{'─' * 80}\n")

                results.append(
                    ThreadsPublishResult(
                        news_id=news_id,
                        news_url=news_url,
                        threads_post_id=threads_post_id,
                        threads_post_url=threads_post_url,
                        success=True,
                        error=None,
                    )
                )
            else:
                error_msg = f"Threads 發布失敗: {publish_response.status_code} - {publish_response.text}"
                raise ValueError(error_msg)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ 發布失敗 (第 {idx}/{len(request.items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─' * 80}\n")

            results.append(
                ThreadsPublishResult(
                    news_id=news_id,
                    news_url=news_item.get("url", "")
                    if "news_item" in locals()
                    else "",
                    threads_post_id=None,
                    threads_post_url=None,
                    success=False,
                    error=error_msg,
                )
            )

    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    print("\n" + "=" * 80)
    print("🎉 發布完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("=" * 80 + "\n")

    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results,
    }


async def upload_image_to_wordpress_old(image_url: str, headers: dict) -> Optional[int]:
    """上傳圖片到 WordPress 媒體庫"""
    try:
        # 下載圖片
        img_response = requests.get(image_url, timeout=30)
        if img_response.status_code != 200:
            return None

        # 從 URL 提取檔案名稱
        filename = image_url.split("/")[-1].split("?")[0]
        if not filename:
            filename = "image.jpg"

        # 上傳到 WordPress
        wp_media_url = f"{wordpress_url.rstrip('/')}/wp-json/wp/v2/media"

        files = {
            "file": (
                filename,
                img_response.content,
                img_response.headers.get("content-type", "image/jpeg"),
            )
        }

        # 注意：上傳媒體時需要不同的 headers
        upload_headers = {"Authorization": headers["Authorization"]}

        upload_response = requests.post(
            wp_media_url, headers=upload_headers, files=files, timeout=60
        )

        if upload_response.status_code in [200, 201]:
            media_data = upload_response.json()
            return media_data.get("id")

        return None
    except Exception as e:
        print(f"   ⚠️  圖片上傳異常: {str(e)}")
        return None


@app.post("/api/pixnet-publish")
async def publish_to_pixnet(request: PixnetPublishRequest):
    """將選定的新聞發布到 PIXNET 痞客邦"""
    if not pixnet_configured:
        raise HTTPException(
            status_code=503,
            detail="PIXNET 配置未設定，請在 .env 檔案中設定 PIXNET_CLIENT_KEY, PIXNET_CLIENT_SECRET, PIXNET_ACCESS_TOKEN, PIXNET_ACCESS_TOKEN_SECRET",
        )

    if not request.news_ids:
        raise HTTPException(status_code=400, detail="至少需要選擇一則新聞")

    results = []

    # 嘗試兩種認證方式：OAuth 2.0 Bearer Token 和 OAuth 1.0a
    # PIXNET API 支援 OAuth 2.0，使用 access_token 作為 Bearer Token
    use_oauth2 = True  # 優先嘗試 OAuth 2.0

    print("\n" + "=" * 80)
    print(f"🚀 開始發布到 PIXNET 痞客邦")
    print(f"📊 總計：{len(request.news_ids)} 則新聞")
    print(f"🔐 認證方式: {'OAuth 2.0 Bearer Token' if use_oauth2 else 'OAuth 1.0a'}")
    print("=" * 80 + "\n")

    # 處理每則新聞
    for idx, news_id in enumerate(request.news_ids, 1):
        try:
            print(f"\n{'─' * 80}")
            print(f"📰 處理第 {idx}/{len(request.news_ids)} 則新聞")
            print(f"🆔 新聞 ID: {news_id}")

            # 從 Supabase 獲取新聞資料
            print(f"📥 正在從資料庫獲取新聞...")
            response = (
                supabase.table(table_name)
                .select(
                    "id, url, title_translated, content_translated, title_modified, content_modified, images"
                )
                .eq("id", news_id)
                .execute()
            )

            if not response.data:
                raise ValueError(f"找不到 ID 為 {news_id} 的新聞")

            news_item = response.data[0]

            # 優先使用 AI 重寫後的內容，否則使用翻譯內容
            title = news_item.get("title_modified") or news_item.get(
                "title_translated", ""
            )
            content = news_item.get("content_modified") or news_item.get(
                "content_translated", ""
            )
            news_url = news_item.get("url", "")
            images = news_item.get("images")

            if not title or not content:
                raise ValueError("新聞標題或內容為空")

            print(f"📝 標題: {title[:50]}{'...' if len(title) > 50 else ''}")
            print(f"📄 內容長度: {len(content)} 字")

            # 處理內容：添加圖片和原始來源
            html_content = ""

            # 添加圖片到內容
            if images:
                try:
                    if isinstance(images, str):
                        images_list = json.loads(images)
                    else:
                        images_list = images

                    if images_list and len(images_list) > 0:
                        for img_url in images_list:
                            if isinstance(img_url, str) and img_url:
                                html_content += f'<p><img src="{img_url}" alt="新聞圖片" style="max-width:100%;"></p>\n'
                except Exception as img_error:
                    print(f"⚠️  處理圖片時出錯: {str(img_error)}")

            # 添加主要內容
            # 將換行符轉換為 HTML 段落
            paragraphs = content.split("\n")
            for para in paragraphs:
                para = para.strip()
                if para:
                    html_content += f"<p>{para}</p>\n"

            # 添加原始來源連結
            if news_url:
                html_content += f'\n<p><small>原始來源: <a href="{news_url}" target="_blank">{news_url}</a></small></p>'

            # 設定文章狀態
            # PIXNET 狀態 (數字): 0: 刪除, 1: 草稿, 2: 公開, 3: 密碼, 4: 隱藏, 5: 好友
            status_map = {
                "publish": 2,  # 公開
                "draft": 1,  # 草稿
                "pending": 1,  # 待審核 -> 草稿
                "hidden": 4,  # 隱藏
            }
            article_status = status_map.get(request.status, 1)  # 預設為草稿
            status_names = {1: "草稿", 2: "公開", 4: "隱藏"}

            # 準備發布到 PIXNET 的資料
            # PIXNET API 參數參考: https://developer.pixnet.pro/#!/doc/pixnetApi/blogArticlesCreate
            post_data = {
                "title": title,
                "body": html_content,
                "status": article_status,
                "format": "json",
            }

            print(
                f"📤 正在發布到 PIXNET (狀態: {status_names.get(article_status, article_status)})..."
            )

            # 發送請求到 PIXNET API
            pixnet_api_url = "https://emma.pixnet.cc/blog/articles"

            if use_oauth2:
                # OAuth 2.0 Bearer Token 認證
                headers = {
                    "Authorization": f"Bearer {pixnet_access_token}",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
                pixnet_response = requests.post(
                    pixnet_api_url, headers=headers, data=post_data, timeout=30
                )
            else:
                # OAuth 1.0a 認證
                auth = OAuth1(
                    pixnet_client_key,
                    client_secret=pixnet_client_secret,
                    resource_owner_key=pixnet_access_token,
                    resource_owner_secret=pixnet_access_token_secret,
                )
                pixnet_response = requests.post(
                    pixnet_api_url, auth=auth, data=post_data, timeout=30
                )

            print(f"🔍 PIXNET API 回應狀態碼: {pixnet_response.status_code}")
            print(
                f"🔍 PIXNET API 回應內容: {pixnet_response.text[:500] if len(pixnet_response.text) > 500 else pixnet_response.text}"
            )

            if pixnet_response.status_code == 200:
                pixnet_data = pixnet_response.json()

                # 檢查 API 回應是否成功
                if pixnet_data.get("error") == 0 or pixnet_data.get("error") is None:
                    article_info = pixnet_data.get("article", {})
                    article_id = article_info.get("id", "")
                    article_link = article_info.get("link", "")

                    # 如果沒有 link，嘗試組合 URL
                    if not article_link and article_id:
                        user = pixnet_data.get("user", "")
                        if user:
                            article_link = (
                                f"https://{user}.pixnet.net/blog/post/{article_id}"
                            )

                    print(f"✅ 發布成功")
                    print(f"   🆔 PIXNET 文章 ID: {article_id}")
                    print(f"   🔗 PIXNET 文章網址: {article_link}")
                    print(f"{'─' * 80}\n")

                    results.append(
                        PixnetPublishResult(
                            news_id=news_id,
                            news_url=news_url,
                            pixnet_article_id=str(article_id),
                            pixnet_article_url=article_link,
                            success=True,
                            error=None,
                        )
                    )
                else:
                    error_msg = pixnet_data.get("message", "未知錯誤")
                    raise ValueError(f"PIXNET API 返回錯誤: {error_msg}")
            else:
                # 嘗試解析錯誤訊息
                try:
                    error_data = pixnet_response.json()
                    error_msg = error_data.get("message", pixnet_response.text)
                except:
                    error_msg = pixnet_response.text
                raise ValueError(
                    f"PIXNET API 返回錯誤 ({pixnet_response.status_code}): {error_msg}"
                )

        except Exception as e:
            error_msg = str(e)
            print(f"❌ 發布失敗 (第 {idx}/{len(request.news_ids)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─' * 80}\n")

            results.append(
                PixnetPublishResult(
                    news_id=news_id,
                    news_url=news_item.get("url", "")
                    if "news_item" in locals()
                    else "",
                    pixnet_article_id=None,
                    pixnet_article_url=None,
                    success=False,
                    error=error_msg,
                )
            )

    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    print("\n" + "=" * 80)
    print(f"🎉 發布完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("=" * 80 + "\n")

    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results,
    }


@app.get("/api/pixnet-status")
async def get_pixnet_status():
    """檢查 PIXNET 配置狀態"""
    return {
        "configured": pixnet_configured,
        "message": "PIXNET 配置已完成"
        if pixnet_configured
        else "PIXNET 配置未完成，請設定環境變數",
    }


@app.get("/api/pixnet-check-phone")
async def check_pixnet_phone():
    """檢查 PIXNET 手機驗證狀態 - 同時測試兩種認證方式"""
    if not pixnet_configured:
        return {"error": "PIXNET 配置未設定"}

    results = {
        "oauth2_result": None,
        "oauth1_result": None,
        "token_info": {
            "client_key_length": len(pixnet_client_key) if pixnet_client_key else 0,
            "client_secret_length": len(pixnet_client_secret)
            if pixnet_client_secret
            else 0,
            "access_token_length": len(pixnet_access_token)
            if pixnet_access_token
            else 0,
            "access_token_secret_length": len(pixnet_access_token_secret)
            if pixnet_access_token_secret
            else 0,
            "access_token_preview": pixnet_access_token[:10] + "..."
            if pixnet_access_token and len(pixnet_access_token) > 10
            else pixnet_access_token,
        },
    }

    # 測試 OAuth 2.0 Bearer Token
    try:
        headers = {"Authorization": f"Bearer {pixnet_access_token}"}
        url = "https://emma.pixnet.cc/account?format=json"
        response = requests.get(url, headers=headers, timeout=10)
        print(f"📱 OAuth 2.0 測試 - 狀態碼: {response.status_code}")
        print(f"📱 OAuth 2.0 測試 - 回應: {response.text[:500]}")
        results["oauth2_result"] = {
            "status_code": response.status_code,
            "response": response.json()
            if response.headers.get("content-type", "").find("json") >= 0
            else response.text[:200],
        }
    except Exception as e:
        results["oauth2_result"] = {"error": str(e)}

    # 測試 OAuth 1.0a
    try:
        auth = OAuth1(
            pixnet_client_key,
            client_secret=pixnet_client_secret,
            resource_owner_key=pixnet_access_token,
            resource_owner_secret=pixnet_access_token_secret,
        )
        url = "https://emma.pixnet.cc/account?format=json"
        response = requests.get(url, auth=auth, timeout=10)
        print(f"📱 OAuth 1.0a 測試 - 狀態碼: {response.status_code}")
        print(f"📱 OAuth 1.0a 測試 - 回應: {response.text[:500]}")
        results["oauth1_result"] = {
            "status_code": response.status_code,
            "response": response.json()
            if response.headers.get("content-type", "").find("json") >= 0
            else response.text[:200],
        }
    except Exception as e:
        results["oauth1_result"] = {"error": str(e)}

    return results


@app.get("/api/pixnet-test")
async def test_pixnet_connection():
    """測試 PIXNET API 連接和認證"""
    if not pixnet_configured:
        return {"success": False, "error": "PIXNET 配置未設定"}

    results = {"oauth2_test": None, "oauth1_test": None, "account_info": None}

    # 測試 1: OAuth 2.0 Bearer Token - 取得帳戶資訊
    try:
        headers = {"Authorization": f"Bearer {pixnet_access_token}"}
        response = requests.get(
            "https://emma.pixnet.cc/account?format=json", headers=headers, timeout=10
        )
        results["oauth2_test"] = {
            "status_code": response.status_code,
            "response": response.json()
            if response.status_code == 200
            else response.text[:200],
        }
        if response.status_code == 200:
            data = response.json()
            if data.get("error") == 0:
                results["account_info"] = data.get("account", {})
    except Exception as e:
        results["oauth2_test"] = {"error": str(e)}

    # 測試 2: OAuth 1.0a - 取得帳戶資訊
    try:
        auth = OAuth1(
            pixnet_client_key,
            client_secret=pixnet_client_secret,
            resource_owner_key=pixnet_access_token,
            resource_owner_secret=pixnet_access_token_secret,
        )
        response = requests.get(
            "https://emma.pixnet.cc/account?format=json", auth=auth, timeout=10
        )
        results["oauth1_test"] = {
            "status_code": response.status_code,
            "response": response.json()
            if response.status_code == 200
            else response.text[:200],
        }
        if response.status_code == 200 and results["account_info"] is None:
            data = response.json()
            if data.get("error") == 0:
                results["account_info"] = data.get("account", {})
    except Exception as e:
        results["oauth1_test"] = {"error": str(e)}

    # 判斷哪種認證方式有效
    oauth2_works = (
        results["oauth2_test"]
        and isinstance(results["oauth2_test"], dict)
        and results["oauth2_test"].get("status_code") == 200
    )
    oauth1_works = (
        results["oauth1_test"]
        and isinstance(results["oauth1_test"], dict)
        and results["oauth1_test"].get("status_code") == 200
    )

    return {
        "success": oauth2_works or oauth1_works,
        "oauth2_works": oauth2_works,
        "oauth1_works": oauth1_works,
        "recommended": "OAuth 2.0"
        if oauth2_works
        else ("OAuth 1.0a" if oauth1_works else "無法認證"),
        "details": results,
        "hint": "如果兩種認證都失敗，請確認 .env 中的 PIXNET 設定是否正確",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
