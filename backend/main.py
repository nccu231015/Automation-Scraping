from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import traceback
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# 載入環境變數（從專案根目錄）
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="新聞發布系統 API")

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
# 表名可從環境變數讀取，預設為 'news'
table_name = os.getenv("SUPABASE_TABLE", "news")

if not supabase_url or not supabase_key:
    raise ValueError("請在 .env 檔案中設定 SUPABASE_URL 和 SUPABASE_KEY")

supabase: Client = create_client(supabase_url, supabase_key)
print(f"✅ Supabase 客戶端已初始化")
print(f"📍 連接至: {supabase_url}")
print(f"📊 使用資料表: {table_name}")

# OpenAI 客戶端初始化
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("⚠️  警告: 未設定 OPENAI_API_KEY，AI 重寫功能將無法使用")
    openai_client = None
else:
    openai_client = OpenAI(api_key=openai_api_key)
    print(f"✅ OpenAI 客戶端已初始化")

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
    news_items: List[dict]  # [{"title_translated": "...", "content_translated": "...", "url": "..."}]
    system_prompts: List[dict]  # [{"name": "...", "prompt": "..."}]

class AIRewriteResult(BaseModel):
    url: str
    title_modified: str
    content_modified: str
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
            "message": "Supabase 連接正常"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "supabase_connected": False,
            "table_name": table_name,
            "error": str(e),
            "message": "Supabase 連接失敗，請檢查設定"
        }

@app.get("/api/news", response_model=List[NewsItem])
async def get_news():
    """獲取符合條件的新聞（指定來源網站且 images 不為空）"""
    try:
        # 從 Supabase 獲取資料，包含所有需要的欄位
        response = supabase.table(table_name).select("id, title_translated, content_translated, images, sourceWebsite, url, title_modified, content_modified").execute()
        
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
                    content_modified=item.get("content_modified")
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
        response = supabase.table(table_name).select("id, title_translated, content_translated, images, sourceWebsite, url, title_modified, content_modified").eq("id", news_id).execute()
        
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
            content_modified=item.get("content_modified")
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
        prompt=prompt_data.prompt
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
    system_prompt = "\n\n".join([
        prompt['prompt']
        for prompt in request.system_prompts
    ])
    
    # 添加輸出格式要求
    system_prompt += "\n\n## 輸出格式要求\n你必須嚴格按照以下 JSON 格式輸出，不要包含任何其他文字：\n```json\n{\n  \"title_modified\": \"重新撰寫的標題\",\n  \"content_modified\": \"重新撰寫的內容\"\n}\n```"
    
    print("\n" + "="*80)
    print(f"🚀 開始 AI 重寫任務")
    print(f"📊 總計：{len(request.news_items)} 則新聞")
    print(f"🎯 使用：{len(request.system_prompts)} 個 System Prompt")
    print("="*80 + "\n")
    
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
            results.append(AIRewriteResult(
                url="",
                title_modified="",
                content_modified="",
                success=False,
                error="缺少 URL"
            ))
            continue
        
        try:
            print(f"\n{'─'*80}")
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
                    {"role": "user", "content": user_message}
                ],
                response_format={"type": "json_object"}
            )
            
            # 解析返回的 JSON
            result_text = response.choices[0].message.content
            result_json = json.loads(result_text)
            
            title_modified = result_json.get("title_modified", "")
            content_modified = result_json.get("content_modified", "")
            
            if not title_modified or not content_modified:
                raise ValueError("AI 返回的內容不完整")
            
            print(f"✅ AI 重寫成功")
            print(f"   📝 重寫後標題: {title_modified[:50]}{'...' if len(title_modified) > 50 else ''}")
            print(f"   📏 重寫後內容長度: {len(content_modified)} 字")
            
            # 更新 Supabase 資料庫
            print(f"💾 正在更新資料庫...")
            update_response = supabase.table(table_name).update({
                "title_modified": title_modified,
                "content_modified": content_modified
            }).eq("url", url).execute()
            
            if not update_response.data:
                raise ValueError("資料庫更新失敗，可能找不到對應的 URL")
            
            print(f"✅ 資料庫更新成功")
            print(f"{'─'*80}\n")
            
            results.append(AIRewriteResult(
                url=url,
                title_modified=title_modified,
                content_modified=content_modified,
                success=True,
                error=None
            ))
            
        except json.JSONDecodeError as e:
            error_msg = f"JSON 解析失敗: {str(e)}"
            print(f"❌ 處理失敗 (第 {idx}/{len(request.news_items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"{'─'*80}\n")
            results.append(AIRewriteResult(
                url=url,
                title_modified="",
                content_modified="",
                success=False,
                error=error_msg
            ))
        except Exception as e:
            error_msg = str(e)
            print(f"❌ 處理失敗 (第 {idx}/{len(request.news_items)} 則)")
            print(f"   錯誤: {error_msg}")
            print(f"   詳細錯誤: {traceback.format_exc()}")
            print(f"{'─'*80}\n")
            results.append(AIRewriteResult(
                url=url,
                title_modified="",
                content_modified="",
                success=False,
                error=error_msg
            ))
    
    # 統計成功和失敗的數量
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count
    
    print("\n" + "="*80)
    print(f"🎉 處理完成！")
    print(f"✅ 成功: {success_count} 則")
    print(f"❌ 失敗: {fail_count} 則")
    print("="*80 + "\n")
    
    return {
        "total": len(results),
        "success": success_count,
        "failed": fail_count,
        "results": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)