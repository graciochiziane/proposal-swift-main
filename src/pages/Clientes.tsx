import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Pencil, X, Mail, Phone, Building2, Loader2, Search } from 'lucide-react';
import { ClienteService } from '@/services/clienteService';
import { toast } from 'sonner';
import type { Cliente } from '@/types';

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState<Omit<Cliente, 'id'>>({
    nome: '', email: '', telefone: '', empresa: '', nuit: '', endereco: ''
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  async function fetchClientes() {
    try {
      const data = await ClienteService.getClientes();
      setClientes(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setForm({ nome: '', email: '', telefone: '', empresa: '', nuit: '', endereco: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await ClienteService.atualizarCliente(editingId, form);
        toast.success('Cliente atualizado');
      } else {
        await ClienteService.criarCliente(form);
        toast.success('Cliente adicionado');
      }
      resetForm();
      fetchClientes();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (cliente: Cliente) => {
    setForm({
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      empresa: cliente.empresa,
      nuit: cliente.nuit,
      endereco: cliente.endereco,
    });
    setEditingId(cliente.id);
    setShowForm(true);
  };

  const handleRemover = async (id: string, nome: string) => {
    if (!confirm(`Remover cliente "${nome}"?`)) return;
    try {
      await ClienteService.removerCliente(id);
      toast.success('Cliente removido');
      fetchClientes();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover cliente');
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.empresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputClass = "w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua base de contactos</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:brightness-110 active:scale-[0.97] transition-all"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {clientes.length > 3 && (
        <div className="relative animate-fade-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou empresa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={inputClass + " pl-10"}
          />
        </div>
      )}

      {showForm && (
        <div className="bg-card rounded-xl p-6 border border-border card-float space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Nome Completo *</label>
              <input className={inputClass} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: João Silva" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input className={inputClass} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="+258 ..." />
            </div>
            <div>
              <label className={labelClass}>Empresa</label>
              <input className={inputClass} value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Nome da empresa" />
            </div>
            <div>
              <label className={labelClass}>NUIT</label>
              <input className={inputClass} value={form.nuit} onChange={e => setForm(f => ({ ...f, nuit: e.target.value }))} placeholder="Ex: 400123456" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Endereço</label>
              <input className={inputClass} value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Bairro, Rua, Casa nº" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Atualizar' : 'Salvar'}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 rounded-lg bg-secondary text-sm hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {clientes.length === 0 && !showForm ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center card-float animate-fade-up">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Ainda não tem clientes registados</p>
          <p className="text-sm text-muted-foreground mt-1">Registe os seus clientes para criar propostas em segundos</p>
        </div>
      ) : filteredClientes.length === 0 && searchTerm ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center card-float animate-fade-up">
          <p className="text-muted-foreground">Nenhum cliente encontrado para "{searchTerm}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClientes.map((cliente, i) => (
            <div
              key={cliente.id}
              className="bg-card rounded-xl p-5 border border-border flex flex-col justify-between gap-4 card-float hover:border-primary/30 transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-lg truncate">{cliente.nome}</p>
                    {cliente.empresa && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{cliente.empresa}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEditar(cliente)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleRemover(cliente.id, cliente.nome)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  {cliente.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.telefone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{cliente.telefone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
