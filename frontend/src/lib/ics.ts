// Gera arquivos .ics (iCalendar) para exportar prazos para Google Calendar,
// Outlook, Apple Calendar etc. Usa horário local "flutuante" (sem Z): os apps
// interpretam no fuso do usuário — correto para quem opera no Brasil.

export interface IcsEvent {
  uid: string
  start: Date
  title: string
  description?: string
  durationMin?: number      // duração do evento (padrão 30min)
  alarmDaysBefore?: number  // lembrete N dias antes (padrão 1)
}

function pad(n: number): string { return String(n).padStart(2, '0') }

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

// Escapa vírgula, ponto-e-vírgula, barra e quebras de linha conforme RFC 5545.
function esc(s: string): string {
  return String(s).replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

// Dobra linhas longas em 75 octetos (RFC 5545) — evita apps recusarem o arquivo.
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let s = line
  parts.push(s.slice(0, 75))
  s = s.slice(75)
  while (s.length > 0) { parts.push(' ' + s.slice(0, 74)); s = s.slice(74) }
  return parts.join('\r\n')
}

export function buildIcs(events: IcsEvent[], calName = 'LicitaTrend — Prazos'): string {
  const stamp = fmtLocal(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LicitaTrend//Prazos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ]
  for (const ev of events) {
    const dur = ev.durationMin ?? 30
    const end = new Date(ev.start.getTime() + dur * 60000)
    const alarm = ev.alarmDaysBefore ?? 1
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtLocal(ev.start)}`,
      `DTEND:${fmtLocal(end)}`,
      fold(`SUMMARY:${esc(ev.title)}`),
    )
    if (ev.description) lines.push(fold(`DESCRIPTION:${esc(ev.description)}`))
    if (alarm > 0) {
      lines.push(
        'BEGIN:VALARM',
        `TRIGGER:-P${alarm}D`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(ev.title)}`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// Dispara o download do .ics no navegador.
export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
