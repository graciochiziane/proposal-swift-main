import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Bookmark, Loader2 } from 'lucide-react';
import { PropostaService, formatMZN } from '@/services/propostaService';
import type { PropostaCompleta } from '@/services/propostaService';
import { ClienteService } from '@/services/clienteService';
import { CatalogService } from '@/services/catalogService';
import { calcularSubtotal, calcularTotal } from '@/lib/calculos';
import { toast } from 'sonner';
import type { ItemProposta, DescontoTipo, Cliente, CatalogoItem } from '@/types';

export default function CriarProposta() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [existente, setExistente] = useState<PropostaCompleta | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [itens, setItens] = useState<ItemProposta[]>([
    { id: crypto.randomUUID(), nome: '', quantidade: 1, precoUnitario: 0, subtotal: 0 }
  ]);
  const [descontoTipo, setDescontoTipo] = useState<DescontoTipo>('percentual');
  const [descontoValor, setDescontoValor] = useState(0);
  const [ivaPercentual, setIvaPercentual] = useState(16);
  const [observacoes, setObservacoes] = useState('');

  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickNome, setQuickNome] = useState('');

  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [catalogoFilter, setCatalogoFilter] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const catalogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const propProm = id ? PropostaService.getPropostaById(id) : Promise.resolve(null);
        const clientesProm = ClienteService.getClientes();
        const catalogoProm = CatalogService.getCatalogo();

        const [proposta, clientesData, catalogoData] = await Promise.all([
          propProm, clientesProm, catalogoProm
        ]);

        if (proposta) {
          setExistente(proposta);
          setClienteId(proposta.clienteId);
          setData(proposta.data);
          setItens(proposta.itens.length > 0 ? proposta.itens : [
            { id: crypto.randomUUID(), nome: '', quantidade: 1, precoUnitario: 0, subtotal: 0 }
          ]);
          setDescontoTipo(proposta.descontoTipo);
          setDescontoValor(proposta.descontoValor);
          setIvaPercentual(proposta.ivaPercentual);
          setObservacoes(proposta.observacoes);
        }

        setClientes(clientesData);
        setCatalogo(catalogoData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const subtotal = useMemo(() => calcularSubtotal(itens), [itens]);
  const totais = useMemo(
    () => calcularTotal(subtotal, descontoTipo, descontoValor, ivaPercentual),
    [subtotal, descontoTipo, descontoValor, ivaPercentual]
  );

  const addItem = () =>
    setItens(prev => [...prev, { id: crypto.randomUUID(), nome: '', quantidade: 1, precoUnitario: 0, subtotal: 0 }]);

  const removeItem = (itemId: string) =>
    itens.length > 1 && setItens(prev => prev.filter(i => i.id !== itemId));

  const updateItem = (itemId: string, field: keyof ItemProposta, value: string | number) => {
    setItens(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      updated.subtotal = updated.quantidade * updated.precoUnitario;
      return updated;
    }));
  };

  const catalogoFiltrado = catalogo.filter(item =>
    item.nome.toLowerCase().includes(catalogoFilter.toLowerCase())
  );

  const selectFromCatalogo = (item: CatalogoItem, itemId: string) => {
    updateItem(itemId, 'nome', item.nome);
    updateItem(itemId, 'precoUnitario', item.precoUnitario);
    setCatalogoOpen(false);
    setCatalogoFilter('');
  };

  const handleAddToCatalog = async (item: ItemProposta) => {
    if (!item.nome.trim()) return;
    try {
      await CatalogService.salvarItem({
        nome: item.nome.trim(),
        precoUnitario: item.precoUnitario,
      });
      const updated = await CatalogService.getCatalogo();
      setCatalogo(updated);
      toast.success('Item adicionado ao catálogo');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar ao catálogo');
    }
  };

  const handleQuickClient = async () => {
    if (!quickNome.trim()) return;
    try {
      const novo = await ClienteService.criarCliente({
        nome: quickNome.trim(),
        email: '', telefone: '', empresa: '', nuit: '', endereco: '',
      });
      setClientes(prev => [...prev, novo]);
      setClienteId(novo.id);
      setQuickNome('');
      setShowQuickClient(false);
      toast.success('Cliente adicionado');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar cliente');
    }
  };

  const handleSave = async () => {
    if (!clienteId) { toast.error('Selecione um cliente'); return; }
    if (!itens.some(i => i.nome.trim())) { toast.error('Adicione pelo menos um item'); return; }

    setSaving(true);
    try {
      const input = {
        clienteId,
        data,
        observacoes,
        descontoTipo,
        descontoValor,
        ivaPercentual,
      };

      const itemsInput = itens
        .filter(i => i.nome.trim())
        .map(({ nome, quantidade, precoUnitario }) => ({
          nome: nome.trim(),
          quantidade,
          precoUnitario,
        }));

      let propostaId: string;
      if (existente) {
        await PropostaService.atualizarProposta(existente.id, input, itemsInput);
        propostaId = existente.id;
      } else {
        const nova = await PropostaService.criarProposta(input, itemsInput);
        propostaId = nova.id;
      }

      toast.success(existente ? 'Proposta atualizada' : 'Proposta criada');
      navigate(`/proposta/${propostaId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar proposta';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
        {existente ? 'Editar Proposta' : 'Nova Proposta'}
      </h1>

      <div className="bg-card rounded-xl p-6 border border-border card-float space-y-5 animate-fade-up">
        <div>
          <label className={labelClass}>Cliente *</label>
          <div className="flex gap-2">
            <select
              className={inputClass + ' flex-1'}
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
            >
              <option value="">Selecionar cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowQuickClient(!showQuickClient)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm hover:bg-secondary/80 transition-colors whitespace-nowrap"
            >
              + Novo
            </button>
          </div>

          {showQuickClient && (
            <div className="mt-2 flex gap-2 animate-fade-up">
              <input
                className={inputClass + ' flex-1'}
                placeholder="Nome do novo cliente"
                value={quickNome}
                onChange={e => setQuickNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickClient()}
                autoFocus
              />
              <button
                type="button"
                onClick={handleQuickClient}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:brightness-110 transition-all"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => { setShowQuickClient(false); setQuickNome(''); }}
                className="px-3 py-2 rounded-lg bg-secondary text-sm hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data</label>
            <input
              type="date"
              className={inputClass}
              value={data}
              onChange={e => setData(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>IVA (%)</label>
            <input
              type="number"
              className={inputClass}
              min="0"
              max="100"
              step="1"
              value={ivaPercentual}
              onChange={e => setIvaPercentual(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Itens *</label>
          {itens.map((item, idx) => (
            <div key={item.id} className="relative">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-5 relative" ref={idx === activeItemIndex ? catalogoRef : undefined}>
                  <input
                    className={inputClass}
                    placeholder="Nome do item"
                    value={item.nome}
                    onChange={e => {
                      updateItem(item.id, 'nome', e.target.value);
                      setCatalogoFilter(e.target.value);
                      setCatalogoOpen(e.target.value.length > 0);
                      setActiveItemIndex(idx);
                    }}
                    onFocus={() => {
                      if (item.nome.length > 0) {
                        setCatalogoFilter(item.nome);
                        setCatalogoOpen(true);
                        setActiveItemIndex(idx);
                      }
                    }}
                    onBlur={() => setTimeout(() => setCatalogoOpen(false), 200)}
                  />
                  {catalogoOpen && catalogoFiltrado.length > 0 && idx === activeItemIndex && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {catalogoFiltrado.slice(0, 8).map(catItem => (
                        <button
                          key={catItem.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex justify-between items-center"
                          onMouseDown={() => selectFromCatalogo(catItem, item.id)}
                        >
                          <span className="truncate">{catItem.nome}</span>
                          <span className="text-muted-foreground text-xs ml-2 whitespace-nowrap">{formatMZN(catItem.precoUnitario)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    className={inputClass + ' text-center'}
                    min="0"
                    step="1"
                    value={item.quantidade}
                    onChange={e => updateItem(item.id, 'quantidade', Number(e.target.value))}
                    placeholder="Qtd"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    className={inputClass + ' text-right'}
                    min="0"
                    step="0.01"
                    value={item.precoUnitario}
                    onChange={e => updateItem(item.id, 'precoUnitario', Number(e.target.value))}
                    placeholder="Preço"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
                  <span className="text-sm font-medium text-primary whitespace-nowrap">
                    {formatMZN(item.subtotal)}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  {item.nome.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddToCatalog(item)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Salvar no catálogo"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remover item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            + Adicionar item
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Tipo de desconto</label>
            <select
              className={inputClass}
              value={descontoTipo}
              onChange={e => setDescontoTipo(e.target.value as DescontoTipo)}
            >
              <option value="percentual">Percentual (%)</option>
              <option value="valor">Valor fixo (MZN)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              {descontoTipo === 'percentual' ? 'Desconto (%)' : 'Desconto (MZN)'}
            </label>
            <input
              type="number"
              className={inputClass}
              min="0"
              step={descontoTipo === 'percentual' ? '1' : '0.01'}
              value={descontoValor}
              onChange={e => setDescontoValor(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Observações</label>
          <textarea
            className={inputClass + ' min-h-[80px] resize-y'}
            placeholder="Observações adicionais..."
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border card-float space-y-3 animate-fade-up">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatMZN(subtotal)}</span>
        </div>
        {totais.desconto > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Desconto ({descontoTipo === 'percentual' ? `${descontoValor}%` : formatMZN(descontoValor)})
            </span>
            <span className="text-destructive">-{formatMZN(totais.desconto)}</span>
          </div>
        )}
        {totais.iva > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IVA ({ivaPercentual}%)</span>
            <span>{formatMZN(totais.iva)}</span>
          </div>
        )}
        <div className="border-t border-border pt-3 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-primary text-lg">{formatMZN(totais.total)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'A gravar...' : (existente ? 'Atualizar Proposta' : 'Criar Proposta')}
        </button>
        <button
          onClick={() => navigate(-1)}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
