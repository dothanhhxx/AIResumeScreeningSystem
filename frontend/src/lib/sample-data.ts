export const sampleMetrics = [
  { label: "Active roles", value: "12", change: "+2", tone: "mint", icon: "↗" },
  {
    label: "CVs received",
    value: "248",
    change: "+18%",
    tone: "blue",
    icon: "▤",
  },
  {
    label: "Needs review",
    value: "34",
    change: "8 new",
    tone: "amber",
    icon: "◷",
  },
  {
    label: "Shortlisted",
    value: "19",
    change: "+4",
    tone: "violet",
    icon: "✓",
  },
] as const;

export const recentRoles = [
  {
    title: "Senior Product Designer",
    department: "Product · Remote",
    candidates: 42,
    status: "Reviewing",
    tone: "blue",
    updated: "12 min ago",
  },
  {
    title: "Backend Engineer",
    department: "Engineering · Hanoi",
    candidates: 86,
    status: "Active",
    tone: "green",
    updated: "1 hour ago",
  },
  {
    title: "Growth Marketing Lead",
    department: "Marketing · Hybrid",
    candidates: 27,
    status: "Draft",
    tone: "neutral",
    updated: "Yesterday",
  },
] as const;

export const reviewQueue = [
  {
    initials: "ML",
    name: "Morgan Lee",
    role: "Senior Product Designer",
    fit: "92%",
    skills: "Figma, Design systems",
    tone: "mint",
  },
  {
    initials: "AK",
    name: "Avery Kim",
    role: "Backend Engineer",
    fit: "88%",
    skills: "Python, PostgreSQL",
    tone: "blue",
  },
  {
    initials: "SR",
    name: "Sam Rivera",
    role: "Growth Marketing Lead",
    fit: "81%",
    skills: "SEO, Analytics",
    tone: "amber",
  },
] as const;
