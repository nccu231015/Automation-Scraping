"""
Vercel Serverless Function entry point
"""
import sys
import os

# 添加專案根目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 嘗試導入
try:
    from backend.main import app
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except Exception as e:
    # 如果導入失敗，創建一個簡單的 fallback handler
    print(f"Warning: Failed to import main app: {e}")
    from fastapi import FastAPI
    from mangum import Mangum
    
    fallback_app = FastAPI()
    
    @fallback_app.get("/")
    def root():
        return {
            "error": "Backend initialization failed",
            "message": str(e),
            "hint": "Check Vercel Function Logs for details"
        }
    
    handler = Mangum(fallback_app, lifespan="off")

