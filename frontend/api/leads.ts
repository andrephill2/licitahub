import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Tabela necessária no Supabase:
// CREATE TABLE leads (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   nome text NOT NULL,
//   email text NOT NULL,
//   empresa text,
//   telefone text,
//   plano text DEFAULT 'equipe',
//   criado_em timestamptz DEFAULT now()
// );

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/^﻿/, '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim()

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { nome, email, empresa, telefone, plano } = req.body as {
    nome?: string
    email?: string
    empresa?: string
    telefone?: string
    plano?: string
  }

  if (!nome?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'E-mail inválido.' })
  }

  const { error } = await supabaseAdmin.from('leads').insert({
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    empresa: empresa?.trim() || null,
    telefone: telefone?.trim() || null,
    plano: plano || 'equipe',
  })

  if (error) {
    console.error('leads insert error:', error)
    return res.status(500).json({ error: 'Erro ao registrar. Tente novamente.' })
  }

  return res.status(201).json({ ok: true })
}
