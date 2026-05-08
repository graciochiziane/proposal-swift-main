import { DescontoTipo, ItemProposta } from '@/types';

export function calcularSubtotal(itens: ItemProposta[]): number {
  return itens.reduce((sum, item) => sum + item.quantidade * item.precoUnitario, 0);
}

export function calcularDesconto(subtotal: number, descontoTipo: DescontoTipo, descontoValor: number): number {
  if (descontoTipo === 'percentual') {
    return subtotal * (descontoValor / 100);
  }
  return descontoValor;
}

export function calcularTotal(subtotal: number, descontoTipo: DescontoTipo, descontoValor: number, ivaPercentual: number) {
  const desconto = calcularDesconto(subtotal, descontoTipo, descontoValor);
  const baseTributavel = subtotal - desconto;
  const iva = baseTributavel * (ivaPercentual / 100);
  const total = baseTributavel + iva;
  return { desconto, baseTributavel, iva, total };
}
