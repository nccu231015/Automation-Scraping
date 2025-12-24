# 使用官方 Python 3.12 輕量版映像
FROM python:3.12-slim

# 設定工作目錄
WORKDIR /app

# 設定環境變數
# 防止 Python 生成 .pyc 文件
ENV PYTHONDONTWRITEBYTECODE=1
# 防止 Python 緩衝 stdout/stderr，確保日誌即時輸出
ENV PYTHONUNBUFFERED=1

# 安裝系統依賴 (如果有需要編譯的 Python 套件)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴文件
COPY requirements.txt .

# 安裝 Python 依賴
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程序代碼
COPY . .

# Cloud Run 默認監聽 8080 端口
ENV PORT=8080

# 啟動命令
# 使用 uvicorn 啟動 FastAPI，監聽所有 IP (0.0.0.0) 和環境變數指定的端口
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
