import React from 'react';

// Single source of truth for the careers system — used by both the public
// Careers page and the admin CareersManagement screen. Previously the
// department/tool lists (and even the ToolIcon renderer) were duplicated
// between the two, and the public page imported ToolIcon straight out of an
// admin-only component file. One drifted from the other easily; this is the
// only place either side should define these.

export const DEPARTMENT_META = {
  'Development':  { color: '#4ECDC4' },
  'Art & Design': { color: '#6C5CE7' },
  'Game Design':  { color: '#F2994A' },
  'Marketing':    { color: '#EB5757' },
  'Community':    { color: '#2F80ED' },
  'Sound':        { color: '#9B59B6' },
  'Writing':      { color: '#27AE60' },
  'Other':        { color: '#6E6E73' },
};
export const DEPARTMENTS = Object.keys(DEPARTMENT_META);
export const departmentColor = (dept) => DEPARTMENT_META[dept]?.color || DEPARTMENT_META['Other'].color;

export const CONTRACT_TYPES = ['Volunteer', 'Internship', 'Part-time', 'Full-time', 'Freelance'];

export const TOOL_OPTIONS = [
  { id: 'turbowarp', label: 'TurboWarp' },
  { id: 'scratch', label: 'Scratch' },
  { id: 'unity', label: 'Unity' },
  { id: 'unreal', label: 'Unreal Engine' },
  { id: 'blender', label: 'Blender' },
  { id: 'godot', label: 'Godot' },
  { id: 'figma', label: 'Figma' },
  { id: 'canva', label: 'Canva' },
  { id: 'illustrator', label: 'Illustrator' },
  { id: 'photoshop', label: 'Photoshop' },
  { id: 'aftereffects', label: 'After Effects' },
  { id: 'premiere', label: 'Premiere Pro' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'github', label: 'GitHub' },
  { id: 'notion', label: 'Notion' },
  { id: 'discord', label: 'Discord' },
];
export const TOOL_LABELS = Object.fromEntries(TOOL_OPTIONS.map(t => [t.id, t.label]));

export function ToolIcon({ toolId, size = 18 }) {
  const svgs = {
    turbowarp: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="45" fill="#9B59B6" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="bold" fill="white">T</text>
      </svg>
    ),
    scratch: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#FF6633" />
        <text x="50" y="70" textAnchor="middle" fontSize="52" fontWeight="bold" fill="white">S</text>
      </svg>
    ),
    unity: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#222" />
        <circle cx="50" cy="50" r="26" stroke="white" strokeWidth="6" fill="none" />
        <line x1="50" y1="24" x2="50" y2="76" stroke="white" strokeWidth="5" />
        <line x1="24" y1="62" x2="50" y2="50" stroke="white" strokeWidth="5" />
        <line x1="76" y1="62" x2="50" y2="50" stroke="white" strokeWidth="5" />
      </svg>
    ),
    blender: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#EA7600" />
        <circle cx="62" cy="44" r="18" fill="white" />
        <circle cx="62" cy="44" r="10" fill="#EA7600" />
        <circle cx="35" cy="64" r="14" fill="white" opacity="0.8" />
      </svg>
    ),
    figma: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#1E1E1E" />
        <rect x="32" y="14" width="18" height="18" rx="9" fill="#F24E1E" />
        <rect x="50" y="14" width="18" height="18" rx="9" fill="#FF7262" />
        <rect x="32" y="32" width="18" height="18" rx="0" fill="#A259FF" />
        <rect x="32" y="50" width="18" height="18" rx="9" fill="#0ACF83" />
        <circle cx="59" cy="41" r="9" fill="#1ABCFE" />
      </svg>
    ),
    canva: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#00C4CC" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="bold" fill="white">C</text>
      </svg>
    ),
    illustrator: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#FF9A00" />
        <text x="50" y="68" textAnchor="middle" fontSize="38" fontWeight="900" fill="white">Ai</text>
      </svg>
    ),
    photoshop: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#001E36" />
        <text x="50" y="68" textAnchor="middle" fontSize="36" fontWeight="900" fill="#31A8FF">Ps</text>
      </svg>
    ),
    aftereffects: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#00005B" />
        <text x="50" y="68" textAnchor="middle" fontSize="36" fontWeight="900" fill="#9999FF">Ae</text>
      </svg>
    ),
    premiere: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#00005B" />
        <text x="50" y="68" textAnchor="middle" fontSize="34" fontWeight="900" fill="#E77BF3">Pr</text>
      </svg>
    ),
    vscode: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#007ACC" />
        <path d="M70 20L40 50L70 80L82 70L56 50L82 30Z" fill="white" />
        <path d="M18 35L40 50L18 65V35Z" fill="white" opacity="0.6" />
        <path d="M70 20L82 30V70L70 80V20Z" fill="white" opacity="0.8" />
      </svg>
    ),
    github: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#24292F" />
        <path d="M50 15C31 15 15 31 15 50C15 65.4 25.1 78.5 39 83.1C40.8 83.4 41.4 82.3 41.4 81.3V74.5C32 76.6 29.9 70.3 29.9 70.3C28.3 66.2 25.9 65.1 25.9 65.1C22.6 62.9 26.2 63 26.2 63C29.9 63.3 31.8 66.8 31.8 66.8C35.1 72.3 40.5 70.7 41.6 69.8C41.9 67.5 42.9 66 43.9 65.1C36.5 64.3 28.7 61.4 28.7 48.8C28.7 44.9 30.1 41.7 32 39.2C31.6 38.3 30.4 34.6 32.4 29.6C32.4 29.6 35.4 28.6 41.4 33.4C43.9 32.6 46.6 32.2 49.2 32.2C51.8 32.2 54.5 32.6 57 33.4C63 28.6 66 29.6 66 29.6C68 34.6 66.8 38.3 66.4 39.2C68.3 41.7 69.7 44.9 69.7 48.8C69.7 61.5 61.9 64.3 54.5 65.1C55.7 66.2 56.8 68.4 56.8 71.8V81.3C56.8 82.3 57.4 83.5 59.2 83.1C73.1 78.5 83.1 65.4 83.1 50C83 31 67 15 50 15Z" fill="white" />
      </svg>
    ),
    notion: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="white" />
        <rect width="100" height="100" rx="18" fill="white" stroke="#E5E5E5" strokeWidth="2" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="900" fill="#191919">N</text>
      </svg>
    ),
    discord: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#5865F2" />
        <path d="M67 32C63.1 30.2 59 29 54.7 28.5L54.1 29.7C58.1 30.6 61.9 32 65.4 33.9C60.2 31.1 54.3 29.5 48.1 29.5C42 29.5 36.1 31.1 30.9 33.9C34.4 32 38.2 30.6 42.2 29.7L41.6 28.5C37.3 29 33.2 30.2 29.3 32C22.4 42.1 19.8 51.9 20.8 61.5C25.5 65.2 30.1 67.4 34.6 68.9C35.7 67.4 36.7 65.8 37.5 64.2C35.8 63.5 34.2 62.7 32.7 61.7L33.4 61L33.5 60.9C44 66 56.1 66 66.4 60.9L66.5 61L67.2 61.7C65.7 62.7 64.1 63.6 62.4 64.2C63.2 65.8 64.2 67.4 65.3 68.9C69.8 67.4 74.4 65.2 79.1 61.5C80.3 50.3 77.1 40.6 67 32ZM39.8 55.5C37.3 55.5 35.2 53.2 35.2 50.3C35.2 47.4 37.2 45.1 39.8 45.1C42.4 45.1 44.5 47.4 44.4 50.3C44.4 53.2 42.3 55.5 39.8 55.5ZM60.5 55.5C58 55.5 55.9 53.2 55.9 50.3C55.9 47.4 57.9 45.1 60.5 45.1C63.1 45.1 65.2 47.4 65.1 50.3C65.1 53.2 63 55.5 60.5 55.5Z" fill="white" />
      </svg>
    ),
    godot: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#478CBF" />
        <circle cx="50" cy="50" r="26" fill="white" />
        <circle cx="50" cy="50" r="18" fill="#478CBF" />
        <circle cx="42" cy="44" r="5" fill="white" />
        <circle cx="58" cy="44" r="5" fill="white" />
      </svg>
    ),
    unreal: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#1A1A1A" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="900" fill="white">U</text>
      </svg>
    ),
  };
  return svgs[toolId] || (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="18" fill="#D2D2D7" />
      <text x="50" y="68" textAnchor="middle" fontSize="44" fill="#6E6E73">?</text>
    </svg>
  );
}
