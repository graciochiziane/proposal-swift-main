// ============================================================
// ClienteCombobox — Dropdown pesquisável com autocomplete
//
// Substitui o <select> padrão por um input que filtra a lista
// de clientes em tempo real. Ideal para listas extensas.
// ============================================================

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import type { Cliente } from '@/types';

interface ClienteComboboxProps {
  clientes: Cliente[];
  value: string;
  onChange: (clienteId: string) => void;
  placeholder?: string;
  /** Classes CSS aplicadas ao container do input */
  className?: string;
}

export function ClienteCombobox({
  clientes,
  value,
  onChange,
  placeholder = 'Selecionar cliente',
  className = '',
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cliente seleccionado (para mostrar o nome quando fechado)
  const selectedCliente = useMemo(
    () => clientes.find(c => c.id === value) ?? null,
    [clientes, value]
  );

  // Filtrar clientes pela pesquisa
  const filtered = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase().trim();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.empresa && c.empresa.toLowerCase().includes(q)) ||
      (c.nuit && c.nuit.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clientes, search]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Focar no input quando abre
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSelect = (clienteId: string) => {
    onChange(clienteId);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[0].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input / Display */}
      <div
        className="flex items-center gap-2 w-full px-3 md:px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm cursor-pointer transition-shadow focus-within:ring-2 focus-within:ring-primary/50"
        onClick={() => !open && setOpen(true)}
      >
        {open ? (
          <>
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Procurar por nome, empresa, NUIT..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              onClick={e => e.stopPropagation()}
            />
          </>
        ) : (
          <>
            <span className={`flex-1 truncate ${selectedCliente ? 'text-foreground' : 'text-muted-foreground'}`}>
              {selectedCliente
                ? `${selectedCliente.nome}${selectedCliente.empresa ? ` — ${selectedCliente.empresa}` : ''}`
                : placeholder}
            </span>
            {selectedCliente && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Limpar selecção"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-fade-up">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {search.trim()
                ? `Nenhum cliente encontrado para "${search}"`
                : 'Nenhum cliente disponível'}
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                  c.id === value ? 'bg-accent/50' : ''
                }`}
              >
                <Check className={`h-4 w-4 shrink-0 ${c.id === value ? 'opacity-100 text-primary' : 'opacity-0'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.nome}</div>
                  {c.empresa && (
                    <div className="text-xs text-muted-foreground truncate">{c.empresa}</div>
                  )}
                </div>
                {c.nuit && (
                  <span className="text-xs text-muted-foreground/60 shrink-0">
                    NUIT: {c.nuit}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
