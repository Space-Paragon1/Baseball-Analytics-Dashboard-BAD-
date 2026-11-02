import {
  CloudDownload,
  GitCompareArrows,
  LayoutDashboard,
  type LucideIcon,
  PlusSquare,
  Swords,
  Table,
  Target,
  Upload,
  Users,
  UsersRound,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Page heading used for the breadcrumb and browser tab. */
  title: string;
}

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Analytics",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, title: "Dashboard" },
      { label: "Batting", href: "/players", icon: Users, title: "Batting Leaders" },
      { label: "Pitching", href: "/pitching", icon: Target, title: "Pitching Leaders" },
      { label: "Teams", href: "/teams", icon: UsersRound, title: "Teams & Standings" },
      { label: "Compare", href: "/compare", icon: GitCompareArrows, title: "Compare Players" },
    ],
  },
  {
    heading: "Data",
    items: [
      { label: "Game Log", href: "/records", icon: Table, title: "Game Log" },
      { label: "Game Mode", href: "/game-mode", icon: Swords, title: "Game Mode" },
      { label: "Add Record", href: "/add-game", icon: PlusSquare, title: "Add Record" },
      { label: "Upload CSV", href: "/upload", icon: Upload, title: "Upload CSV" },
      { label: "MLB Import", href: "/import", icon: CloudDownload, title: "Import MLB Data" },
    ],
  },
];

const EXTRA_TITLES: Record<string, string> = { "/login": "Sign In", "/register": "Create Account" };

export function pageTitle(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => i.href === pathname);
    if (item) return item.title;
  }
  return EXTRA_TITLES[pathname] ?? "Baseball Analytics";
}
