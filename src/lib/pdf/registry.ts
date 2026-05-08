// ============================================================
// ProposalJá — Template Registry
// Central registry of all available PDF templates.
// To add a new template:
//   1. Create a render file (e.g. src/lib/pdf/mytemplate.ts)
//   2. Create a theme in themes.ts
//   3. Register here
// ============================================================

import type { TemplateEntry } from './types';
import { classicTheme, modernTheme, executiveTheme, sleekTheme, sidebarTheme, businessTheme } from './themes';

// Lazy imports to avoid circular deps — render functions are registered below
import { renderClassic } from './classic';
import { renderModern } from './modern';
import { renderExecutive } from './executive';
import { renderSleek } from './sleek';
import { renderSidebar } from './sidebar';
import { renderBusiness } from './business';

const templates: Map<string, TemplateEntry> = new Map([
  [
    'classic',
    {
      id: 'classic',
      nome: 'Clássico',
      descricao: 'Design limpo e profissional com barra de cabeçalho colorida',
      render: renderClassic,
      theme: classicTheme,
      pro: false,
    },
  ],
  [
    'modern',
    {
      id: 'modern',
      nome: 'Moderno',
      descricao: 'Estilo centralizado com fundo claro e elementos elegantes',
      render: renderModern,
      theme: modernTheme,
      pro: false,
    },
  ],
  [
    'executive',
    {
      id: 'executive',
      nome: 'Executivo',
      descricao: 'Barra de acento lateral, separadores decorativos, tipografia refinada',
      render: renderExecutive,
      theme: executiveTheme,
      pro: false,
    },
  ],
  [
    'sleek',
    {
      id: 'sleek',
      nome: 'Sleek',
      descricao: 'Colorido e moderno com badges, stripe de acento e totais em cartão',
      render: renderSleek,
      theme: sleekTheme,
      pro: true,
    },
  ],
  [
    'sidebar',
    {
      id: 'sidebar',
      nome: 'Sidebar',
      descricao: 'Barra lateral escura com dados da empresa e pagamento integrado',
      render: renderSidebar,
      theme: sidebarTheme,
      pro: true,
    },
  ],
  [
    'business',
    {
      id: 'business',
      nome: 'Business',
      descricao: 'Minimalista e profissional, estilo factura premium',
      render: renderBusiness,
      theme: businessTheme,
      pro: true,
    },
  ],
]);

/** Get a template entry by ID (falls back to classic) */
export function getTemplate(id: string): TemplateEntry {
  return templates.get(id) ?? templates.get('classic')!;
}

/** Get all registered templates */
export function getAllTemplates(): TemplateEntry[] {
  return Array.from(templates.values());
}

/** Get only free templates */
export function getFreeTemplates(): TemplateEntry[] {
  return getAllTemplates().filter(t => !t.pro);
}

/** Get only PRO templates */
export function getProTemplates(): TemplateEntry[] {
  return getAllTemplates().filter(t => t.pro);
}

/** Check if a template requires PRO */
export function isProTemplate(id: string): boolean {
  return getTemplate(id).pro ?? false;
}
