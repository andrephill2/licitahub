import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-in-production').replace(/^﻿/, '').trim()
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/^﻿/, '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim()

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET — valida se o session_token ainda é o ativo
  if (req.method === 'GET') {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.json({ valid: false, reason: 'no_token' })

    let userId: string
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string }
      userId = payload.sub
    } catch {
      return res.json({ valid: false, reason: 'invalid_token' })
    }

    const sessionToken = req.headers['x-session-token'] as string | undefined
    if (!sessionToken) return res.json({ valid: false, reason: 'no_session_token' })

    // Lê session_token de user_metadata via Auth Admin API
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
    const storedToken = (user?.user_metadata?.session_token as string | undefined) ?? null

    if (storedToken !== sessionToken) {
      return res.json({ valid: false, reason: 'kicked' })
    }

    return res.json({ valid: true })
  }

  // DELETE — logout: limpa session_token para liberar próximo login
  if (req.method === 'DELETE') {
    const auth = req.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      try {
        const { sub: userId } = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string }
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { session_token: null },
        })
      } catch {
        // ignora erros no logout
      }
    }
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
