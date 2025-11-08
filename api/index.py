"""
Vercel Serverless Function entry point
將 FastAPI 應用適配為 Vercel Serverless Functions
"""
import os
import sys

# 打印調試信息
print("🔍 Current working directory:", os.getcwd())
print("🔍 __file__:", __file__)
print("🔍 sys.path:", sys.path[:3])

# 確保 Python 能找到 backend 模組
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
    print(f"✅ Added to sys.path: {root_dir}")

try:
    from backend.main import app
    print("✅ Successfully imported app from backend.main")
    
    from mangum import Mangum
    print("✅ Successfully imported Mangum")
    
    # 使用 Mangum 將 FastAPI 轉換為 ASGI handler
    handler = Mangum(app, lifespan="off")
    print("✅ Mangum handler created successfully")
    
except Exception as e:
    print(f"❌ Error during import: {e}")
    import traceback
    traceback.print_exc()
    raise

