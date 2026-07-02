import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  role: 'master' | 'common'
  expirationDate: string
  cnpj?: string
}

const USERS_FILE = path.resolve(__dirname, '../../users.json')

export function loadUsers(): UserRecord[] {
  if (fs.existsSync(USERS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
    } catch {
      // arquivo corrompido — recria
    }
  }
  const seed: UserRecord[] = [
    {
      id: 'admin-master',
      username: 'andre.philipe',
      passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'sos@2025', 10),
      role: 'master',
      expirationDate: '2099-12-31',
    },
  ]
  fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2))
  return seed
}

export function saveUsers(users: UserRecord[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}
