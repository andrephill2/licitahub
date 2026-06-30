import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-in-production').replace(/^﻿/, '').trim()
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/^﻿/, '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim()

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password, force } = req.body as { username: string; password: string; force?: boolean }
  if (!username || !password)
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' })

  const email = `${username.trim().toLowerCase()}@licitahub.internal`
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
  if (error || !data.user)
    return res.status(401).json({ error: 'Credenciais inválidas' })

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('username, role, expiration_date')
    .eq('id', data.user.id)
    .single()

  if (profErr || !profile)
    return res.status(401).json({ error: 'Perfil não encontrado' })

  if (profile.role !== 'master') {
    if (new Date(profile.expiration_date) < new Date())
      return res.status(403).json({ error: 'Conta expirada' })
  }

  // Sessão única: session_token armazenado em user_metadata (bypass PostgREST)
  const existingSessionToken = (data.user.user_metadata?.session_token as string | undefined) ?? null
  if (existingSessionToken && !force) {
    return res.status(409).json({ error: 'session_conflict' })
  }

  // Grava novo token via Auth Admin API (não usa PostgREST)
  const sessionToken = randomUUID()
  await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    user_metadata: { session_token: sessionToken },
  })

  const token = jwt.sign({ sub: data.user.id, role: profile.role }, JWT_SECRET, { expiresIn: '8h' })

  return res.json({
    token,
    sessionToken,
    supabaseAccessToken: data.session?.access_token ?? null,
    supabaseRefreshToken: data.session?.refresh_token ?? null,
    user: {
      id: data.user.id,
      username: profile.username,
      role: profile.role,
      expirationDate: profile.expiration_date,
      cnpj: (data.user.user_metadata?.cnpj as string | undefined) ?? null,
    },
  })
}
