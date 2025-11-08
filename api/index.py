"""
Vercel Serverless Function entry point
"""
import sys
import os

# 添加專案根目錄到 Python 路徑
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

print(f"🔧 Python 路徑已設置")
print(f"   當前目錄: {current_dir}")
print(f"   父目錄: {parent_dir}")
print(f"   sys.path: {sys.path[:3]}")

# 嘗試導入主應用
try:
    print("📦 正在導入 backend.main...")
    from backend.main import app
    print("✅ backend.main 導入成功")
    
    from mangum import Mangum
    print("✅ mangum 導入成功")
    
    handler = Mangum(app, lifespan="off")
    print("✅ Handler 初始化成功")
    
except Exception as e:
    # 如果導入失敗，創建一個 fallback handler 顯示錯誤信息
    import traceback
    error_detail = traceback.format_exc()
    print(f"❌ 導入失敗: {e}")
    print(f"詳細錯誤:\n{error_detail}")
    
    from fastapi import FastAPI
    from mangum import Mangum
    
    fallback_app = FastAPI()
    
    @fallback_app.get("/")
    def root():
        return {
            "status": "error",
            "error": "Backend initialization failed",
            "message": str(e),
            "detail": error_detail,
            "hint": "請檢查 Vercel Function Logs 或環境變數設定"
        }
    
    @fallback_app.get("/health")
    def health():
        return {
            "status": "degraded",
            "message": "Service running in fallback mode"
        }
    
    handler = Mangum(fallback_app, lifespan="off")

