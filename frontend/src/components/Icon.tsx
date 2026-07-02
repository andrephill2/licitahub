// Ícones do app — lucide-react (sucessor moderno do Feather), mantendo a
// mesma API por nome usada em todo o código. Trocar o glyph de um nome aqui
// atualiza o app inteiro.
import type { LucideIcon } from 'lucide-react'
import {
  Zap, Search, LogOut, Eye, EyeOff, Sun, Moon, Star, Bell, CalendarDays,
  Clock, SlidersHorizontal, Trash2, Archive, Settings, Download, Check,
  ShieldCheck, Building2, MapPin, FileText, RefreshCw, Plus, X, LogIn,
  User, TrendingUp, LayoutDashboard, AlertTriangle, Target, Database,
  Users, Share2, Volume2, VolumeX, BookOpen, Sparkles, Radar,
} from 'lucide-react'

const ICONS = {
  zap: Zap,
  search: Search,
  logout: LogOut,
  eye: Eye,
  eyeOff: EyeOff,
  sun: Sun,
  moon: Moon,
  star: Star,
  bell: Bell,
  calendar: CalendarDays,
  clock: Clock,
  filter: SlidersHorizontal,
  trash: Trash2,
  archive: Archive,
  settings: Settings,
  download: Download,
  check: Check,
  shield: ShieldCheck,
  building: Building2,
  mapPin: MapPin,
  fileText: FileText,
  refresh: RefreshCw,
  plus: Plus,
  x: X,
  login: LogIn,
  user: User,
  trending: TrendingUp,
  dashboard: LayoutDashboard,
  alert: AlertTriangle,
  target: Target,
  database: Database,
  users: Users,
  share: Share2,
  volume: Volume2,
  volumeX: VolumeX,
  book: BookOpen,
  sparkles: Sparkles,
  radar: Radar,
} satisfies Record<string, LucideIcon>

interface IconProps {
  name: keyof typeof ICONS
  className?: string
}

export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  const Cmp = ICONS[name]
  if (!Cmp) return null
  return <Cmp className={className} strokeWidth={2} aria-hidden />
}
