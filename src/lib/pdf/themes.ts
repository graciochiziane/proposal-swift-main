// ============================================================
// ProposalJá — Predefined PDF Themes
// Each theme controls how shared functions render tables,
// totals, payment methods, footer, and narrative blocks.
// ============================================================

import type { PdfTheme } from './types';

// ── Default theme (matches current shared.ts behavior exactly) ──

export const defaultTheme: PdfTheme = {
  table: {},
  totals: {},
  payment: {},
  footer: {},
  narrative: { enabled: false },
};

// ── Classic Theme ──
// Clean, professional — header bar with brand color, two-column info

export const classicTheme: PdfTheme = {
  table: {
    headerBg: undefined, // computed from primary
    headerColor: undefined, // = primary
    altRowBg: [248, 250, 252],
    borderColor: [220, 225, 230],
    borderWidth: 0.2,
    headerFontSize: 8,
    bodyFontSize: 9,
    cellPadding: 5,
    theme: 'plain',
  },
  totals: {
    position: 'right',
    showCard: false,
    totalHighlight: true,
    spacingBefore: 10,
  },
  payment: {
    position: 'inline',
    style: 'list',
    title: 'METODOS DE PAGAMENTO',
    showReferenceNote: true,
  },
  footer: {
    style: 'minimal',
    showBranding: true,
    showDate: true,
  },
};

// ── Modern Theme ──
// Centered brand, light header background, elegant spacing

export const modernTheme: PdfTheme = {
  table: {
    altRowBg: [248, 250, 252],
    headerFontSize: 8,
    bodyFontSize: 9,
    cellPadding: 5,
    theme: 'plain',
  },
  totals: {
    position: 'right',
    showCard: false,
    totalHighlight: true,
    spacingBefore: 10,
  },
  payment: {
    position: 'inline',
    style: 'list',
    showReferenceNote: true,
  },
  footer: {
    style: 'minimal',
    showBranding: true,
    showDate: true,
  },
};

// ── Executive Theme ──
// Left accent bar, decorative separators, refined typography

export const executiveTheme: PdfTheme = {
  table: {
    altRowBg: [250, 251, 253],
    headerFontSize: 8,
    bodyFontSize: 9,
    cellPadding: 5,
    theme: 'plain',
  },
  totals: {
    position: 'right',
    showCard: false,
    totalHighlight: true,
    spacingBefore: 10,
  },
  payment: {
    position: 'inline',
    style: 'list',
    showReferenceNote: true,
  },
  footer: {
    style: 'minimal',
    showBranding: true,
    showDate: true,
  },
};

// ── Sleek Theme ──
// Colorful with badges, accent stripes, modern corporate feel

export const sleekTheme: PdfTheme = {
  table: {
    headerBg: undefined, // computed from primary (full saturation)
    headerColor: [255, 255, 255],
    altRowBg: [245, 248, 252],
    borderColor: [200, 210, 225],
    borderWidth: 0.3,
    headerFontSize: 8.5,
    bodyFontSize: 9,
    cellPadding: 6,
    theme: 'plain',
  },
  totals: {
    position: 'right',
    showCard: true,
    cardBg: undefined, // computed: lighten(primary, 0.94)
    cardBorder: undefined, // = primary
    totalHighlight: true,
    totalBg: undefined, // = primary
    totalTextColor: [255, 255, 255],
    spacingBefore: 12,
  },
  payment: {
    position: 'cards',
    style: 'detailed',
    title: 'DADOS DE PAGAMENTO',
    showReferenceNote: true,
  },
  footer: {
    style: 'branded',
    showBranding: true,
    showDate: true,
    lineColor: undefined, // = primary with low opacity approx
    textColor: [120, 130, 145],
    fontSize: 7,
  },
};

// ── Sidebar Theme ──
// Dark left sidebar with company info + payment details

export const sidebarTheme: PdfTheme = {
  table: {
    headerBg: undefined, // computed: darker shade
    headerColor: [255, 255, 255],
    altRowBg: [248, 250, 252],
    borderColor: [210, 215, 220],
    borderWidth: 0.2,
    headerFontSize: 8,
    bodyFontSize: 9,
    cellPadding: 5,
    theme: 'grid',
  },
  totals: {
    position: 'right',
    showCard: true,
    cardBg: [245, 247, 250],
    cardBorder: [180, 190, 200],
    totalHighlight: true,
    totalBg: undefined, // = primary
    totalTextColor: [255, 255, 255],
    spacingBefore: 10,
  },
  payment: {
    position: 'sidebar',
    style: 'compact',
    title: 'PAGAMENTO',
    showReferenceNote: false,
  },
  footer: {
    style: 'minimal',
    showBranding: true,
    showDate: true,
    textColor: [150, 160, 170],
  },
};

// ── Business Theme ──
// Minimalist, clean, professional grayscale feel

export const businessTheme: PdfTheme = {
  table: {
    headerBg: [55, 65, 81],
    headerColor: [255, 255, 255],
    altRowBg: [250, 250, 252],
    borderColor: [220, 222, 228],
    borderWidth: 0.2,
    headerFontSize: 8,
    bodyFontSize: 9,
    cellPadding: 5,
    theme: 'plain',
    columnRatios: [0.46, 0.1, 0.22, 0.22],
  },
  totals: {
    position: 'right',
    showCard: false,
    totalHighlight: true,
    totalBg: [55, 65, 81],
    totalTextColor: [255, 255, 255],
    spacingBefore: 10,
    currencyLabel: 'MT',
  },
  payment: {
    position: 'inline',
    style: 'compact',
    title: 'PAGAMENTO',
    showReferenceNote: true,
  },
  footer: {
    style: 'detailed',
    showBranding: true,
    showDate: true,
    lineColor: [200, 205, 212],
    textColor: [130, 135, 145],
    fontSize: 7,
  },
};

// ── Helper: get theme by ID ──

const themeMap: Record<string, PdfTheme> = {
  classic: classicTheme,
  modern: modernTheme,
  executive: executiveTheme,
  sleek: sleekTheme,
  sidebar: sidebarTheme,
  business: businessTheme,
};

export function getTheme(id: string): PdfTheme {
  return themeMap[id] ?? defaultTheme;
}

export function getAllThemes(): Record<string, PdfTheme> {
  return themeMap;
}
