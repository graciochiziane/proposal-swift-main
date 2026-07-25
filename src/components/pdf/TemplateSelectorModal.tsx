import React from 'react';
import { Check, Crown, FileText } from 'lucide-react';
import type { PDFTemplate } from '@/types';
import { getAllTemplates, isProTemplate } from '@/lib/pdf';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface TemplateSelectorModalProps {
  value: PDFTemplate;
  onChange: (template: PDFTemplate) => void;
  children: React.ReactNode;
}

// ── Miniature CSS thumbnail for each template style ──

function ThumbnailClassic() {
  return (
    <div className="w-full aspect-[4/5] bg-white rounded-md overflow-hidden border border-gray-200 flex flex-col">
      {/* Blue header bar */}
      <div className="h-[18%] bg-blue-600" />
      {/* Info line */}
      <div className="px-2 py-1.5">
        <div className="flex gap-1">
          <div className="h-1 w-[60%] bg-gray-300 rounded-full" />
          <div className="h-1 w-[30%] bg-gray-200 rounded-full" />
        </div>
        <div className="h-1 w-[45%] bg-gray-200 rounded-full mt-1" />
      </div>
      {/* Table */}
      <div className="px-2 flex-1">
        {/* Table header */}
        <div className="h-2.5 bg-blue-50 rounded-sm mb-px" />
        {/* Table rows */}
        <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
        <div className="h-1.5 bg-white border-b border-gray-100" />
        <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
        <div className="h-1.5 bg-white border-b border-gray-100" />
        {/* Totals */}
        <div className="mt-1.5 flex justify-end">
          <div className="h-2.5 w-[50%] bg-blue-600 rounded-sm" />
        </div>
      </div>
      {/* Footer */}
      <div className="h-[8%] border-t border-gray-200" />
    </div>
  );
}

function ThumbnailModern() {
  return (
    <div className="w-full aspect-[4/5] bg-gray-50 rounded-md overflow-hidden border border-gray-200 flex flex-col items-center">
      {/* Light gray header - centered */}
      <div className="w-[70%] mt-2 mb-1 flex flex-col items-center">
        <div className="h-2 w-[40%] bg-gray-400 rounded-full" />
        <div className="h-0.5 w-[55%] bg-gray-300 rounded-full mt-1" />
      </div>
      {/* Content area with rounded card feel */}
      <div className="w-[85%] flex-1 bg-white rounded-lg shadow-sm border border-gray-100 px-2 py-1.5">
        <div className="h-1.5 bg-gray-100 rounded-full mb-1" />
        <div className="h-1.5 bg-gray-100 rounded-full mb-1" />
        {/* Table */}
        <div className="h-2 bg-gray-100 rounded-sm mt-2 mb-px" />
        <div className="h-1.5 bg-gray-50 rounded-sm" />
        <div className="h-1.5 bg-gray-100 rounded-sm" />
        <div className="h-1.5 bg-gray-50 rounded-sm" />
        {/* Total */}
        <div className="mt-1.5 flex justify-end">
          <div className="h-2.5 w-[45%] bg-gray-800 rounded-sm" />
        </div>
      </div>
      {/* Footer */}
      <div className="w-full h-[8%] flex items-center justify-center">
        <div className="h-0.5 w-[30%] bg-gray-300 rounded-full" />
      </div>
    </div>
  );
}

function ThumbnailExecutive() {
  return (
    <div className="w-full aspect-[4/5] bg-white rounded-md overflow-hidden border border-gray-200 flex">
      {/* Left accent bar */}
      <div className="w-[8%] bg-gray-900" />
      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Header area */}
        <div className="px-2 py-1.5">
          <div className="h-2 w-[35%] bg-gray-800 rounded-sm" />
          <div className="h-0.5 w-[50%] bg-gray-300 rounded-full mt-1" />
        </div>
        {/* Decorative separator */}
        <div className="mx-2 h-px bg-gray-900" />
        {/* Table */}
        <div className="px-2 flex-1">
          <div className="h-2 bg-gray-100 rounded-sm mt-1.5 mb-px" />
          <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
          <div className="h-1.5 bg-white border-b border-gray-100" />
          <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
          {/* Separator */}
          <div className="h-px bg-gray-300 mt-1.5 mb-1" />
          {/* Total */}
          <div className="flex justify-end">
            <div className="h-2.5 w-[50%] bg-gray-900 rounded-sm" />
          </div>
        </div>
        {/* Footer */}
        <div className="h-[8%] border-t border-gray-200" />
      </div>
    </div>
  );
}

function ThumbnailSleek() {
  return (
    <div className="w-full aspect-[4/5] bg-white rounded-md overflow-hidden border border-gray-200 flex flex-col">
      {/* Colorful header with stripe accent */}
      <div className="h-[18%] bg-gradient-to-r from-violet-600 to-indigo-500 relative">
        {/* Stripe accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-400" />
        {/* Badge-style element */}
        <div className="absolute top-1 right-1.5 bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5">
          <div className="h-1 w-4 bg-white/70 rounded-full" />
        </div>
      </div>
      {/* Info */}
      <div className="px-2 py-1.5">
        <div className="flex gap-1">
          <div className="h-1 w-[55%] bg-gray-300 rounded-full" />
          <div className="h-1 w-[25%] bg-gray-200 rounded-full" />
        </div>
      </div>
      {/* Table */}
      <div className="px-2 flex-1">
        <div className="h-2.5 bg-violet-50 rounded-sm" />
        <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
        <div className="h-1.5 bg-white border-b border-gray-100" />
        <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
        {/* Totals in card */}
        <div className="mt-1.5 bg-violet-50 rounded-md p-1.5 border border-violet-100">
          <div className="h-1 w-[40%] bg-gray-200 rounded-full mb-1" />
          <div className="flex justify-end">
            <div className="h-2.5 w-[55%] bg-gradient-to-r from-violet-600 to-indigo-500 rounded-sm" />
          </div>
        </div>
      </div>
      {/* Branded footer */}
      <div className="h-[8%] border-t-2 border-violet-200" />
    </div>
  );
}

function ThumbnailSidebar() {
  return (
    <div className="w-full aspect-[4/5] bg-white rounded-md overflow-hidden border border-gray-200 flex">
      {/* Dark sidebar */}
      <div className="w-[28%] bg-gray-900 flex flex-col items-center pt-2">
        <div className="w-4 h-4 rounded-full bg-gray-700" />
        <div className="h-0.5 w-[80%] bg-gray-600 rounded-full mt-1.5" />
        <div className="h-0.5 w-[60%] bg-gray-700 rounded-full mt-0.5" />
        <div className="mt-3 flex flex-col gap-1 w-[80%]">
          <div className="h-0.5 w-full bg-gray-700 rounded-full" />
          <div className="h-0.5 w-[70%] bg-gray-700 rounded-full" />
          <div className="h-0.5 w-[85%] bg-gray-700 rounded-full" />
        </div>
      </div>
      {/* White content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-2 py-1.5">
          <div className="h-2 w-[50%] bg-gray-300 rounded-sm" />
          <div className="h-0.5 w-[65%] bg-gray-200 rounded-full mt-1" />
        </div>
        {/* Table with grid lines */}
        <div className="px-2 flex-1">
          <div className="h-2 bg-gray-800 rounded-sm" />
          <div className="h-1.5 border border-gray-200 bg-gray-50" />
          <div className="h-1.5 border border-gray-200 bg-white" />
          <div className="h-1.5 border border-gray-200 bg-gray-50" />
          {/* Total card */}
          <div className="mt-1.5 bg-gray-100 rounded-md p-1 border border-gray-200">
            <div className="flex justify-end">
              <div className="h-2 w-[60%] bg-gray-800 rounded-sm" />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="h-[8%] border-t border-gray-200" />
      </div>
    </div>
  );
}

function ThumbnailBusiness() {
  return (
    <div className="w-full aspect-[4/5] bg-white rounded-md overflow-hidden border border-gray-200 flex flex-col">
      {/* Dark gray header */}
      <div className="h-[15%] bg-gray-700" />
      {/* Minimal info */}
      <div className="px-2 py-1.5 flex justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="h-1 w-12 bg-gray-300 rounded-full" />
          <div className="h-1 w-8 bg-gray-200 rounded-full" />
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <div className="h-1 w-10 bg-gray-300 rounded-full" />
          <div className="h-1 w-7 bg-gray-200 rounded-full" />
        </div>
      </div>
      {/* Grayscale table */}
      <div className="px-2 flex-1">
        <div className="h-2 bg-gray-700 rounded-sm" />
        <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
        <div className="h-1.5 bg-white border-b border-gray-100" />
        <div className="h-1.5 bg-gray-50 border-b border-gray-100" />
        {/* Minimal totals */}
        <div className="mt-1.5 flex flex-col gap-0.5 items-end">
          <div className="h-1 w-[55%] bg-gray-200 rounded-full" />
          <div className="h-2.5 w-[45%] bg-gray-700 rounded-sm" />
        </div>
      </div>
      {/* Detailed footer */}
      <div className="h-[10%] border-t border-gray-300 flex items-center justify-center">
        <div className="h-0.5 w-[50%] bg-gray-300 rounded-full" />
      </div>
    </div>
  );
}

// Map template IDs to their thumbnail components
const thumbnailMap: Record<string, React.FC> = {
  classic: ThumbnailClassic,
  modern: ThumbnailModern,
  executive: ThumbnailExecutive,
  sleek: ThumbnailSleek,
  sidebar: ThumbnailSidebar,
  business: ThumbnailBusiness,
};

export default function TemplateSelectorModal({
  value,
  onChange,
  children,
}: TemplateSelectorModalProps) {
  const [open, setOpen] = React.useState(false);
  const templates = getAllTemplates();
  const freeTemplates = templates.filter((t) => !t.pro);
  const proTemplates = templates.filter((t) => t.pro);

  function handleSelect(id: string) {
    onChange(id as PDFTemplate);
    setOpen(false);
  }

  function renderCard(t: (typeof templates)[0]) {
    const isSelected = t.id === value;
    const Thumbnail = thumbnailMap[t.id] || FileText;

    return (
      <button
        key={t.id}
        type="button"
        onClick={() => handleSelect(t.id)}
        className={
          'relative flex flex-col rounded-xl border-2 p-3 text-left transition-all hover:shadow-md cursor-pointer ' +
          (isSelected
            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
            : 'border-border hover:border-primary/40')
        }
      >
        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} />
          </div>
        )}

        {/* Thumbnail */}
        <div className="mb-2.5">
          {typeof Thumbnail === 'function' && Thumbnail.name === 'FileText' ? (
            <div className="flex h-[140px] items-center justify-center rounded-lg bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          ) : (
            <Thumbnail />
          )}
        </div>

        {/* Info */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">
            {t.nome}
          </span>
          {t.pro && (
            <Badge
              variant="default"
              className="gap-0.5 bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px] px-1.5 py-0"
            >
              <Crown className="h-2.5 w-2.5" />
              PRO
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground line-clamp-2">
          {t.descricao}
        </p>
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Seleccionar Template de PDF
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Escolha o estilo visual para a sua proposta
          </p>
        </DialogHeader>

        {/* Free templates section */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gratuito
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {freeTemplates.map(renderCard)}
          </div>
        </div>

        {/* PRO templates section */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            PRO
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {proTemplates.map(renderCard)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
