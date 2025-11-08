import { useState, useEffect } from 'react'
import axios from 'axios'

// 設定 axios 基礎 URL
axios.defaults.baseURL = 'http://localhost:8000'

interface NewsItem {
  id: number
  title_translated: string | null
  content_translated: string | null
  images: string | null
  sourceWebsite?: string | null
  url?: string | null
  title_modified?: string | null
  content_modified?: string | null
}

interface SystemPrompt {
  id: number
  name: string
  prompt: string
}

type Tab = 'news' | 'prompts' | 'ai' | 'processed'

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
  const [aiTitleKeyword, setAiTitleKeyword] = useState('')
  const [aiPreviewNews, setAiPreviewNews] = useState<NewsItem | null>(null)
  const [aiProcessing, setAiProcessing] = useState(false)
  
  // 原始新聞篩選狀態
  const [newsWebsiteFilter, setNewsWebsiteFilter] = useState('all')
  const [newsTitleKeyword, setNewsTitleKeyword] = useState('')
  
  // 處理後新聞列表狀態
  const [processedNewsList, setProcessedNewsList] = useState<NewsItem[]>([])
  const [processedLoading, setProcessedLoading] = useState(false)
  const [processedWebsiteFilter, setProcessedWebsiteFilter] = useState('all')
  const [processedTitleKeyword, setProcessedTitleKeyword] = useState('')
  const [selectedProcessedNews, setSelectedProcessedNews] = useState<NewsItem | null>(null)
  
  // System Prompt 表單狀態
  const [promptName, setPromptName] = useState('')
  const [promptContent, setPromptContent] = useState('')

  // 從 localStorage 載入 System Prompts
  useEffect(() => {
    const savedPrompts = localStorage.getItem('systemPrompts')
    if (savedPrompts) {
      try {
        const prompts = JSON.parse(savedPrompts)
        setSystemPrompts(prompts)
      } catch (err) {
        console.error('載入 System Prompts 失敗:', err)
      }
    }
  }, [])

  // 當 systemPrompts 變更時，保存到 localStorage
  useEffect(() => {
    if (systemPrompts.length > 0) {
      localStorage.setItem('systemPrompts', JSON.stringify(systemPrompts))
    }
  }, [systemPrompts])

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

  const handleCreatePrompt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!promptName.trim() || !promptContent.trim()) {
      alert('請填寫名稱和內容')
      return
    }

    // 在前端直接創建新的 System Prompt
    const newPrompt: SystemPrompt = {
      id: systemPrompts.length > 0 ? Math.max(...systemPrompts.map(p => p.id)) + 1 : 1,
      name: promptName,
      prompt: promptContent
    }
    
    setSystemPrompts([...systemPrompts, newPrompt])
    setPromptName('')
    setPromptContent('')
    alert('System Prompt 已儲存到瀏覽器')
  }

  const handleDeletePrompt = (id: number) => {
    if (!confirm('確定要刪除這個 System Prompt 嗎？')) {
      return
    }

    // 直接在前端刪除
    const updatedPrompts = systemPrompts.filter(p => p.id !== id)
    setSystemPrompts(updatedPrompts)
    
    // 如果全部刪除，清空 localStorage
    if (updatedPrompts.length === 0) {
      localStorage.removeItem('systemPrompts')
    }
  }

  const newsImages = selectedNews ? parseImages(selectedNews.images) : []
  const websiteOptions = Array.from(
    new Set(
      newsList
        .map((news) => news.sourceWebsite?.trim())
        .filter((url): url is string => !!url && url.length > 0)
    )
  )
  const normalizedKeyword = aiTitleKeyword.trim().toLowerCase()
  const filteredNews = newsList.filter((news) => {
    const matchWebsite =
      aiWebsiteFilter === 'all' ||
      (news.sourceWebsite?.trim() || '') === aiWebsiteFilter
    const title = (news.title_translated || '').toLowerCase()
    const matchTitle = normalizedKeyword === '' || title.includes(normalizedKeyword)
    return matchWebsite && matchTitle
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
                      <label htmlFor="news-title-filter">標題關鍵字</label>
                      <input
                        id="news-title-filter"
                        type="text"
                        value={newsTitleKeyword}
                        onChange={(e) => setNewsTitleKeyword(e.target.value)}
                        placeholder="輸入標題關鍵字..."
                      />
                    </div>
                  </div>

                  {newsList.length === 0 ? (
                    <div className="empty-state">目前沒有新聞資料</div>
                  ) : (
                    <>
                      {(() => {
                        const filteredNews = newsList.filter((news) => {
                          const websiteMatch = newsWebsiteFilter === 'all' || news.sourceWebsite === newsWebsiteFilter
                          const titleMatch = !newsTitleKeyword || 
                            news.title_translated?.toLowerCase().includes(newsTitleKeyword.toLowerCase())
                          return websiteMatch && titleMatch
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
                                {news.sourceWebsite && (
                                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                                    來源：{news.sourceWebsite}
                                  </div>
                                )}
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
            <h2>已儲存的 System Prompts（保存在瀏覽器）</h2>
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
                  <label htmlFor="ai-title-filter">標題關鍵字</label>
                  <input
                    id="ai-title-filter"
                    type="text"
                    value={aiTitleKeyword}
                    onChange={(e) => setAiTitleKeyword(e.target.value)}
                    placeholder="輸入標題關鍵字"
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
            顯示已由 AI 重寫完成的新聞，包含重寫後的標題與內容。
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
                  <label htmlFor="processed-title-filter">標題關鍵字</label>
                  <input
                    id="processed-title-filter"
                    type="text"
                    value={processedTitleKeyword}
                    onChange={(e) => setProcessedTitleKeyword(e.target.value)}
                    placeholder="輸入標題關鍵字..."
                  />
                </div>
              </div>

              {processedNewsList.length === 0 ? (
                <div className="empty-state">目前沒有處理完成的新聞</div>
              ) : (
                <>
                  {(() => {
                    const filteredProcessed = processedNewsList.filter((news) => {
                      const websiteMatch = processedWebsiteFilter === 'all' || news.sourceWebsite === processedWebsiteFilter
                      const titleMatch = !processedTitleKeyword || 
                        news.title_modified?.toLowerCase().includes(processedTitleKeyword.toLowerCase()) ||
                        news.title_translated?.toLowerCase().includes(processedTitleKeyword.toLowerCase())
                      return websiteMatch && titleMatch
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
                            <div style={{ marginBottom: '30px', paddingBottom: '30px', borderBottom: '2px solid #667eea' }}>
                              <h3 style={{ color: '#667eea', marginBottom: '10px' }}>原始新聞</h3>
                              <h4>{selectedProcessedNews.title_translated || '無標題'}</h4>
                              <div className="content">
                                {selectedProcessedNews.content_translated || '無內容'}
                              </div>
                            </div>
                            <div>
                              <h3 style={{ color: '#764ba2', marginBottom: '10px' }}>AI 重寫後</h3>
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
                          <div className="news-grid">
                            {filteredProcessed.map((news) => {
                              const thumbnails = news.images ? parseImages(news.images).slice(0, 1) : []
                              return (
                                <div
                                  key={news.id}
                                  className="news-card"
                                  onClick={() => setSelectedProcessedNews(news)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {thumbnails.length > 0 && (
                                    <div style={{ marginBottom: '10px' }}>
                                      <img 
                                        src={thumbnails[0]} 
                                        alt="縮圖" 
                                        style={{ 
                                          width: '100%', 
                                          height: '150px', 
                                          objectFit: 'cover', 
                                          borderRadius: '5px' 
                                        }} 
                                      />
                                    </div>
                                  )}
                                  <h3 style={{ color: '#764ba2' }}>{news.title_modified || '無標題'}</h3>
                                  <p>
                                    {news.content_modified
                                      ? news.content_modified.substring(0, 100) + '...'
                                      : '無內容'}
                                  </p>
                                  {news.sourceWebsite && (
                                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                                      來源：{news.sourceWebsite}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
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
    </div>
  )
}

export default App

