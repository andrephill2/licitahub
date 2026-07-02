import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-in-production').replace(/^﻿/, '').trim()
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/^﻿/, '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim()

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY)

function getCallerRole(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { role: string }
    return payload.role ?? null
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = getCallerRole(req.headers.authorization)
  if (role !== 'master') return res.status(403).json({ error: 'Acesso negado' })

  // GET /api/users
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, expiration_date')
      .order('username')
    return res.json(data || [])
  }

  // POST /api/users
  if (req.method === 'POST') {
    const { username, password, expirationDate } = req.body as {
      username: string; password: string; expirationDate: string
    }
    if (!username || !password || !expirationDate)
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' })

    const email = `${username.trim().toLowerCase()}@licitahub.internal`
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username: username.trim(), role: 'common', expiration_date: expirationDate },
    })
    if (error) return res.status(400).json({ error: error.message })

    await supabaseAdmin.from('profiles').insert({
      id: data.user!.id,
      username: username.trim(),
      role: 'common',
      expiration_date: expirationDate,
    })
    return res.status(201).json({ id: data.user!.id, username: username.trim() })
  }

  // DELETE /api/users?id=UUID
  if (req.method === 'DELETE') {
    const { id } = req.query as { id: string }
    await supabaseAdmin.auth.admin.deleteUser(id)
    await supabaseAdmin.from('profiles').delete().eq('id', id)
    return res.status(204).end()
  }

  res.status(405).end()
}
