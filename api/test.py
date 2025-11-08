"""
最小化測試入口 - 用於診斷問題
"""
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()

@app.get("/")
def root():
    return {"status": "test handler working", "message": "如果看到這個，說明基本環境正常"}

@app.get("/env")
def check_env():
    import os
    return {
        "SUPABASE_URL": "已設定" if os.getenv("SUPABASE_URL") else "未設定",
        "SUPABASE_KEY": "已設定" if os.getenv("SUPABASE_KEY") else "未設定",
        "SUPABASE_TABLE_NAME": os.getenv("SUPABASE_TABLE_NAME", "未設定"),
        "OPENAI_API_KEY": "已設定" if os.getenv("OPENAI_API_KEY") else "未設定",
    }

handler = Mangum(app, lifespan="off")

