import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }) // 10MB
  const [, files] = await form.parse(req)
  const file = Array.isArray(files.image) ? files.image[0] : files.image
  if (!file) return res.status(400).json({ error: 'No file uploaded' })

  const ext = file.originalFilename?.split('.').pop() || 'jpg'
  const filename = `${user.id}/${Date.now()}.${ext}`
  const fileBuffer = fs.readFileSync(file.filepath)

  const { error } = await adminSupabase.storage.from('note-images').upload(filename, fileBuffer, {
    contentType: file.mimetype || 'image/jpeg',
    upsert: false,
  })
  if (error) return res.status(500).json({ error: error.message })

  const { data: { publicUrl } } = adminSupabase.storage.from('note-images').getPublicUrl(filename)
  return res.status(200).json({ url: publicUrl })
}
