import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Pencil, X, Loader2 } from 'lucide-react';
import { CatalogService } from '@/services/catalogService';
import { toast } from 'sonner';
import type { CatalogoItem } from '@/types';

export default function Catalogo() {
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: '', precoUnitario: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    try {
      const data = await CatalogService.getCatalogo();
      setItems(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar catálogo');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  const resetForm = () => {
    setForm({ nome: '', precoUnitario: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    const nomeTrimmed = form.nome.trim();
    const preco = parseFloat(form.precoUnitario);

    if (!nomeTrimmed) {
      toast.error('Nome do item é obrigatório');
      return;
    }

    if (isNaN(preco) || preco < 0) {
      toast.error('Preço unitário inválido');
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        // Edição: criar novo item com o nome e preço actualizados
        // O upsert vai actualizar o registo existente (mesmo owner_id + nome)
        await CatalogService.salvarItem({
          nome: nomeTrimmed,
          precoUnitario: preco,
        });

        // Se o nome mudou, remover o item antigo
        const originalItem = items.find(i => i.id === editingId);
        if (originalItem && originalItem.nome !== nomeTrimmed) {
          await CatalogService.removerItem(editingId);
        }

        toast.success('Item atualizado');
      } else {
        await CatalogService.salvarItem({
          nome: nomeTrimmed,
          precoUnitario: preco,
        });
        toast.success('Item adicionado ao catálogo');
      }

      resetForm();
      fetchItems();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('Já existe um item com este nome');
      } else {
        toast.error('Erro ao salvar item');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (item: CatalogoItem) => {
    setForm({
      nome: item.nome,
      precoUnitario: item.precoUnitario.toString(),
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleRemover = async (id: string, nome: string) => {
    if (!confirm(`Remover "${nome}" do catálogo?`)) return;

    try {
      await CatalogService.removerItem(id);
      toast.success('Item removido');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover item');
    }
  };

  const filteredItems = items.filter(item =>
    item.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatMZN = (value: number) =>
    new Intl.NumberFormat('pt-MZ', {
      style: 'currency',
      currency: 'MZN',
      minimumFractionDigits: 2,
    }).format(value);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar catálogo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'item' : 'itens'} no catálogo
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:brightness-110 active:scale-[0.97] transition-all"
        >
          <Plus className="h-4 w-4" />
          Novo Item
        </button>
      </div>

      {/* Search */}
      {items.length > 5 && (
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar item..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={inputClass + ' pl-10'}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-xl p-6 border border-border card-float space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? 'Editar Item' : 'Novo Item'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nome do item *</label>
              <input
                className={inputClass}
                placeholder="Ex: Consultoria mensal"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Preço unitário (MZN) *</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.precoUnitario}
                onChange={e => setForm(f => ({ ...f, precoUnitario: e.target.value }))}
              />
            </div>
          </div>
          {editingId && (
            <p className="text-xs text-muted-foreground">
              Se alterar o nome, o item antigo será substituído pelo novo.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Atualizar' : 'Salvar'}
            </button>
            <button
              onClick={resetForm}
              className="px-5 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center card-float animate-fade-up">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Catálogo vazio</p>
          <p className="text-sm text-muted-foreground">
            Adicione itens ao catálogo para reutilizá-los nas propostas.
          </p>
        </div>
      ) : filteredItems.length === 0 && searchTerm ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center card-float">
          <p className="text-muted-foreground">
            Nenhum item encontrado para &quot;{searchTerm}&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, i) => (
            <div
              key={item.id}
              className="bg-card rounded-xl p-4 md:p-5 border border-border card-float flex items-center justify-between gap-4 hover:border-primary/30 transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMZN(item.precoUnitario)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleEditar(item)}
                  className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleRemover(item.id, item.nome)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
