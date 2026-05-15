import * as React from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  Calendar,
  Video,
  User,
  Mail,
  Lock,
  CreditCard,
  Globe,
  Shield,
  Sparkle,
  Sparkles,
  Plus,
  Minus,
  X,
  Menu,
  Star,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  LayoutGrid,
  Layers,
  Activity,
  Settings as CogIcon,
  Bell,
  Search,
  PanelLeft,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Eye,
  Link as LinkIcon,
  Edit2,
  RefreshCcw,
  Apple,
  Wallet,
  CalendarDays,
  MapPin,
  Users,
  Briefcase,
  Phone,
  AtSign,
  Building2,
  FileText,
  Repeat,
  ClipboardList,
  AlertTriangle,
  Trash2,
  Power,
  Filter,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";

const REGISTRY: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  check: Check,
  "check-sm": Check,
  clock: Clock,
  calendar: Calendar,
  "calendar-days": CalendarDays,
  video: Video,
  user: User,
  users: Users,
  mail: Mail,
  "at-sign": AtSign,
  lock: Lock,
  card: CreditCard,
  wallet: Wallet,
  globe: Globe,
  shield: Shield,
  sparkle: Sparkle,
  sparkles: Sparkles,
  plus: Plus,
  minus: Minus,
  x: X,
  menu: Menu,
  star: Star,
  copy: Copy,
  download: Download,
  "chevron-l": ChevronLeft,
  "chevron-r": ChevronRight,
  "chevron-d": ChevronDown,
  "chevron-u": ChevronUp,
  info: Info,
  grid: LayoutGrid,
  layers: Layers,
  spark: Activity,
  cog: CogIcon,
  bell: Bell,
  search: Search,
  "panel-l": PanelLeft,
  "trend-up": TrendingUp,
  "trend-down": TrendingDown,
  more: MoreHorizontal,
  eye: Eye,
  link: LinkIcon,
  edit: Edit2,
  refresh: RefreshCcw,
  apple: Apple,
  paypal: Wallet,
  "map-pin": MapPin,
  briefcase: Briefcase,
  phone: Phone,
  building: Building2,
  file: FileText,
  repeat: Repeat,
  clipboard: ClipboardList,
  alert: AlertTriangle,
  trash: Trash2,
  power: Power,
  filter: Filter,
  pause: Pause,
  play: Play,
};

export type IconName = keyof typeof REGISTRY | string;

export type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.5,
  className,
  style,
}: IconProps) {
  const Cmp = REGISTRY[name] ?? Info;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden
    />
  );
}
