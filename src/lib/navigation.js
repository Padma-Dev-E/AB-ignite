export const NAV_ITEMS = [
  { key: "community", label: "Community", icon: "home" },
  { key: "new", label: "Share an idea", icon: "plus" },
  { key: "learn", label: "Ignite Your Knowledge", icon: "zap" },
  { key: "library", label: "Library", icon: "book" },
  { key: "rewards", label: "Rewards", icon: "gift" },
  { key: "me", label: "My account", icon: "user" },
];

const TITLES = Object.fromEntries(NAV_ITEMS.map(({ key, label }) => [key, label]));

export function pageTitle(page) {
  if (page === "idea") return "Idea";
  if (page === "article") return "Library";
  if (page === "quiz") return "Ignite Your Knowledge";
  return TITLES[page] ?? TITLES.community;
}

export function isActiveNav(itemKey, page) {
  return itemKey === page || (itemKey === "learn" && page === "quiz") || (itemKey === "library" && page === "article");
}
