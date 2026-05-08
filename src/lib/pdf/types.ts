// ============================================================
// ProposalJá — PDF Theme System Types
// Each template defines its visual style through a PdfTheme.
// Shared functions (drawItemsTable, drawTotals, etc.) read from
// ctx.theme with sensible defaults matching the current behavior.
// ============================================================

export interface PdfThemeTable {
  /** Header background color (RGB) — default: lighten(primary, 0.85) */
  headerBg?: [number, number, number];
  /** Header text color (RGB) — default: primary */
  headerColor?: [number, number, number];
  /** Alternating row background (RGB) — default: [248, 250, 252] */
  altRowBg?: [number, number, number];
  /** Border color (RGB) — default: [220, 225, 230] */
  borderColor?: [number, number, number];
  /** Border width — default: 0.2 */
  borderWidth?: number;
  /** Header font size — default: 8 */
  headerFontSize?: number;
  /** Body font size — default: 9 */
  bodyFontSize?: number;
  /** Cell padding — default: 5 */
  cellPadding?: number;
  /** AutoTable theme — default: 'plain' */
  theme?: 'plain' | 'grid' | 'striped';
  /** Custom column widths ratios (must sum to ~1) — default: [0.45, 0.1, 0.22, 0.23] */
  columnRatios?: [number, number, number, number];
}

export interface PdfThemeTotals {
  /** Horizontal position — default: 'right' */
  position?: 'right' | 'left' | 'center';
  /** Show background card behind totals — default: false */
  showCard?: boolean;
  /** Card background color (RGB) — default: lighten(primary, 0.95) */
  cardBg?: [number, number, number];
  /** Card border color (RGB) — default: primary */
  cardBorder?: [number, number, number];
  /** Highlight the total row — default: true */
  totalHighlight?: boolean;
  /** Total row background color (RGB) — default: primary */
  totalBg?: [number, number, number];
  /** Total row text color (RGB) — default: [255, 255, 255] */
  totalTextColor?: [number, number, number];
  /** Spacing before totals (mm) — default: 10 */
  spacingBefore?: number;
  /** Currency label — default: 'MT' */
  currencyLabel?: string;
}

export interface PdfThemePayment {
  /** Where to render payment info — default: 'inline' */
  position?: 'inline' | 'cards' | 'sidebar' | 'hidden';
  /** Visual style — default: 'list' */
  style?: 'list' | 'compact' | 'detailed';
  /** Section title — default: 'METODOS DE PAGAMENTO' */
  title?: string;
  /** Show reference note — default: true */
  showReferenceNote?: boolean;
}

export interface PdfThemeFooter {
  /** Visual style — default: 'minimal' */
  style?: 'minimal' | 'branded' | 'detailed';
  /** Show PropostaJá branding — default: true */
  showBranding?: boolean;
  /** Custom text (overrides default branding) */
  customText?: string;
  /** Show date — default: true */
  showDate?: boolean;
  /** Separator line color (RGB) — default: [220, 225, 230] */
  lineColor?: [number, number, number];
  /** Text color (RGB) — default: [160, 170, 180] */
  textColor?: [number, number, number];
  /** Font size — default: 7 */
  fontSize?: number;
}

/** Narrative styles for AI-generated proposal sections */
export interface PdfThemeNarrative {
  /** Enable narrative blocks (AI proposals) — default: false */
  enabled?: boolean;
  /** Section heading font — default: 'helvetica' */
  headingFont?: string;
  /** Section heading size — default: 14 */
  headingSize?: number;
  /** Section heading bold — default: true */
  headingBold?: boolean;
  /** Section heading color (RGB) — default: primary */
  headingColor?: [number, number, number];
  /** Heading underline — default: false */
  headingUnderline?: boolean;
  /** Spacing after heading (mm) — default: 4 */
  headingMarginBottom?: number;
  /** Body text font — default: 'helvetica' */
  bodyFont?: string;
  /** Body text size — default: 10 */
  bodySize?: number;
  /** Body text color (RGB) — default: [50, 55, 60] */
  bodyColor?: [number, number, number];
  /** Line height multiplier — default: 1.5 */
  lineHeight?: number;
  /** Body text alignment — default: 'left' */
  bodyAlign?: 'left' | 'justify';
  /** Spacing after body (mm) — default: 8 */
  bodyMarginBottom?: number;
  /** Section separator type — default: 'space' */
  sectionSeparator?: 'line' | 'space' | 'none';
  /** Separator line color — default: [220, 225, 230] */
  separatorColor?: [number, number, number];
  /** Bullet style for lists — default: 'dot' */
  bulletStyle?: 'dot' | 'check' | 'arrow' | 'dash';
  /** Bullet indent (mm) — default: 8 */
  bulletIndent?: number;
}

/** Complete theme definition for a PDF template */
export interface PdfTheme {
  /** Brand/primary color override (hex string) — defaults to dono.corPrimaria */
  brandColor?: string;
  /** Table styling */
  table: PdfThemeTable;
  /** Totals block styling */
  totals: PdfThemeTotals;
  /** Payment methods styling */
  payment: PdfThemePayment;
  /** Footer styling */
  footer: PdfThemeFooter;
  /** Narrative/AI proposal blocks styling */
  narrative?: PdfThemeNarrative;
}

/** A narrative section generated by AI */
export interface NarrativeSection {
  /** Section title e.g. "1. Contexto" */
  titulo: string;
  /** Section body text (may contain \n) */
  texto: string;
  /** Optional bullet items (for "Beneficios", "Modulos", etc.) */
  itens?: string[];
}

/** Template registration entry */
export interface TemplateEntry {
  /** Unique template ID */
  id: string;
  /** Display name (Portuguese) */
  nome: string;
  /** Short description */
  descricao: string;
  /** Render function */
  render: (proposta: import('@/types').Proposta, cliente?: import('@/types').Cliente, dono?: import('@/types').DonoProposta, narrative?: NarrativeSection[]) => Promise<void>;
  /** Theme associated with this template */
  theme: PdfTheme;
  /** Whether this template requires PRO plan */
  pro?: boolean;
}
