import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`)
})
