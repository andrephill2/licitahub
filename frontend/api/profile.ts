import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-in-production').replace(/^﻿/, '').trim()
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/^﻿/, '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim()

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado' })

  let userId: string
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string }
    userId = payload.sub
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }

  const { cnpj } = req.body as { cnpj?: string }
  if (!cnpj) return res.status(400).json({ error: 'CNPJ obrigatório' })

  // Grava em Supabase Auth (user_metadata) e também na tabela profiles (para queries de time por CNPJ)
  const [authResult, profileResult] = await Promise.all([
    supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { cnpj } }),
    supabaseAdmin.from('profiles').update({ cnpj }).eq('id', userId),
  ])

  if (authResult.error) return res.status(500).json({ error: authResult.error.message })
  if (profileResult.error) return res.status(500).json({ error: profileResult.error.message })

  return res.json({ ok: true })
}
