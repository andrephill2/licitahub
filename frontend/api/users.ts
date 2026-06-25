import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Usa service role — seguro pois está no servidor (Vercel), não no browser
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCallerRole(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  return data?.role ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = await getCallerRole(req.headers.authorization)
  if (role !== 'master') return res.status(403).json({ error: 'Acesso negado' })

  // POST /api/users — criar usuário
  if (req.method === 'POST') {
    const { username, password, expirationDate } = req.body as { username: string; password: string; expirationDate: string }
    if (!username || !password || !expirationDate) return res.status(400).json({ error: 'Campos obrigatórios ausentes' })

    const email = `${username.trim().toLowerCase()}@licitahub.internal`
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) return res.status(400).json({ error: error.message })

    await supabaseAdmin.from('profiles').insert({ id: data.user!.id, username: username.trim(), role: 'common', expiration_date: expirationDate })
    return res.status(201).json({ id: data.user!.id, username: username.trim() })
  }

  // DELETE /api/users?id=UUID — remover usuário
  if (req.method === 'DELETE') {
    const { id } = req.query as { id: string }
    await supabaseAdmin.auth.admin.deleteUser(id)
    await supabaseAdmin.from('profiles').delete().eq('id', id)
    return res.status(204).end()
  }

  // GET /api/users — listar usuários
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('profiles').select('id, username, role, expiration_date').order('username')
    return res.json(data || [])
  }

  res.status(405).end()
}
