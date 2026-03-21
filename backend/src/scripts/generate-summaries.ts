import fs from 'fs'
import path from 'path'
import { 
  loadCategoryData,
  saveCategoryData,
  type CategoryData
} from '../lib/storage'
import { generateDailySummary } from '../lib/ai'

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'public')

async function generateCategorySummaries(): Promise<void> {
  console.log('[Summary] 开始生成分类摘要...\n')
  
  if (!fs.existsSync(DATA_DIR)) {
    console.log('[Summary] 数据目录不存在')
    return
  }
  
  const files = fs.readdirSync(DATA_DIR)
  const categoryFiles = files.filter(f => /^[^-]+-\d{4}-\d{2}-\d{2}\.json$/.test(f))
  
  if (categoryFiles.length === 0) {
    console.log('[Summary] 没有找到分类文件')
    return
  }
  
  for (const file of categoryFiles) {
    const match = file.match(/^([^-]+)-(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    
    const [, dateStr] = match
    const categoryData = loadCategoryData(match[1], match[2])
    
    if (!categoryData || !categoryData.articles || categoryData.articles.length === 0) {
      console.log(`[Summary] ${file} 没有文章，跳过`)
      continue
    }
    
    if (categoryData.summary && categoryData.summary.length > 0) {
      console.log(`[Summary] ${file} 已有摘要，跳过`)
      continue
    }
    
    console.log(`[Summary] 正在生成 ${file} 的摘要...`)
    
    try {
      const summary = await generateDailySummary(
        categoryData.articles.map(a => ({
          title: a.title,
          content: a.content || undefined,
          sourceName: a.sourceName
        }))
      )
      
      categoryData.summary = summary
      saveCategoryData(categoryData)
      
      console.log(`[Summary] ${file} 摘要生成成功`)
      console.log(`[Summary] 摘要内容: ${summary.substring(0, 100)}...\n`)
    } catch (error) {
      console.error(`[Summary] ${file} 摘要生成失败:`, error)
    }
  }
  
  console.log('[Summary] 分类摘要生成完成！')
}

generateCategorySummaries()
