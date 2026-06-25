import 'dotenv/config'

export const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL || '',
}

// Placeholder — substituir por cliente real (Supabase, pg, etc.)
// Exemplo com Supabase:
// import { createClient } from '@supabase/supabase-js'
// export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  role: 'master' | 'common'
  expirationDate: string
}

// Seed in-memory para desenvolvimento (remover quando banco estiver conectado)
import bcrypt from 'bcryptjs'
const SEED_PASSWORD_HASH = bcrypt.hashSync('trocar-em-producao', 10)

export const inMemoryUsers: UserRecord[] = [
  {
    id: 'admin-master',
    username: 'andre.philipe',
    passwordHash: SEED_PASSWORD_HASH,
    role: 'master',
    expirationDate: '2099-12-31',
  },
]
