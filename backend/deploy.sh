#!/bin/bash

# Cloud Run 服務名稱
SERVICE_NAME="news-backend"
# GCP 區域 (台灣)
REGION="asia-east1"

echo "🚀 開始部署到 Google Cloud Run..."

# 檢查是否已登入 gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
    echo "❌ 未檢測到 gcloud 登入狀態，請先執行 'gcloud auth login'"
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project)
echo "📦 目標專案 ID: $PROJECT_ID"
echo "🌏 目標區域: $REGION"

# 讀取 .env 文件並生成 env_vars.yaml (更安全的方式)
echo "⚙️ 正在生成環境變數配置文件 (env_vars.yaml)..."

# 創建 yaml 頭部
echo "" > env_vars.yaml

# 讀取 .env 並寫入 yaml
while IFS= read -r line || [[ -n "$line" ]]; do
    # 跳過註釋和空行
    if [[ $line =~ ^#.*$ ]] || [[ -z $line ]]; then
        continue
    fi
    
    # 處理 KEY=VALUE
    if [[ $line =~ = ]]; then
        KEY=$(echo "$line" | cut -d '=' -f 1)
        VALUE=$(echo "$line" | cut -d '=' -f 2-)
        
        # 移除前後引號
        VALUE="${VALUE%\"}"
        VALUE="${VALUE#\"}"
        VALUE="${VALUE%\'}"
        VALUE="${VALUE#\'}"
        
        # 寫入 yaml 格式 (KEY: "VALUE")
        echo "$KEY: \"$VALUE\"" >> env_vars.yaml
    fi
done < ../.env

if [ ! -s env_vars.yaml ]; then
    echo "❌ 未能生成有效的環境變數配置文件"
    exit 1
fi

# 部署
echo "🚀 正在部署服務 $SERVICE_NAME ..."

gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --env-vars-file env_vars.yaml

# 清理臨時文件
rm env_vars.yaml

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo "🔗 您的 API URL 顯示在上方 (Service URL)"
else
    echo "❌ 部署失敗，請檢查錯誤信息"
fi
