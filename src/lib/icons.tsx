// Icon set used by DataTable + FindBar.
//
// Aliased under Ico* names so call sites stay short. Swap the underlying
// library here (lucide-react today) without touching consumers.
//
// Lucide chosen because:
//   - It's the shadcn convention — consumers usually already have it
//   - It's tree-shakable (only the 8 icons used here ship)
//   - Stable API: <Icon size={n} className="..." />, no CSS-font baggage
export {
  Filter as IcoFilter,
  ChevronDown as IcoChevronDown,
  X as IcoClose,
  Plus as IcoPlus,
  Pin as IcoPin,
  PinOff as IcoPinOff,
  GripVertical as IcoGripVertical,
  Columns3 as IcoColumns,
  Bookmark as IcoBookmark,
  RotateCw as IcoRotateCw,
  RotateCcw as IcoRotateCcw,
  Eye as IcoEye,
  Link as IcoLink,
  MoreHorizontal as IcoMoreH,
} from 'lucide-react'
