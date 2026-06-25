import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

export const capagRouter = new Hono()

// CAPAG data é carregado do JSON separado (não mais embutido no HTML)
// O arquivo capag.json deve ser gerado a partir do window.CAPAG_DATA do HTML legado
let capagData: Record<string, Record<string, string>> = {}

async function loadCapag() {
  if (Object.keys(capagData).length > 0) return
  try {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const raw = await readFile(join(__dirname, '../data/capag.json'), 'utf-8')
    capagData = JSON.parse(raw)
  } catch {
    capagData = {}
  }
}

capagRouter.get('/', requireAuth, async (c) => {
  await loadCapag()
  const municipio = (c.req.query('municipio') || '').toUpperCase().trim()
  const uf = (c.req.query('uf') || '').toUpperCase().trim()

  if (!municipio) {
    return c.json({ error: 'Parâmetro municipio é obrigatório' }, 400)
  }

  const entry = capagData[municipio]
  if (!entry) {
    return c.json({ municipio, uf, rating: null })
  }

  const rating = uf ? entry[uf] ?? null : Object.values(entry)[0] ?? null
  return c.json({ municipio, uf, rating })
})
