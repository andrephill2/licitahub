import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useTabsStore } from '../../stores/tabsStore'
import { useFavoritosStore } from '../../stores/favoritosStore'
import { getKeywordsFromCnaes } from '../../lib/cnaeKeywords'
import { runSearch } from '../../lib/searchApi'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { cn } from '../../lib/utils'

interface CnpjData {
  razaoSocial: string
  nomeFantasia: string
  cnaeMain: number
  cnaeMainDesc: string
  cnaeSecondary: number[]
}

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function OnboardingModal() {
  const { completeOnboarding } = useAuthStore()
  const { openTab, updateTab } = useTabsStore()
  const { archived } = useFavoritosStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [cnpjInput, setCnpjInput] = useState('')
  const [loadingCnpj, setLoadingCnpj] = useState(false)
  const [cnpjError, setCnpjError] = useState('')
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null)
  const [keywords, setKeywords] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  async function fetchCnpj() {
    const digits = cnpjInput.replace(/\D/g, '')
    if (digits.length !== 14) { setCnpjError('CNPJ deve ter 14 dígitos.'); return }
    setLoadingCnpj(true)
    setCnpjError('')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) { setCnpjError('CNPJ não encontrado. Verifique e tente novamente.'); return }
      const data = await res.json()
      const secondary: number[] = (data.cnaes_secundarios || []).map((c: { codigo: number }) => c.codigo)
      const kws = getKeywordsFromCnaes(data.cnae_fiscal, secondary)
      setCnpjData({
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        cnaeMain: data.cnae_fiscal,
        cnaeMainDesc: data.cnae_fiscal_descricao || '',
        cnaeSecondary: secondary,
      })
      setKeywords(kws)
      setSelected(new Set(kws))
      setStep(2)
    } catch {
      setCnpjError('Erro ao buscar CNPJ. Tente novamente.')
    } finally {
      setLoadingCnpj(false)
    }
  }

  async function handleConfirm(chosenKeywords: string[]) {
    setSubmitting(true)
    const cnpjDigits = cnpjInput.replace(/\D/g, '')
    const archivedIds = new Set(Object.keys(archived))
    const filters = { apenasVigentes: true, matchType: 'approximate' as const }

    // 1. Abre todas as tabs de uma vez (síncrono) — aparecem na sidebar imediatamente
    for (const kw of chosenKeywords) {
      openTab(kw, filters)
    }

    // 2. Salva CNPJ — modal vai desmontar, mas as tabs já estão no store
    await completeOnboarding(cnpjDigits)

    // 3. Roda as buscas em paralelo (componente pode estar desmontado, mas Zustand ainda funciona)
    await Promise.all(
      chosenKeywords.map(async (kw) => {
        try {
          const result = await runSearch(kw, filters, archivedIds)
          updateTab(kw, { items: result.items, total: result.total, loading: false })
        } catch {
          updateTab(kw, { loading: false })
        }
      })
    )
  }

  async function handleSkip() {
    setSubmitting(true)
    const cnpjDigits = cnpjInput.replace(/\D/g, '')
    await completeOnboarding(cnpjDigits || 'skipped')
    setSubmitting(false)
  }

  function toggleKeyword(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(kw) ? next.delete(kw) : next.add(kw)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200/50 dark:border-slate-700/50">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-2xl bg-indigo-600 flex items-center justify-center">
              <Icon name="target" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {step === 1 ? 'Configure suas buscas' : 'Palavras-chave sugeridas'}
              </h2>
              <p className="text-xs text-slate-400">
                {step === 1
                  ? 'Informe o CNPJ da empresa para receber sugestões personalizadas'
                  : `Com base nos CNAEs de ${cnpjData?.nomeFantasia || cnpjData?.razaoSocial || 'sua empresa'}`}
              </p>
            </div>
          </div>

          {/* steps indicator */}
          <div className="flex gap-2 mt-4">
            {([1, 2] as const).map((s) => (
              <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors', s <= step ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700')} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">

          {/* ── Step 1: CNPJ ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">CNPJ da empresa</label>
                <input
                  value={cnpjInput}
                  onChange={(e) => { setCnpjInput(maskCnpj(e.target.value)); setCnpjError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCnpj()}
                  placeholder="00.000.000/0001-00"
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                  autoFocus
                />
                {cnpjError && <p className="text-xs text-red-500 font-medium">{cnpjError}</p>}
              </div>

              <Button className="w-full h-12" onClick={fetchCnpj} loading={loadingCnpj}>
                <Icon name="search" className="h-4 w-4 mr-2" />
                Buscar empresa
              </Button>

              <button
                onClick={handleSkip}
                disabled={submitting}
                className="w-full text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1"
              >
                Pular esta etapa
              </button>
            </div>
          )}

          {/* ── Step 2: Keywords ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Company card */}
              {cnpjData && (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl px-4 py-3 border border-slate-200/60 dark:border-slate-700/60">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">
                    {cnpjData.nomeFantasia || cnpjData.razaoSocial}
                  </p>
                  {cnpjData.nomeFantasia && cnpjData.razaoSocial !== cnpjData.nomeFantasia && (
                    <p className="text-xs text-slate-400 truncate">{cnpjData.razaoSocial}</p>
                  )}
                  <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">{cnpjData.cnaeMainDesc}</p>
                </div>
              )}

              {keywords.length === 0 ? (
                <div className="text-center py-6">
                  <Icon name="search" className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">Nenhuma sugestão encontrada para o CNAE desta empresa.</p>
                  <p className="text-xs text-slate-400 mt-1">Você pode pesquisar manualmente na tela de buscas.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Selecione as palavras-chave ({selected.size}/{keywords.length})
                      </label>
                      <button
                        onClick={() => setSelected(selected.size === keywords.length ? new Set() : new Set(keywords))}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        {selected.size === keywords.length ? 'Desmarcar todas' : 'Selecionar todas'}
                      </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                      {keywords.map((kw) => (
                        <label
                          key={kw}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none',
                            selected.has(kw)
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700'
                              : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(kw)}
                            onChange={() => toggleKeyword(kw)}
                            className="accent-indigo-600 h-4 w-4 shrink-0"
                          />
                          <span className={cn('text-sm font-semibold capitalize', selected.has(kw) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400')}>
                            {kw}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full h-12"
                    onClick={() => handleConfirm([...selected])}
                    loading={submitting}
                    disabled={selected.size === 0}
                  >
                    <Icon name="zap" className="h-4 w-4 mr-2" />
                    Iniciar {selected.size} busca{selected.size !== 1 ? 's' : ''} ativas
                  </Button>
                </>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  ← Voltar
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Pular e entrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
