import { useState, useEffect } from 'react'
import axios from 'axios'

// 設定 API Base URL
// 生產環境 (Vercel): 使用環境變數 VITE_API_BASE_URL 指向 GCP Cloud Run
// 本地開發: 如果沒設定環境變數，預設為空字符串 (使用 Vite Proxy 轉發到 localhost:8000)
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || ''

interface NewsItem {
  id: number
  title_translated: string | null
  content_translated: string | null
  images: string | null
  sourceWebsite?: string | null
  url?: string | null
  title_modified?: string | null
  content_modified?: string | null
  category_zh?: string | null  // 中文分類
  category_en?: string | null  // 英文分類
}

interface SystemPrompt {
  id: number
  name: string
  prompt: string
}

type Tab = 'news' | 'prompts' | 'ai' | 'processed' | 'admin'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('news')
  const [newsList, setNewsList] = useState<NewsItem[]>([])
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiSelectedNewsIds, setAiSelectedNewsIds] = useState<number[]>([])
  const [aiSelectedPromptIds, setAiSelectedPromptIds] = useState<number[]>([])
  const [aiResult, setAiResult] = useState('')
  const [aiWebsiteFilter, setAiWebsiteFilter] = useState('all')
  const [aiCategoryFilter, setAiCategoryFilter] = useState('all') // 新增：AI寫新聞的分類篩選
  const [aiTitleKeyword, setAiTitleKeyword] = useState('')
  const [aiPreviewNews, setAiPreviewNews] = useState<NewsItem | null>(null)
  const [aiProcessing, setAiProcessing] = useState(false)

  // 原始新聞篩選狀態
  const [newsWebsiteFilter, setNewsWebsiteFilter] = useState('all')
  const [newsCategoryFilter, setNewsCategoryFilter] = useState('all')  // 新增分類篩選
  const [newsTitleKeyword, setNewsTitleKeyword] = useState('')

  // 分類編輯狀態（用於原始新聞列表）
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editCategoryZh, setEditCategoryZh] = useState('')
  const [editCategoryEn, setEditCategoryEn] = useState('')

  // 處理後新聞列表狀態
  const [processedNewsList, setProcessedNewsList] = useState<NewsItem[]>([])
  const [processedLoading, setProcessedLoading] = useState(false)
  const [processedWebsiteFilter, setProcessedWebsiteFilter] = useState('all')
  const [processedCategoryFilter, setProcessedCategoryFilter] = useState('all')  // 新增分類篩選
  const [processedTitleKeyword, setProcessedTitleKeyword] = useState('')
  const [selectedProcessedNews, setSelectedProcessedNews] = useState<NewsItem | null>(null)
  const [selectedProcessedNewsIds, setSelectedProcessedNewsIds] = useState<number[]>([])
  const [selectedProcessedImages, setSelectedProcessedImages] = useState<{ [key: number]: string }>({})
  const [wordpressPublishing, setWordpressPublishing] = useState(false)
  const [pixnetPublishing, setPixnetPublishing] = useState(false)
  const [facebookPublishing, setFacebookPublishing] = useState(false)
  const [threadsPublishing, setThreadsPublishing] = useState(false)
  const [instagramPublishing, setInstagramPublishing] = useState(false)

  // WordPress 帳號相關狀態
  const [wordpressAccounts, setWordpressAccounts] = useState<Array<{ id: string, name: string, url: string }>>([])
  const [selectedWordpressAccounts, setSelectedWordpressAccounts] = useState<string[]>([])

  // Facebook 帳號相關狀態
  const [facebookAccounts, setFacebookAccounts] = useState<Array<{ id: string, name: string }>>([])
  const [selectedFacebookAccounts, setSelectedFacebookAccounts] = useState<string[]>([])

  // Instagram 帳號相關狀態
  const [instagramAccounts, setInstagramAccounts] = useState<Array<{ id: string, name: string }>>([])
  const [selectedInstagramAccounts, setSelectedInstagramAccounts] = useState<string[]>([])

  // Threads 帳號相關狀態
  const [threadsAccounts, setThreadsAccounts] = useState<Array<{ id: string, name: string }>>([])
  const [selectedThreadsAccounts, setSelectedThreadsAccounts] = useState<string[]>([])

  // Admin 自動發文狀態
  const [autoConfig, setAutoConfig] = useState<{
    enabled: boolean
    publish_times: string[]
    platforms: { wordpress: boolean; facebook: boolean; instagram: boolean; threads: boolean }
  }>({
    enabled: false,
    publish_times: ['09:00', '17:00'],
    platforms: { wordpress: true, facebook: true, instagram: true, threads: true }
  })
  const [autoStatus, setAutoStatus] = useState<{
    date: string
    total_logs: number
    accounts: Array<{
      platform: string
      account_name: string
      success_count: number
      fail_count: number
      last_time: string
      last_success: boolean
      last_error: string | null
    }>
    recent_logs: Array<any>
  } | null>(null)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoStatusLoading, setAutoStatusLoading] = useState(false)
  const [newPublishTime, setNewPublishTime] = useState('')

  // 多平台發布選擇
  const [selectedPlatforms, setSelectedPlatforms] = useState<{
    wordpress: boolean
    pixnet: boolean
    facebook: boolean
    threads: boolean
    instagram: boolean
  }>({
    wordpress: false,
    pixnet: false,
    facebook: false,
    threads: false,
    instagram: false
  })
  const [isMultiPlatformPublishing, setIsMultiPlatformPublishing] = useState(false)

  // System Prompt 表單狀態
  const [promptName, setPromptName] = useState('')
  const [promptContent, setPromptContent] = useState('')

  // 改為從 API 獲取 System Prompts
  useEffect(() => {
    fetchSystemPrompts()
  }, [])

  // 獲取 WordPress 帳號列表
  useEffect(() => {
    fetchWordPressAccounts()
  }, [])

  // 獲取 Facebook 帳號列表
  useEffect(() => {
    fetchFacebookAccounts()
  }, [])

  // 獲取 Facebook 帳號列表
  useEffect(() => {
    fetchFacebookAccounts()
  }, [])

  // 獲取 Instagram 帳號列表
  useEffect(() => {
    fetchInstagramAccounts()
  }, [])

  // 獲取 Threads 帳號列表
  useEffect(() => {
    fetchThreadsAccounts()
  }, [])

  const fetchSystemPrompts = async () => {
    try {
      const response = await axios.get<SystemPrompt[]>('/api/prompts')
      setSystemPrompts(response.data)
    } catch (err) {
      console.error('獲取 System Prompts 失敗:', err)
      // 如果 API 失敗，設為空數組
      setSystemPrompts([])
    }
  }

  const fetchWordPressAccounts = async () => {
    try {
      const response = await axios.get<{ accounts: Array<{ id: string, name: string, url: string }> }>('/api/wordpress-accounts')
      setWordpressAccounts(response.data.accounts)
      if (response.data.accounts.length > 0) {
        setSelectedWordpressAccounts([response.data.accounts[0].id])  // 預設選擇第一個帳號
      }
    } catch (err) {
      console.error('獲取 WordPress 帳號失敗:', err)
      setWordpressAccounts([])
    }
  }

  const fetchFacebookAccounts = async () => {
    try {
      const response = await axios.get<{ accounts: Array<{ id: string, name: string }> }>('/api/facebook-accounts')
      setFacebookAccounts(response.data.accounts)
      if (response.data.accounts.length > 0) {
        setSelectedFacebookAccounts([response.data.accounts[0].id])
      }
    } catch (err) {
      console.error('獲取 Facebook 帳號失敗:', err)
      setFacebookAccounts([])
    }
  }

  const fetchInstagramAccounts = async () => {
    try {
      const response = await axios.get<{ accounts: Array<{ id: string, name: string }> }>('/api/instagram-accounts')
      setInstagramAccounts(response.data.accounts)
      if (response.data.accounts.length > 0) {
        setSelectedInstagramAccounts([response.data.accounts[0].id])
      }
    } catch (err) {
      console.error('獲取 Instagram 帳號失敗:', err)
      setInstagramAccounts([])
    }
  }

  const fetchThreadsAccounts = async () => {
    try {
      const response = await axios.get<{ accounts: Array<{ id: string, name: string }> }>('/api/threads-accounts')
      setThreadsAccounts(response.data.accounts)
      if (response.data.accounts.length > 0) {
        setSelectedThreadsAccounts([response.data.accounts[0].id])
      }
    } catch (err) {
      console.error('獲取 Threads 帳號失敗:', err)
      setThreadsAccounts([])
    }
  }

  const fetchAutoConfig = async () => {
    try {
      const res = await axios.get('/api/autopublish/config')
      setAutoConfig(res.data)
    } catch (err) {
      console.error('獲取自動發文設定失敗:', err)
    }
  }

  const fetchAutoStatus = async () => {
    setAutoStatusLoading(true)
    try {
      const res = await axios.get('/api/autopublish/status')
      setAutoStatus(res.data)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message
      alert('❌ 載入發文狀況失敗：' + msg + '\n\n（請確認 Supabase auto_publish_logs 表格已建立）')
    } finally {
      setAutoStatusLoading(false)
    }
  }

  const handleSaveAutoConfig = async (newConfig: typeof autoConfig) => {
    try {
      const res = await axios.post('/api/autopublish/config', newConfig)
      setAutoConfig(res.data.config)
      alert('設定已儲存！')
    } catch (err) {
      alert('儲存失敗')
    }
  }

  const handleRunNow = async () => {
    if (!confirm('確定要立即執行一次自動發文嗎？')) return
    setAutoRunning(true)
    try {
      await axios.post('/api/autopublish/run', { platforms: autoConfig.platforms })
      alert('✅ 手動發文已完成！')
      fetchAutoStatus()
    } catch (err: any) {
      alert('❌ 發文失敗：' + (err.response?.data?.detail || err.message))
    } finally {
      setAutoRunning(false)
    }
  }


  // 獲取新聞列表
  useEffect(() => {
    if (activeTab === 'news' && newsList.length === 0) {
      fetchNews()
    }
  }, [activeTab, newsList.length])

  useEffect(() => {
    if (activeTab === 'ai') {
      if (newsList.length === 0) {
        fetchNews()
      }
    }
  }, [activeTab, newsList.length])

  // 獲取處理後新聞列表
  useEffect(() => {
    if (activeTab === 'processed') {
      fetchProcessedNews()
    }
  }, [activeTab])

  const fetchNews = async () => {
    setNewsLoading(true)
    setError(null)
    try {
      const response = await axios.get<NewsItem[]>('/api/news')
      console.log('=== fetchNews 收到的數據 ===')
      console.log('總共新聞數量:', response.data.length)
      console.log('前 3 則新聞的 URL:', response.data.slice(0, 3).map(n => ({ id: n.id, url: n.url })))
      console.log('缺少 URL 的新聞數量:', response.data.filter(n => !n.url).length)
      setNewsList(response.data)
    } catch (err) {
      setError('獲取新聞失敗，請檢查後端連接和 Supabase 設定')
      console.error('獲取新聞失敗:', err)
    } finally {
      setNewsLoading(false)
    }
  }

  const fetchProcessedNews = async () => {
    setProcessedLoading(true)
    setError(null)
    try {
      const response = await axios.get<NewsItem[]>('/api/news')
      // 只保留有 title_modified 和 content_modified 的新聞
      const processed = response.data.filter(
        (news) => news.title_modified && news.content_modified
      )
      setProcessedNewsList(processed)
    } catch (err) {
      setError('獲取處理後新聞失敗')
      console.error('獲取處理後新聞失敗:', err)
    } finally {
      setProcessedLoading(false)
    }
  }

  const handleNewsClick = (news: NewsItem) => {
    setSelectedNews(news)
  }

  const parseImages = (imagesStr: string | null): string[] => {
    if (!imagesStr) return []
    try {
      const parsed = JSON.parse(imagesStr)
      if (Array.isArray(parsed)) {
        return parsed.filter(img => img && typeof img === 'string')
      }
      if (typeof parsed === 'string' && parsed) {
        return [parsed]
      }
      return []
    } catch {
      return imagesStr
        .split(',')
        .map((img) => img.trim())
        .filter((img) => img.length > 0)
    }
  }

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promptName.trim() || !promptContent.trim()) {
      alert('請填寫名稱和內容')
      return
    }

    try {
      // 調用 API 創建 Prompt
      await axios.post('/api/prompts', {
        name: promptName,
        prompt: promptContent
      })

      // 重新獲取列表
      await fetchSystemPrompts()

      setPromptName('')
      setPromptContent('')
      alert('System Prompt 已儲存到雲端資料庫')
    } catch (err) {
      console.error('創建 Prompt 失敗:', err)
      alert('儲存失敗，請重試')
    }
  }

  const handleDeletePrompt = async (id: number) => {
    if (!confirm('確定要刪除這個 System Prompt 嗎？')) {
      return
    }

    try {
      // 調用 API 刪除 Prompt
      await axios.delete(`/api/prompts/${id}`)

      // 更新前端狀態
      const updatedPrompts = systemPrompts.filter(p => p.id !== id)
      setSystemPrompts(updatedPrompts)
    } catch (err) {
      console.error('刪除 Prompt 失敗:', err)
      alert('刪除失敗，請重試')
    }
  }

  const newsImages = selectedNews ? parseImages(selectedNews.images) : []

  // 網站選項
  const websiteOptions = Array.from(
    new Set(
      newsList
        .map((news) => news.sourceWebsite?.trim())
        .filter((url): url is string => !!url && url.length > 0)
    )
  )

  // 分類選項
  const categoryOptions = Array.from(
    new Set(
      newsList
        .flatMap(news => [
          ...(news.category_zh?.split('、') || []),
          ...(news.category_en?.split(', ') || [])
        ])
        .filter(Boolean)
    )
  ).sort()

  const normalizedKeyword = aiTitleKeyword.trim().toLowerCase()
  const processedKeyword = processedTitleKeyword.trim().toLowerCase()
  const filteredNews = newsList.filter((news) => {
    // 網站篩選
    const matchWebsite =
      aiWebsiteFilter === 'all' ||
      (news.sourceWebsite?.trim() || '') === aiWebsiteFilter

    // 分類篩選 (新增)
    const matchCategory =
      aiCategoryFilter === 'all' ||
      news.category_zh?.includes(aiCategoryFilter) ||
      news.category_en?.toLowerCase().includes(aiCategoryFilter.toLowerCase())

    // 關鍵字搜尋 (修改：支援標題與分類)
    const title = (news.title_translated || '').toLowerCase()
    const matchKeyword = normalizedKeyword === '' ||
      title.includes(normalizedKeyword) ||
      news.category_zh?.includes(normalizedKeyword) ||
      news.category_en?.toLowerCase().includes(normalizedKeyword)

    return matchWebsite && matchCategory && matchKeyword
  })
  const aiPreviewImages = aiPreviewNews ? parseImages(aiPreviewNews.images) : []

  const toggleAiNewsSelection = (id: number) => {
    setAiSelectedNewsIds((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((newsId) => newsId !== id) : [...prev, id]
      console.log('選擇的新聞 IDs:', newSelection)

      // 檢查選中的新聞是否都有 URL
      const selectedNews = newsList.filter(n => newSelection.includes(n.id))
      console.log('已選擇的新聞 URL 狀態:', selectedNews.map(n => ({
        id: n.id,
        title: n.title_translated?.substring(0, 30),
        hasUrl: !!n.url,
        url: n.url || '❌ 缺少 URL'
      })))

      return newSelection
    })
  }

  const toggleAiPromptSelection = (id: number) => {
    setAiSelectedPromptIds((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((promptId) => promptId !== id) : [...prev, id]
      console.log('選擇的 Prompt IDs:', newSelection)
      return newSelection
    })
  }

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('已複製到剪貼簿')
    } catch (err) {
      console.error('複製失敗:', err)
      alert('無法複製，請手動選取後複製')
    }
  }

  const handleAiSubmit = async () => {
    console.log('=== 送出按鈕被點擊 ===')
    console.log('選擇的新聞 IDs:', aiSelectedNewsIds)
    console.log('選擇的 Prompt IDs:', aiSelectedPromptIds)
    console.log('新聞列表長度:', newsList.length)
    console.log('System Prompts 長度:', systemPrompts.length)

    if (aiSelectedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }
    if (aiSelectedPromptIds.length === 0) {
      alert('請至少選擇一個 System Prompt')
      return
    }

    const selectedNewsItems = newsList.filter((news) => aiSelectedNewsIds.includes(news.id))
    const selectedPromptItems = systemPrompts.filter((prompt) => aiSelectedPromptIds.includes(prompt.id))

    console.log('篩選後的新聞項目數量:', selectedNewsItems.length)
    console.log('篩選後的新聞項目:', selectedNewsItems)

    // 🔍 明確檢查每則新聞的 URL
    console.log('=== 檢查每則新聞的 URL ===')
    selectedNewsItems.forEach((news, index) => {
      console.log(`新聞 ${index + 1} (ID: ${news.id}):`)
      console.log('  標題:', news.title_translated?.substring(0, 40))
      console.log('  有 URL?', !!news.url)
      console.log('  URL 值:', news.url)
      console.log('  ---')
    })

    console.log('篩選後的 Prompt 項目數量:', selectedPromptItems.length)
    console.log('篩選後的 Prompt 項目:', selectedPromptItems)

    // 檢查選中的新聞是否都有 URL
    const missingUrls = selectedNewsItems.filter((news) => !news.url)
    console.log('缺少 URL 的新聞數量:', missingUrls.length)
    if (missingUrls.length > 0) {
      console.log('❌ 有新聞缺少 URL，停止執行')
      alert(`有 ${missingUrls.length} 則新聞缺少 URL，無法處理`)
      return
    }
    console.log('✅ 所有新聞都有 URL')
    console.log('🚀 準備開始 AI 重寫流程...')

    console.log('🚀 開始設置處理狀態...')
    setAiProcessing(true)
    setNewsLoading(true)
    setError(null)
    setAiResult('')
    console.log('✅ 處理狀態已設置')

    try {
      const payload = {
        news_items: selectedNewsItems.map((news) => ({
          title_translated: news.title_translated,
          content_translated: news.content_translated,
          url: news.url,
        })),
        system_prompts: selectedPromptItems.map((prompt) => ({
          name: prompt.name,
          prompt: prompt.prompt,
        })),
      }

      console.log('=== 準備發送請求 ===')
      console.log('API URL:', 'http://localhost:8000/api/ai-rewrite')
      console.log('送出 AI 重寫請求 payload:', payload)

      const response = await axios.post('/api/ai-rewrite', payload)

      console.log('=== 收到回應 ===')
      console.log('回應狀態:', response.status)
      console.log('回應資料:', response.data)

      const { total, success, failed, results } = response.data

      // 顯示結果
      let resultMessage = `處理完成！\n\n總計：${total} 則\n成功：${success} 則\n失敗：${failed} 則\n\n`

      if (failed > 0) {
        resultMessage += '失敗的項目：\n'
        results.forEach((result: any) => {
          if (!result.success) {
            resultMessage += `- ${result.url}: ${result.error}\n`
          }
        })
      }

      setAiResult(JSON.stringify(response.data, null, 2))
      alert(resultMessage)

      // 重新載入新聞列表以顯示更新後的資料
      await fetchNews()
      // 同時更新處理後新聞列表
      await fetchProcessedNews()

    } catch (err: any) {
      console.error('AI 重寫失敗:', err)
      const errorMsg = err.response?.data?.detail || err.message || '未知錯誤'
      setError(`AI 重寫失敗: ${errorMsg}`)
      alert(`處理失敗：${errorMsg}`)
    } finally {
      setNewsLoading(false)
      setAiProcessing(false)
    }
  }

  const toggleProcessedNewsSelection = (id: number) => {
    setSelectedProcessedNewsIds((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((newsId) => newsId !== id) : [...prev, id]
      console.log('選擇要發布的新聞 IDs:', newSelection)
      return newSelection
    })
  }

  const handleWordPressPublish = async () => {
    if (selectedProcessedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }

    if (selectedWordpressAccounts.length === 0) {
      alert('請至少選擇一個 WordPress 帳號')
      return
    }

    // Temporarily remove confirm dialog for debugging
    // if (!confirm(`確定要發布 ${selectedProcessedNewsIds.length} 則新聞到 WordPress 嗎？`)) {
    //   return
    // }

    setWordpressPublishing(true)
    setError(null)

    try {
      // 準備發布的項目，包含選定的圖片
      const publishItems = selectedProcessedNewsIds.map(id => {
        // 找出該新聞
        const news = processedNewsList.find(n => n.id === id)
        // 找出選定的圖片，如果沒有選定，則使用該新聞的第一張圖片
        let selectedImage = selectedProcessedImages[id]

        if (!selectedImage && news && news.images) {
          const images = parseImages(news.images)
          if (images.length > 0) {
            selectedImage = images[0]
          }
        }

        return {
          news_id: id,
          selected_image: selectedImage
        }
      })

      console.log('發布新聞到 WordPress，Items:', publishItems)
      console.log('選擇的帳號:', selectedWordpressAccounts)

      const response = await axios.post('/api/wordpress-publish', {
        items: publishItems,
        account_ids: selectedWordpressAccounts  // 新增：傳送選擇的多個帳號ID
      })

      const { total, success, failed, results } = response.data

      // 顯示結果
      let resultMessage = `發布完成！\n\n總計：${total} 則\n成功：${success} 則\n失敗：${failed} 則\n\n`

      if (success > 0) {
        resultMessage += '成功發布的新聞：\n'
        results.forEach((result: any) => {
          if (result.success) {
            resultMessage += `- [${result.account_name || 'WordPress'}] ID ${result.news_id}: ${result.wordpress_post_url}\n`
          }
        })
      }

      if (failed > 0) {
        resultMessage += '\n失敗的項目：\n'
        results.forEach((result: any) => {
          if (!result.success) {
            resultMessage += `- ID ${result.news_id}: ${result.error}\n`
          }
        })
      }

      alert(resultMessage)

      // 清空選擇
      setSelectedProcessedNewsIds([])
      setSelectedProcessedImages({})

    } catch (err: any) {
      console.error('發布到 WordPress 失敗:', err)
      const detail = err.response?.data?.detail
      const errorMsg = (typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null) || err.message || '未知錯誤'
      setError(`發布到 WordPress 失敗: ${errorMsg}`)
      throw new Error(errorMsg)
    } finally {
      setWordpressPublishing(false)
    }
  }

  const handlePixnetPublish = async () => {
    if (selectedProcessedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }

    // Temporarily remove confirm dialog for debugging
    // if (!confirm(`確定要發布 ${selectedProcessedNewsIds.length} 則新聞到 PIXNET 痞客邦嗎？`)) {
    //   return
    // }

    setPixnetPublishing(true)
    setError(null)

    try {
      console.log('發布新聞到 PIXNET，IDs:', selectedProcessedNewsIds)

      const response = await axios.post('/api/pixnet-publish', {
        news_ids: selectedProcessedNewsIds,
        status: 'draft'  // 預設為草稿
      })

      const { total, success, failed, results } = response.data

      // 顯示結果
      let resultMessage = `PIXNET 發布完成！\n\n總計：${total} 則\n成功：${success} 則\n失敗：${failed} 則\n\n`

      if (success > 0) {
        resultMessage += '成功發布的新聞：\n'
        results.forEach((result: any) => {
          if (result.success) {
            resultMessage += `- ID ${result.news_id}: ${result.pixnet_article_url || '(草稿)'}\n`
          }
        })
      }

      if (failed > 0) {
        resultMessage += '\n失敗的項目：\n'
        results.forEach((result: any) => {
          if (!result.success) {
            resultMessage += `- ID ${result.news_id}: ${result.error}\n`
          }
        })
      }

      alert(resultMessage)

      // 清空選擇
      setSelectedProcessedNewsIds([])

    } catch (err: any) {
      console.error('發布到 PIXNET 失敗:', err)
      const detail = err.response?.data?.detail
      const errorMsg = (typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null) || err.message || '未知錯誤'
      setError(`發布到 PIXNET 失敗: ${errorMsg}`)
      throw new Error(errorMsg)
    } finally {
      setPixnetPublishing(false)
    }
  }

  const handleFacebookPublish = async (silent = false) => {
    if (selectedProcessedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }
    if (selectedFacebookAccounts.length === 0) {
      alert('請至少選擇一個 Facebook 粉絲團')
      return
    }

    setFacebookPublishing(true)
    setError(null)

    try {
      // 準備發布的項目，包含選定的圖片
      const publishItems = selectedProcessedNewsIds.map(id => {
        // 找出該新聞
        const news = processedNewsList.find(n => n.id === id)
        // 找出選定的圖片，如果沒有選定，則使用該新聞的第一張圖片
        let selectedImage = selectedProcessedImages[id]

        if (!selectedImage && news && news.images) {
          const images = parseImages(news.images)
          if (images.length > 0) {
            selectedImage = images[0]
          }
        }

        return {
          news_id: id,
          selected_image: selectedImage
        }
      })

      console.log('發布新聞到 Facebook，Items:', publishItems)

      const response = await axios.post('/api/facebook-publish', {
        items: publishItems,
        account_ids: selectedFacebookAccounts // 指定要使用的 Facebook 帳號 ID 陣列
      })

      const { total, success, failed, results } = response.data

      // 顯示結果
      let resultMessage = `Facebook 發布完成！\n\n總計：${total} 則\n成功：${success} 則\n失敗：${failed} 則\n\n`

      results.forEach((result: any) => {
        if (result.success) {
          resultMessage += `✅ [${result.account_name || 'Facebook'}] ID ${result.news_id}: ${result.facebook_post_url || '(已發布)'}\n`
        } else {
          resultMessage += `❌ ID ${result.news_id}: ${result.error}\n`
        }
      })

      if (!silent) alert(resultMessage)

      // 只有全部成功才清空選擇
      if (failed === 0) {
        setSelectedProcessedNewsIds([])
        setSelectedProcessedImages({})
      }

      // 若有任何失敗，拋出錯誤讓多平台發布正確標記
      if (failed > 0) {
        throw new Error(`Facebook 發布部分失敗：${failed} 則失敗，${success} 則成功`)
      }

    } catch (err: any) {
      console.error('發布到 Facebook 失敗:', err)
      const detail = err.response?.data?.detail
      const errorMsg = (typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null) || err.message || '未知錯誤'
      setError(`發布到 Facebook 失敗: ${errorMsg}`)
      throw new Error(errorMsg)
    } finally {
      setFacebookPublishing(false)
    }
  }

  const handleThreadsPublish = async () => {
    if (selectedProcessedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }

    setThreadsPublishing(true)
    setError(null)

    try {
      // 準備發布的項目，包含選定的圖片
      const publishItems = selectedProcessedNewsIds.map(id => {
        // 找出該新聞
        const news = processedNewsList.find(n => n.id === id)
        // 找出選定的圖片，如果沒有選定，則使用該新聞的第一張圖片
        let selectedImage = selectedProcessedImages[id]

        if (!selectedImage && news && news.images) {
          const images = parseImages(news.images)
          if (images.length > 0) {
            selectedImage = images[0]
          }
        }

        return {
          news_id: id,
          selected_image: selectedImage
        }
      })

      console.log('發布新聞到 Threads，Items:', publishItems)

      const response = await axios.post('/api/threads-publish', {
        items: publishItems,
        account_ids: selectedThreadsAccounts
      })

      const { total, success, failed, results } = response.data

      // 顯示結果
      let resultMessage = `Threads 發布完成！\n\n總計：${total} 則\n成功：${success} 則\n失敗：${failed} 則\n\n`

      if (success > 0) {
        resultMessage += '成功發布的新聞：\n'
        results.forEach((result: any) => {
          if (result.success) {
            resultMessage += `- ID ${result.news_id}: ${result.threads_post_id || '(已發布)'}\n`
          }
        })
      }

      if (failed > 0) {
        resultMessage += '\n失敗的項目：\n'
        results.forEach((result: any) => {
          if (!result.success) {
            resultMessage += `- ID ${result.news_id}: ${result.error}\n`
          }
        })
      }

      alert(resultMessage)

      // 清空選擇
      setSelectedProcessedNewsIds([])
      setSelectedProcessedImages({})

    } catch (err: any) {
      console.error('發布到 Threads 失敗:', err)
      const errorMsg = err.response?.data?.detail || err.message || '未知錯誤'
      setError(`發布到 Threads 失敗: ${errorMsg}`)
      alert(`發布失敗：${errorMsg}`)
    } finally {
      setThreadsPublishing(false)
    }
  }

  const handleInstagramPublish = async (silent = false) => {
    if (selectedProcessedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }

    if (selectedInstagramAccounts.length === 0) {
      alert('請至少選擇一個 Instagram 帳號')
      return
    }

    setInstagramPublishing(true)
    setError(null)

    try {
      // 準備發布的項目，包含選定的圖片
      const publishItems = selectedProcessedNewsIds.map(id => ({
        news_id: id,
        selected_image: selectedProcessedImages[id] || null
      }))

      console.log('發布新聞到 Instagram，Items:', publishItems)
      const response = await axios.post('/api/instagram-publish', {
        items: publishItems,
        account_ids: selectedInstagramAccounts
      })

      const { total, success, failed, results } = response.data
      let resultMessage = `Instagram 發布完成！\n\n總計任務：${total}\n成功：${success}\n失敗：${failed}\n\n`

      results.forEach((result: any) => {
        if (result.success) {
          resultMessage += `✅ [${result.account_name}] ID ${result.news_id}: ${result.instagram_post_url || '(已發布)'}\n`
        } else {
          resultMessage += `❌ [${result.account_name}] ID ${result.news_id} 失敗: ${result.error}\n`
        }
      })

      if (!silent) alert(resultMessage)

      // 如果全部成功，清除選擇
      if (failed === 0) {
        setSelectedProcessedNewsIds([])
        setSelectedProcessedImages({})
      }

      // 若有任何失敗，拋出錯誤讓多平台發布正確標記
      if (failed > 0) {
        throw new Error(`Instagram 發布部分失敗：${failed} 則失敗，${success} 則成功`)
      }
    } catch (err: any) {
      console.error('發布到 Instagram 失敗:', err)
      const detail = err.response?.data?.detail
      const errorMsg = (typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null) || err.message || '未知錯誤'
      setError(`發布到 Instagram 失敗: ${errorMsg}`)
      throw new Error(errorMsg)
    } finally {
      setInstagramPublishing(false)
    }
  }

  // 分類編輯相關函數
  const handleEditCategory = (news: NewsItem) => {
    setEditingCategoryId(news.id)
    setEditCategoryZh(news.category_zh || '')
    setEditCategoryEn(news.category_en || '')
  }

  const handleSaveCategory = async (newsId: number) => {
    try {
      await axios.patch(`/api/news/${newsId}/category`, null, {
        params: {
          category_zh: editCategoryZh,
          category_en: editCategoryEn
        }
      })

      // 更新本地列表
      setNewsList(prev =>
        prev.map(item =>
          item.id === newsId
            ? { ...item, category_zh: editCategoryZh, category_en: editCategoryEn }
            : item
        )
      )

      // 也更新處理後新聞列表
      setProcessedNewsList(prev =>
        prev.map(item =>
          item.id === newsId
            ? { ...item, category_zh: editCategoryZh, category_en: editCategoryEn }
            : item
        )
      )

      setEditingCategoryId(null)
      alert('分類更新成功')
    } catch (err) {
      console.error('更新分類失敗:', err)
      alert('更新失敗，請重試')
    }
  }

  const handleCancelEdit = () => {
    setEditingCategoryId(null)
    setEditCategoryZh('')
    setEditCategoryEn('')
  }

  // 多平台發布處理
  const handleMultiPlatformPublish = async () => {
    if (selectedProcessedNewsIds.length === 0) {
      alert('請至少選擇一則新聞')
      return
    }

    const platformsToPublish = Object.entries(selectedPlatforms).filter(([_, selected]) => selected)

    if (platformsToPublish.length === 0) {
      alert('請至少選擇一個發布平台')
      return
    }

    setIsMultiPlatformPublishing(true)
    setError(null)

    const results: any[] = []

    // 按順序發布到各個平台
    for (const [platform, _] of platformsToPublish) {
      try {
        console.log(`正在發布到 ${platform}...`)

        switch (platform) {
          case 'wordpress':
            setWordpressPublishing(true)
            await handleWordPressPublish()
            setWordpressPublishing(false)
            results.push({ platform: 'WordPress', success: true })
            break

          case 'pixnet':
            setPixnetPublishing(true)
            await handlePixnetPublish()
            setPixnetPublishing(false)
            results.push({ platform: 'PIXNET', success: true })
            break

          case 'facebook':
            setFacebookPublishing(true)
            await handleFacebookPublish(true)
            setFacebookPublishing(false)
            results.push({ platform: 'Facebook', success: true })
            break

          case 'threads':
            setThreadsPublishing(true)
            await handleThreadsPublish()
            setThreadsPublishing(false)
            results.push({ platform: 'Threads', success: true })
            break

          case 'instagram':
            setInstagramPublishing(true)
            await handleInstagramPublish(true)
            setInstagramPublishing(false)
            results.push({ platform: 'Instagram', success: true })
            break
        }
      } catch (err: any) {
        console.error(`發布到 ${platform} 失敗:`, err)
        results.push({ platform, success: false, error: err.message })
      }
    }

    setIsMultiPlatformPublishing(false)

    // 顯示總結
    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    let summary = `多平台發布完成！\n\n總計：${results.length} 個平台\n成功：${successCount} 個\n失敗：${failCount} 個\n\n`

    results.forEach(r => {
      summary += `${r.success ? '✅' : '❌'} ${r.platform}${r.error ? `: ${r.error}` : ''}\n`
    })

    alert(summary)
  }

  return (
    <div className="container">
      <div className="header">
        <h1>新聞發布系統</h1>
        <p>管理新聞內容和 System Prompt 設定</p>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          原始新聞列表
        </button>
        <button
          className={`tab-button ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          新聞發佈 System Prompt 設定專區
        </button>
        <button
          className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI 寫新聞
        </button>
        <button
          className={`tab-button ${activeTab === 'processed' ? 'active' : ''}`}
          onClick={() => setActiveTab('processed')}
        >
          處理後新聞列表
        </button>
        <button
          className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('admin')
            fetchAutoConfig()
            fetchAutoStatus()
          }}
          style={{ background: activeTab === 'admin' ? 'linear-gradient(135deg, #f093fb, #f5576c)' : undefined }}
        >
          🤖 自動發文監控
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {activeTab === 'news' && (
        <div className="ai-section">
          <h2>原始新聞列表</h2>
          <p className="ai-note">
            顯示所有來自允許來源且包含圖片的新聞。
          </p>

          {newsLoading ? (
            <div className="loading">載入中...</div>
          ) : (
            <>
              {selectedNews ? (
                <div className="news-preview">
                  <button
                    className="btn btn-primary"
                    onClick={() => setSelectedNews(null)}
                    style={{ marginBottom: '20px' }}
                  >
                    ← 返回列表
                  </button>
                  <h2>{selectedNews.title_translated || '無標題'}</h2>
                  <div className="content">
                    {selectedNews.content_translated || '無內容'}
                  </div>
                  {newsImages.length > 0 && (
                    <div className="news-images">
                      {newsImages.map((img, index) => (
                        <img key={index} src={img} alt={`新聞圖片 ${index + 1}`} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* 篩選器 */}
                  <div className="ai-filters">
                    <div className="form-group">
                      <label htmlFor="news-website-filter">篩選網站</label>
                      <select
                        id="news-website-filter"
                        value={newsWebsiteFilter}
                        onChange={(e) => setNewsWebsiteFilter(e.target.value)}
                      >
                        <option value="all">全部網站</option>
                        {Array.from(new Set(newsList.map((news) => news.sourceWebsite).filter(Boolean))).map(
                          (website) => (
                            <option key={website} value={website || ''}>
                              {website}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="news-category-filter">篩選分類</label>
                      <select
                        id="news-category-filter"
                        value={newsCategoryFilter}
                        onChange={(e) => setNewsCategoryFilter(e.target.value)}
                      >
                        <option value="all">全部分類</option>
                        {Array.from(
                          new Set(
                            newsList
                              .flatMap(news => [
                                ...(news.category_zh?.split('、') || []),
                                ...(news.category_en?.split(', ') || [])
                              ])
                              .filter(Boolean)
                          )
                        ).sort().map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="news-title-filter">標題/分類關鍵字</label>
                      <input
                        id="news-title-filter"
                        type="text"
                        value={newsTitleKeyword}
                        onChange={(e) => setNewsTitleKeyword(e.target.value)}
                        placeholder="搜尋標題或分類..."
                      />
                    </div>
                  </div>

                  {newsList.length === 0 ? (
                    <div className="empty-state">目前沒有新聞資料</div>
                  ) : (
                    <>
                      {(() => {
                        const filteredNews = newsList.filter((news) => {
                          // 1. 網站篩選
                          const websiteMatch = newsWebsiteFilter === 'all' || news.sourceWebsite === newsWebsiteFilter

                          // 2. 分類篩選
                          const categoryMatch = newsCategoryFilter === 'all' ||
                            news.category_zh?.includes(newsCategoryFilter) ||
                            news.category_en?.toLowerCase().includes(newsCategoryFilter.toLowerCase())

                          // 3. 標題/分類關鍵字搜尋
                          const keyword = newsTitleKeyword.toLowerCase()
                          const titleMatch = !newsTitleKeyword ||
                            news.title_translated?.toLowerCase().includes(keyword) ||
                            news.category_zh?.includes(newsTitleKeyword) ||
                            news.category_en?.toLowerCase().includes(keyword)

                          return websiteMatch && categoryMatch && titleMatch
                        })

                        if (filteredNews.length === 0) {
                          return <div className="empty-state">沒有符合篩選條件的新聞</div>
                        }

                        return (
                          <div className="news-grid">
                            {filteredNews.map((news) => (
                              <div
                                key={news.id}
                                className="news-card"
                                onClick={() => handleNewsClick(news)}
                              >
                                <h3>{news.title_translated || '無標題'}</h3>
                                <p>
                                  {news.content_translated
                                    ? news.content_translated.substring(0, 150) + '...'
                                    : '無內容'}
                                </p>
                                {/* 分類顯示與編輯區域 */}
                                <div style={{ marginTop: '10px' }}>
                                  {editingCategoryId === news.id ? (
                                    // 編輯模式
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      <input
                                        type="text"
                                        value={editCategoryZh}
                                        onChange={(e) => setEditCategoryZh(e.target.value)}
                                        placeholder="中文分類"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          flex: '1 1 120px',
                                          padding: '4px 8px',
                                          border: '1px solid #ccc',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          minWidth: '0'
                                        }}
                                      />
                                      <input
                                        type="text"
                                        value={editCategoryEn}
                                        onChange={(e) => setEditCategoryEn(e.target.value)}
                                        placeholder="Category"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          flex: '1 1 120px',
                                          padding: '4px 8px',
                                          border: '1px solid #ccc',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          minWidth: '0'
                                        }}
                                      />
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleSaveCategory(news.id); }}
                                          style={{
                                            padding: '4px 8px',
                                            background: '#4caf50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                          style={{
                                            padding: '4px 8px',
                                            background: '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          ✗
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    // 顯示模式
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      {news.category_zh || news.category_en ? (
                                        <>
                                          <span style={{ color: '#666', fontSize: '12px', fontWeight: '500' }}>分類：</span>
                                          {news.category_zh && (
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '2px 8px',
                                              background: '#e3f2fd',
                                              color: '#1976d2',
                                              borderRadius: '10px',
                                              fontSize: '11px',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {news.category_zh}
                                            </span>
                                          )}
                                          {news.category_en && (
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '2px 8px',
                                              background: '#f3e5f5',
                                              color: '#7b1fa2',
                                              borderRadius: '10px',
                                              fontSize: '11px',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {news.category_en}
                                            </span>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleEditCategory(news); }}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              fontSize: '14px',
                                              padding: '0 4px',
                                              lineHeight: '1'
                                            }}
                                            title="編輯分類"
                                          >
                                            🖊️
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleEditCategory(news); }}
                                          style={{
                                            padding: '4px 10px',
                                            background: '#2196f3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px'
                                          }}
                                        >
                                          + 新增分類
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="prompt-section">
          <h2>新增 System Prompt</h2>
          <form className="prompt-form" onSubmit={handleCreatePrompt}>
            <div className="form-group">
              <label htmlFor="prompt-name">Prompt 名稱：</label>
              <input
                id="prompt-name"
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="例如：新聞標題生成"
              />
            </div>
            <div className="form-group">
              <label htmlFor="prompt-content">Prompt 內容：</label>
              <textarea
                id="prompt-content"
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="輸入您的 system prompt..."
              />
            </div>
            <button type="submit" className="btn btn-primary">
              儲存 System Prompt
            </button>
          </form>

          <div className="prompt-list">
            <h2>System Prompts 列表（雲端同步）</h2>
            {systemPrompts.length === 0 ? (
              <div className="empty-state">目前沒有儲存的 System Prompts</div>
            ) : (
              systemPrompts.map((prompt) => (
                <div key={prompt.id} className="prompt-item">
                  <h3>{prompt.name}</h3>
                  <p>{prompt.prompt}</p>
                  <div className="prompt-actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeletePrompt(prompt.id)}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="ai-section">
          <h2>AI 寫新聞</h2>
          <p className="ai-note">
            勾選要處理的新聞與 System Prompt，點擊送出後會彙整資料並自動複製，方便貼給 AI 生成新聞稿。
          </p>

          {newsLoading && newsList.length === 0 ? (
            <div className="loading">載入中...</div>
          ) : (
            <>
              <div className="ai-filters">
                <div className="form-group">
                  <label htmlFor="ai-website-filter">篩選網站</label>
                  <select
                    id="ai-website-filter"
                    value={aiWebsiteFilter}
                    onChange={(e) => setAiWebsiteFilter(e.target.value)}
                  >
                    <option value="all">全部網站</option>
                    {websiteOptions.map((url) => (
                      <option key={url} value={url}>
                        {url}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="ai-category-filter">篩選分類</label>
                  <select
                    id="ai-category-filter"
                    value={aiCategoryFilter}
                    onChange={(e) => setAiCategoryFilter(e.target.value)}
                  >
                    <option value="all">全部分類</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="ai-title-filter">標題/分類關鍵字</label>
                  <input
                    id="ai-title-filter"
                    type="text"
                    value={aiTitleKeyword}
                    onChange={(e) => setAiTitleKeyword(e.target.value)}
                    placeholder="搜尋標題或分類..."
                  />
                </div>
              </div>

              <div className="ai-multi-section">
                <div className="ai-multi-header">
                  <h3>選擇新聞</h3>
                  <span className="ai-count">已選擇 {aiSelectedNewsIds.length} 則</span>
                </div>
                {newsList.length === 0 ? (
                  <div className="empty-state">目前沒有可選擇的新聞</div>
                ) : filteredNews.length === 0 ? (
                  <div className="empty-state">沒有符合條件的新聞，請調整篩選條件</div>
                ) : (
                  <div className="ai-multi-list">
                    {filteredNews.map((news) => {
                      const isChecked = aiSelectedNewsIds.includes(news.id)
                      const thumbnails = news.images ? parseImages(news.images).slice(0, 3) : []
                      return (
                        <div
                          key={news.id}
                          className={`ai-item ${isChecked ? 'selected' : ''}`}
                          onClick={() => toggleAiNewsSelection(news.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleAiNewsSelection(news.id)
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAiNewsSelection(news.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="ai-item-body">
                            <div className="ai-item-title">
                              {news.title_translated || `新聞 #${news.id}`}
                            </div>
                            <div className="ai-thumbnail-row">
                              {thumbnails.length > 0 ? (
                                thumbnails.map((img, index) => (
                                  <img key={index} src={img} alt={`新聞圖片預覽 ${index + 1}`} />
                                ))
                              ) : (
                                <span className="ai-thumbnail-placeholder">無圖片</span>
                              )}
                            </div>
                            {/* 分類標籤顯示 (右下角) */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '6px', flexWrap: 'wrap' }}>
                              {news.category_zh && (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  background: '#e3f2fd',
                                  color: '#1976d2',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {news.category_zh}
                                </span>
                              )}
                              {news.category_en && (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  background: '#f3e5f5',
                                  color: '#7b1fa2',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {news.category_en}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAiPreviewNews(news)
                              setSelectedNews(null)
                            }}
                          >
                            預覽
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="ai-multi-section">
                <div className="ai-multi-header">
                  <h3>選擇 System Prompt</h3>
                  <span className="ai-count">已選擇 {aiSelectedPromptIds.length} 個</span>
                </div>
                {systemPrompts.length === 0 ? (
                  <div className="empty-state">目前沒有儲存的 System Prompt</div>
                ) : (
                  <div className="ai-multi-list">
                    {systemPrompts.map((prompt) => {
                      const isChecked = aiSelectedPromptIds.includes(prompt.id)
                      return (
                        <div
                          key={prompt.id}
                          className={`ai-item ${isChecked ? 'selected' : ''}`}
                          onClick={() => toggleAiPromptSelection(prompt.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleAiPromptSelection(prompt.id)
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAiPromptSelection(prompt.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="ai-item-body">
                            <div className="ai-item-title">{prompt.name}</div>
                            <div className="ai-item-content ai-item-content--prompt">
                              {prompt.prompt}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyToClipboard(prompt.prompt)
                            }}
                          >
                            複製
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>


              <div className="ai-submit-bar">
                <button
                  type="button"
                  className={`btn btn-primary ${aiProcessing ? 'btn-loading' : ''}`}
                  onClick={() => {
                    console.log('=== 按鈕點擊事件觸發 ===')
                    console.log('aiSelectedNewsIds:', aiSelectedNewsIds)
                    console.log('aiSelectedPromptIds:', aiSelectedPromptIds)
                    handleAiSubmit()
                  }}
                  disabled={aiProcessing}
                  style={{
                    opacity: (aiSelectedNewsIds.length === 0 || aiSelectedPromptIds.length === 0 || aiProcessing) ? 0.7 : 1,
                    cursor: aiProcessing ? 'wait' : 'pointer',
                    backgroundColor: (aiSelectedNewsIds.length > 0 && aiSelectedPromptIds.length > 0) ? '#667eea' : '#999'
                  }}
                >
                  {aiProcessing ? '處理中...' : `送出 (${aiSelectedNewsIds.length > 0 && aiSelectedPromptIds.length > 0 ? '可點擊' : '未啟用'})`}
                </button>
                <div className="ai-submit-hint">
                  需至少選擇 1 則新聞與 1 個 System Prompt。
                  <br />
                  <small style={{ color: aiSelectedNewsIds.length > 0 && aiSelectedPromptIds.length > 0 ? 'green' : 'red' }}>
                    已選擇：{aiSelectedNewsIds.length} 則新聞，{aiSelectedPromptIds.length} 個 Prompt
                    {aiSelectedNewsIds.length > 0 && aiSelectedPromptIds.length > 0 ? ' ✓ 可以送出' : ' ✗ 請繼續選擇'}
                  </small>
                </div>
              </div>

              {aiResult && (
                <div className="ai-result">
                  <div className="ai-result-header">
                    <h3>送出內容</h3>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleCopyToClipboard(aiResult)}
                    >
                      再次複製
                    </button>
                  </div>
                  <textarea readOnly value={aiResult} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'processed' && (
        <div className="ai-section">
          <h2>處理後新聞列表</h2>
          <p className="ai-note">
            顯示已由 AI 重寫完成的新聞，包含重寫後的標題與內容。選擇要發布的新聞。
          </p>

          {processedLoading ? (
            <div className="loading">載入中...</div>
          ) : (
            <>
              {/* 篩選器 */}
              <div className="ai-filters">
                <div className="form-group">
                  <label htmlFor="processed-website-filter">篩選網站</label>
                  <select
                    id="processed-website-filter"
                    value={processedWebsiteFilter}
                    onChange={(e) => setProcessedWebsiteFilter(e.target.value)}
                  >
                    <option value="all">全部網站</option>
                    {Array.from(new Set(processedNewsList.map((news) => news.sourceWebsite).filter(Boolean))).map(
                      (website) => (
                        <option key={website} value={website || ''}>
                          {website}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="processed-category-filter">篩選分類</label>
                  <select
                    id="processed-category-filter"
                    value={processedCategoryFilter}
                    onChange={(e) => setProcessedCategoryFilter(e.target.value)}
                  >
                    <option value="all">全部分類</option>
                    {Array.from(
                      new Set(
                        processedNewsList
                          .flatMap(news => [
                            ...(news.category_zh?.split('、') || []),
                            ...(news.category_en?.split(', ') || [])
                          ])
                          .filter(Boolean)
                      )
                    ).sort().map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="processed-title-filter">標題/分類關鍵字</label>
                  <input
                    id="processed-title-filter"
                    type="text"
                    value={processedTitleKeyword}
                    onChange={(e) => setProcessedTitleKeyword(e.target.value)}
                    placeholder="搜尋標題或分類..."
                  />
                </div>
              </div>

              {processedNewsList.length === 0 ? (
                <div className="empty-state">目前沒有處理完成的新聞</div>
              ) : (
                <>
                  {(() => {
                    const filteredProcessed = processedNewsList.filter((news) => {
                      // 網站篩選
                      const websiteMatch =
                        processedWebsiteFilter === 'all' || news.sourceWebsite === processedWebsiteFilter

                      // 分類篩選
                      const categoryMatch =
                        processedCategoryFilter === 'all' ||
                        news.category_zh?.includes(processedCategoryFilter) ||
                        news.category_en?.toLowerCase().includes(processedCategoryFilter.toLowerCase())

                      // 標題/分類關鍵字搜尋
                      const keyword = processedTitleKeyword.toLowerCase()
                      const keywordMatch =
                        !processedTitleKeyword ||
                        news.title_modified?.toLowerCase().includes(keyword) ||
                        news.category_zh?.includes(processedTitleKeyword) ||
                        news.category_en?.toLowerCase().includes(keyword)

                      return websiteMatch && categoryMatch && keywordMatch
                    })

                    if (filteredProcessed.length === 0) {
                      return <div className="empty-state">沒有符合篩選條件的新聞</div>
                    }

                    return (
                      <>
                        {selectedProcessedNews ? (
                          <div className="news-preview">
                            <button
                              className="btn btn-primary"
                              onClick={() => setSelectedProcessedNews(null)}
                              style={{ marginBottom: '20px' }}
                            >
                              ← 返回列表
                            </button>
                            <div>
                              <h3 style={{ color: '#764ba2', marginBottom: '10px' }}>AI 重寫結果</h3>
                              <h4>{selectedProcessedNews.title_modified || '無標題'}</h4>
                              <div className="content">
                                {selectedProcessedNews.content_modified || '無內容'}
                              </div>
                            </div>
                            {selectedProcessedNews.images && parseImages(selectedProcessedNews.images).length > 0 && (
                              <div className="news-images" style={{ marginTop: '30px' }}>
                                {parseImages(selectedProcessedNews.images).map((img, index) => (
                                  <img key={index} src={img} alt={`新聞圖片 ${index + 1}`} />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* 發布按鈕區 */}
                            {/* 多平台選擇區 */}
                            <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                              <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>選擇發布平台：</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                                {/* WordPress */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #eee' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedPlatforms.wordpress}
                                      onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, wordpress: e.target.checked })}
                                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 500, color: '#667eea', marginLeft: '8px' }}>WordPress</span>
                                  </label>
                                  {selectedPlatforms.wordpress && wordpressAccounts.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '26px' }}>
                                      {wordpressAccounts.map((account) => (
                                        <label key={account.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#555' }}>
                                          <input
                                            type="checkbox"
                                            checked={selectedWordpressAccounts.includes(account.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedWordpressAccounts([...selectedWordpressAccounts, account.id])
                                              } else {
                                                setSelectedWordpressAccounts(selectedWordpressAccounts.filter(a => a !== account.id))
                                              }
                                            }}
                                            style={{ cursor: 'pointer', margin: 0 }}
                                          />
                                          {account.name}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* PIXNET */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #eee' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedPlatforms.pixnet}
                                      onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, pixnet: e.target.checked })}
                                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 500, color: '#ff6b35', marginLeft: '8px' }}>PIXNET</span>
                                  </label>
                                </div>

                                {/* Facebook */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #eee' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedPlatforms.facebook}
                                      onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, facebook: e.target.checked })}
                                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 500, color: '#4267B2', marginLeft: '8px' }}>Facebook</span>
                                  </label>
                                  {selectedPlatforms.facebook && facebookAccounts.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '26px' }}>
                                      {facebookAccounts.map((account) => (
                                        <label key={account.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#555' }}>
                                          <input
                                            type="checkbox"
                                            checked={selectedFacebookAccounts.includes(account.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedFacebookAccounts([...selectedFacebookAccounts, account.id])
                                              } else {
                                                setSelectedFacebookAccounts(selectedFacebookAccounts.filter(a => a !== account.id))
                                              }
                                            }}
                                            style={{ cursor: 'pointer', margin: 0 }}
                                          />
                                          {account.name}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Threads */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #eee' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedPlatforms.threads}
                                      onChange={(e) => {
                                        setSelectedPlatforms({ ...selectedPlatforms, threads: e.target.checked });
                                        if (e.target.checked && threadsAccounts.length > 0) {
                                          setSelectedThreadsAccounts(threadsAccounts.map(acc => acc.id));
                                        } else {
                                          setSelectedThreadsAccounts([]);
                                        }
                                      }}
                                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 500, color: '#000000', marginLeft: '8px' }}>Threads</span>
                                  </label>

                                  {selectedPlatforms.threads && threadsAccounts.length > 0 && (
                                    <div style={{ paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {threadsAccounts.map(account => (
                                        <label key={account.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                                          <input
                                            type="checkbox"
                                            checked={selectedThreadsAccounts.includes(account.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedThreadsAccounts([...selectedThreadsAccounts, account.id]);
                                              } else {
                                                setSelectedThreadsAccounts(selectedThreadsAccounts.filter(id => id !== account.id));
                                              }
                                            }}
                                            style={{ cursor: 'pointer', marginRight: '8px' }}
                                          />
                                          {account.name}
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {selectedPlatforms.threads && threadsAccounts.length === 0 && (
                                    <div style={{ paddingLeft: '26px', fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                                      未設定帳號
                                    </div>
                                  )}
                                </div>

                                {/* Instagram */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #eee' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedPlatforms.instagram}
                                      onChange={(e) => {
                                        setSelectedPlatforms({ ...selectedPlatforms, instagram: e.target.checked });
                                        // 全選/取消全選帳號
                                        if (e.target.checked && instagramAccounts.length > 0) {
                                          setSelectedInstagramAccounts(instagramAccounts.map(acc => acc.id));
                                        } else {
                                          setSelectedInstagramAccounts([]);
                                        }
                                      }}
                                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 500, color: '#E4405F', marginLeft: '8px' }}>Instagram</span>
                                  </label>

                                  {selectedPlatforms.instagram && instagramAccounts.length > 0 && (
                                    <div style={{ paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {instagramAccounts.map(account => (
                                        <label key={account.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                                          <input
                                            type="checkbox"
                                            checked={selectedInstagramAccounts.includes(account.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedInstagramAccounts([...selectedInstagramAccounts, account.id]);
                                              } else {
                                                setSelectedInstagramAccounts(selectedInstagramAccounts.filter(id => id !== account.id));
                                              }
                                            }}
                                            style={{ cursor: 'pointer', marginRight: '8px' }}
                                          />
                                          {account.name}
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {selectedPlatforms.instagram && instagramAccounts.length === 0 && (
                                    <div style={{ paddingLeft: '26px', fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                                      未設定帳號
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 統一發布按鈕 */}
                            <button
                              type="button"
                              className={`btn btn-primary ${isMultiPlatformPublishing ? 'btn-loading' : ''}`}
                              onClick={handleMultiPlatformPublish}
                              disabled={isMultiPlatformPublishing || selectedProcessedNewsIds.length === 0}
                              style={{
                                opacity: selectedProcessedNewsIds.length === 0 || isMultiPlatformPublishing ? 0.7 : 1,
                                cursor: isMultiPlatformPublishing ? 'wait' : 'pointer',
                                backgroundColor: selectedProcessedNewsIds.length > 0 ? '#764ba2' : '#999',
                                background: selectedProcessedNewsIds.length > 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#999',
                                color: 'white',
                                border: 'none',
                                padding: '12px 30px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                width: '100%',
                                maxWidth: '400px',
                                marginBottom: '20px'
                              }}
                            >
                              {isMultiPlatformPublishing ? '發布中...' : `發布到選中平台 (${selectedProcessedNewsIds.length} 則新聞)`}
                            </button>


                            {/* 提示文字 */}
                            <div className="ai-submit-hint" style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f7ff', borderRadius: '5px' }}>
                              選擇要發布的新聞，勾選想要發布的平台，然後點擊「發布到選中平台」按鈕即可一次性發布到多個平台。
                              <br />
                              <small style={{ color: selectedProcessedNewsIds.length > 0 ? 'green' : '#666' }}>
                                已選擇：{selectedProcessedNewsIds.length} 則新聞
                                {Object.values(selectedPlatforms).filter(Boolean).length > 0 &&
                                  ` | ${Object.values(selectedPlatforms).filter(Boolean).length} 個平台`
                                }
                                {selectedProcessedNewsIds.length > 0 && Object.values(selectedPlatforms).filter(Boolean).length > 0 ? ' ✓ 可以發布' : ''}
                              </small>
                            </div>


                            <div className="news-grid">
                              {filteredProcessed.map((news) => {
                                // 解析所有圖片
                                const thumbnails = news.images ? parseImages(news.images) : []
                                const isSelected = selectedProcessedNewsIds.includes(news.id)
                                // 用於顯示的選定圖片 (若未選則預設顯示第一張，或不顯示選中框)
                                const currentSelectedImage = selectedProcessedImages[news.id] || (thumbnails.length > 0 ? thumbnails[0] : null)

                                return (
                                  <div
                                    key={news.id}
                                    className="news-card"
                                    style={{
                                      cursor: 'default',
                                      position: 'relative',
                                      border: isSelected ? '2px solid #667eea' : '1px solid #e0e0e0',
                                      backgroundColor: isSelected ? '#f0f4ff' : 'white',
                                      padding: '15px'
                                    }}
                                  >
                                    {/* 多選框 */}
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '10px',
                                        left: '10px',
                                        zIndex: 10
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleProcessedNewsSelection(news.id)}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          cursor: 'pointer'
                                        }}
                                      />
                                    </div>

                                    {/* 標題與內容預覽區域 (點擊切換選取狀態) */}
                                    <div
                                      onClick={() => toggleProcessedNewsSelection(news.id)}
                                      style={{ cursor: 'pointer', marginLeft: '30px', marginBottom: '15px' }}
                                    >
                                      <h3 style={{ color: '#764ba2', marginTop: '0', fontSize: '1.1em' }}>
                                        {news.title_modified || '無標題'}
                                      </h3>
                                    </div>

                                    {/* 分類顯示與編輯區域 */}
                                    <div style={{ marginLeft: '30px', marginBottom: '15px' }}>
                                      {editingCategoryId === news.id ? (
                                        // 編輯模式
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                          <input
                                            type="text"
                                            value={editCategoryZh}
                                            onChange={(e) => setEditCategoryZh(e.target.value)}
                                            placeholder="中文分類 (例: 亞洲、AI 與創新)"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              flex: '1 1 250px',
                                              padding: '6px 10px',
                                              border: '1px solid #ccc',
                                              borderRadius: '4px',
                                              fontSize: '0.9em'
                                            }}
                                          />
                                          <input
                                            type="text"
                                            value={editCategoryEn}
                                            onChange={(e) => setEditCategoryEn(e.target.value)}
                                            placeholder="英文分類 (例: Asia, AI & Innovation)"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              flex: '1 1 250px',
                                              padding: '6px 10px',
                                              border: '1px solid #ccc',
                                              borderRadius: '4px',
                                              fontSize: '0.9em'
                                            }}
                                          />
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSaveCategory(news.id); }}
                                            style={{
                                              padding: '6px 16px',
                                              background: '#4caf50',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontSize: '1em'
                                            }}
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                            style={{
                                              padding: '6px 16px',
                                              background: '#f44336',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontSize: '1em'
                                            }}
                                          >
                                            ✗
                                          </button>
                                        </div>
                                      ) : (
                                        // 顯示模式
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                          {news.category_zh || news.category_en ? (
                                            <>
                                              <span style={{ color: '#666', fontSize: '0.9em', fontWeight: '500' }}>分類：</span>
                                              {news.category_zh && (
                                                <span style={{
                                                  display: 'inline-block',
                                                  padding: '3px 10px',
                                                  background: '#e3f2fd',
                                                  color: '#1976d2',
                                                  borderRadius: '12px',
                                                  fontSize: '0.85em'
                                                }}>
                                                  {news.category_zh}
                                                </span>
                                              )}
                                              {news.category_en && (
                                                <span style={{
                                                  display: 'inline-block',
                                                  padding: '3px 10px',
                                                  background: '#f3e5f5',
                                                  color: '#7b1fa2',
                                                  borderRadius: '12px',
                                                  fontSize: '0.85em'
                                                }}>
                                                  {news.category_en}
                                                </span>
                                              )}
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleEditCategory(news); }}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  fontSize: '1.1em',
                                                  padding: '2px 8px'
                                                }}
                                                title="編輯分類"
                                              >
                                                🖊️
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleEditCategory(news); }}
                                              style={{
                                                padding: '6px 14px',
                                                background: '#2196f3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.85em'
                                              }}
                                            >
                                              + 新增分類
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* 圖片選擇區域 */}
                                    {thumbnails.length > 0 && (
                                      <div style={{ marginBottom: '15px' }}>
                                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                                          選擇代表圖片:
                                        </p>
                                        <div style={{
                                          display: 'flex',
                                          overflowX: 'auto',
                                          gap: '8px',
                                          paddingBottom: '5px'
                                        }}>
                                          {thumbnails.map((img, idx) => (
                                            <div
                                              key={idx}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                // 自動勾選該新聞
                                                if (!isSelected) {
                                                  toggleProcessedNewsSelection(news.id)
                                                }
                                                setSelectedProcessedImages(prev => ({
                                                  ...prev,
                                                  [news.id]: img
                                                }))
                                              }}
                                              style={{
                                                position: 'relative',
                                                flexShrink: 0,
                                                cursor: 'pointer',
                                                border: currentSelectedImage === img ? '3px solid #667eea' : '2px solid transparent',
                                                borderRadius: '4px'
                                              }}
                                            >
                                              <img
                                                src={img}
                                                alt={`選項 ${idx + 1}`}
                                                style={{
                                                  width: '100px',
                                                  height: '75px',
                                                  objectFit: 'cover',
                                                  display: 'block',
                                                  opacity: currentSelectedImage === img ? 1 : 0.7
                                                }}
                                              />
                                              {currentSelectedImage === img && (
                                                <div style={{
                                                  position: 'absolute',
                                                  top: '-8px',
                                                  right: '-8px',
                                                  background: '#667eea',
                                                  color: 'white',
                                                  borderRadius: '50%',
                                                  width: '20px',
                                                  height: '20px',
                                                  fontSize: '12px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                }}>✓</div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 詳細內容預覽 (點擊開啟 Modal) */}
                                    <div onClick={() => setSelectedProcessedNews(news)} style={{ cursor: 'pointer' }}>
                                      <p style={{ fontSize: '14px', color: '#333' }}>
                                        {news.content_modified
                                          ? news.content_modified.substring(0, 80) + '...'
                                          : '無內容'}
                                      </p>
                                      <div style={{ fontSize: '12px', color: '#999', marginTop: '8px', textAlign: 'right' }}>
                                        查看詳情 &gt;
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* 預覽 Modal */}
      {aiPreviewNews && (
        <div className="modal-overlay" onClick={() => setAiPreviewNews(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn btn-secondary modal-close-btn"
              onClick={() => setAiPreviewNews(null)}
            >
              ✕ 關閉
            </button>
            <h2 style={{ marginBottom: '20px', paddingRight: '80px' }}>
              {aiPreviewNews.title_translated || '無標題'}
            </h2>
            <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              {aiPreviewNews.content_translated || '無內容'}
            </div>
            {aiPreviewImages.length > 0 && (
              <div className="ai-preview-images">
                {aiPreviewImages.map((img, index) => (
                  <img key={index} src={img} alt={`預覽圖片 ${index + 1}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ Admin 自動發文監控 Tab ============ */}
      {activeTab === 'admin' && (
        <div className="ai-section" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🤖</span> 自動發文監控
          </h2>
          <p className="ai-note">
            全自動排程發文控制台。啟用後，系統在指定時間自動從各新聞來源隨機取 1 篇、AI 重寫後發布到各平台。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>

            {/* 左側：排程設定 */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>⏰ 排程設定</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px', background: autoConfig.enabled ? '#f0fff4' : '#fff5f5', borderRadius: '8px', border: `1px solid ${autoConfig.enabled ? '#9ae6b4' : '#fed7d7'}` }}>
                <div>
                  <div style={{ fontWeight: 600, color: autoConfig.enabled ? '#276749' : '#c53030' }}>
                    {autoConfig.enabled ? '🟢 已啟用' : '🔴 已停用'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                    {autoConfig.enabled ? `${autoConfig.publish_times.length} 個時間點` : '點擊開關以啟用'}
                  </div>
                </div>
                <input type="checkbox" checked={autoConfig.enabled}
                  onChange={e => { const c = { ...autoConfig, enabled: e.target.checked }; setAutoConfig(c); handleSaveAutoConfig(c) }}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>發文時間點</div>
                {autoConfig.publish_times.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ background: '#667eea', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '13px' }}>{t}</span>
                    <button onClick={() => setAutoConfig({ ...autoConfig, publish_times: autoConfig.publish_times.filter((_, i) => i !== idx) })}
                      style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input type="time" value={newPublishTime} onChange={e => setNewPublishTime(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }} />
                  <button onClick={() => { if (newPublishTime && !autoConfig.publish_times.includes(newPublishTime)) { setAutoConfig({ ...autoConfig, publish_times: [...autoConfig.publish_times, newPublishTime].sort() }); setNewPublishTime('') } }}
                    style={{ padding: '6px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>新增</button>
                </div>
              </div>
              <button onClick={() => handleSaveAutoConfig(autoConfig)}
                style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                💾 儲存設定
              </button>
            </div>

            {/* 右側 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>📡 平台設定</h3>
                {(['wordpress', 'facebook', 'instagram', 'threads'] as const).map(platform => {
                  const labels: Record<string, string> = { wordpress: '🌐 WordPress', facebook: '📘 Facebook', instagram: '📸 Instagram', threads: '🧵 Threads' }
                  return (
                    <div key={platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{labels[platform]}</span>
                      <input type="checkbox" checked={autoConfig.platforms[platform]}
                        onChange={e => setAutoConfig({ ...autoConfig, platforms: { ...autoConfig.platforms, [platform]: e.target.checked } })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px' }}>⚡ 立即測試</h3>
                <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>立即執行一次完整的自動發文流程（不受排程限制）</p>
                <button onClick={handleRunNow} disabled={autoRunning}
                  style={{ width: '100%', padding: '12px', background: autoRunning ? '#ccc' : 'linear-gradient(135deg, #f093fb, #f5576c)', color: 'white', border: 'none', borderRadius: '8px', cursor: autoRunning ? 'wait' : 'pointer', fontWeight: 700, fontSize: '15px' }}>
                  {autoRunning ? '⏳ 發文中...' : '🚀 立即執行一次發文'}
                </button>
              </div>
            </div>
          </div>

          {/* 發文狀況監控 */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                📊 今日發文狀況
                {autoStatus && <span style={{ fontSize: '13px', color: '#888', marginLeft: '8px' }}>({autoStatus.date}，共 {autoStatus.total_logs} 筆)</span>}
              </h3>
              <button onClick={fetchAutoStatus} disabled={autoStatusLoading} style={{ padding: '6px 14px', background: autoStatusLoading ? '#aaa' : '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: autoStatusLoading ? 'wait' : 'pointer', fontSize: '13px' }}>{autoStatusLoading ? '⏳ 載入中...' : '🔄 重新整理'}</button>
            </div>
            {!autoStatus ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>點擊「重新整理」載入資料</p>
            ) : autoStatus.accounts.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>今日尚無自動發文記錄</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f7f8fa' }}>
                    {['平台', '帳號', '✅ 成功', '❌ 失敗', '最後發文', '最後狀態'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('成功') || h.includes('失敗') ? 'center' : 'left', borderBottom: '2px solid #eee', color: '#555' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {autoStatus.accounts.map((acc, idx) => {
                    const colors: Record<string, string> = { wordpress: '#21759b', facebook: '#1877f2', instagram: '#e4405f', threads: '#000' }
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: colors[acc.platform] || '#888', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>{acc.platform}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{acc.account_name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#276749', fontWeight: 700 }}>{acc.success_count}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#c53030', fontWeight: 700 }}>{acc.fail_count}</td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666' }}>{new Date(acc.last_time).toLocaleTimeString('zh-TW')}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {acc.last_success
                            ? <span style={{ color: '#276749', fontWeight: 600 }}>✅ 成功</span>
                            : <span style={{ color: '#c53030', fontSize: '12px' }} title={acc.last_error || ''}> ❌ {acc.last_error ? acc.last_error.substring(0, 40) + '...' : '失敗'}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App


