"""
Vercel Serverless Function entry point
將 FastAPI 應用適配為 Vercel Serverless Functions
"""
import os
import sys

# 確保 Python 能找到 backend 模組
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.main import app
from mangum import Mangum

# 使用 Mangum 將 FastAPI 轉換為 ASGI handler
handler = Mangum(app, lifespan="off")

