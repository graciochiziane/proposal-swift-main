export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa: string;
  nuit: string;
  endereco: string;
}

export interface ItemProposta {
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export type DescontoTipo = 'percentual' | 'valor';
export type StatusProposta = 'rascunho' | 'enviada' | 'aceite' | 'rejeitada';

export interface Proposta {
  id: string;
  numero: string;
  clienteId: string;
  data: string;
  itens: ItemProposta[];
  subtotal: number;
  descontoTipo: DescontoTipo;
  descontoValor: number;
  ivaPercentual: number;
  total: number;
  observacoes: string;
  status: StatusProposta;
  clienteSnapshot?: Partial<Cliente>;
  donoSnapshot?: Partial<DonoProposta>;
  created_at: string;
}

export type PDFTemplate = 'classic' | 'modern' | 'executive';

export interface DadosBancarios {
  ativo: boolean;
  banco: string;
  numeroConta: string;
  nib: string;
}

export interface MobileMoney {
  mpesa: { ativo: boolean; numero: string };
  emola: { ativo: boolean; numero: string };
  mkesh: { ativo: boolean; numero: string };
}

export interface CatalogoItem {
  id: string;
  nome: string;
  precoUnitario: number;
}

export interface DonoProposta {
  nome: string;
  cargo: string;
  empresa: string;
  contacto: string;
  nuit: string;
  endereco: string;
  logotipo: string; // base64 data URL
  corPrimaria: string; // hex color
  dadosBancarios: DadosBancarios;
  mobileMoney: MobileMoney;
}

// ===== TIPOS DE FATURA =====

export type StatusFatura = 'pendente' | 'paga' | 'vencida' | 'anulada';

export interface ItemFatura {
  id?: string;
  invoice_id?: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  ordem: number;
}

export interface Fatura {
  id: string;
  owner_id: string;
  proposal_id: string;
  client_id: string;
  numero: string;
  data_emissao: string;
  data_vencimento: string;
  total: number;
  status: StatusFatura;
  items?: ItemFatura[];
  created_at: string;
  updated_at: string;
}
