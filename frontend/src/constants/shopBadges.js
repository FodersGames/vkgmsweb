// Single source of truth for shop product badges — used by both the admin
// picker (ShopManagement) and the public storefront (Shop). Previously these
// were two hand-maintained lookup tables that had to be kept in sync by hand;
// drift between them meant a badge could render differently (or not at all)
// depending on which screen you were looking at.
export const SHOP_BADGES = [
  { value: 'NEW',       label: 'New',        bg: '#4ECDC4', text: '#fff' },
  { value: 'SALE',      label: 'Sale',       bg: '#EB5757', text: '#fff' },
  { value: 'LIMITED',   label: 'Limited',    bg: '#F2994A', text: '#fff' },
  { value: 'HOT',       label: 'Hot 🔥',     bg: '#FF6B6B', text: '#fff' },
  { value: 'POPULAR',   label: 'Popular',    bg: '#A29BFE', text: '#fff' },
  { value: 'BEST',      label: 'Best Value', bg: '#F59E0B', text: '#fff' },
  { value: 'BUNDLE',    label: 'Bundle',     bg: '#6C5CE7', text: '#fff' },
  { value: 'EXCLUSIVE', label: '✦ Exclusive', bg: '#1D1D1F', text: '#4ECDC4' },
];

export const SHOP_BADGE_MAP = Object.fromEntries(SHOP_BADGES.map(b => [b.value, b]));
