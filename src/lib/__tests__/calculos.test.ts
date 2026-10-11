import { describe, test, expect } from 'vitest';
import { calcularSubtotal, calcularDesconto, calcularTotal } from '../calculos';
import { DescontoTipo, ItemProposta } from '@/types';

describe('Funções de cálculo', () => {
  test('calcularSubtotal deve calcular corretamente o subtotal', () => {
    const itens: ItemProposta[] = [
      { id: 'item-1', nome: 'Serviço A', quantidade: 2, precoUnitario: 50, subtotal: 100 },
      { id: 'item-2', nome: 'Serviço B', quantidade: 3, precoUnitario: 30, subtotal: 90 },
    ];
    expect(calcularSubtotal(itens)).toBe(190);
  });

  test('calcularDesconto deve calcular desconto percentual corretamente', () => {
    const subtotal = 200;
    const desconto = calcularDesconto(subtotal, 'percentual', 10);
    expect(desconto).toBe(20);
  });

  test('calcularDesconto deve calcular desconto fixo corretamente', () => {
    const subtotal = 200;
    const desconto = calcularDesconto(subtotal, 'valor', 30);
    expect(desconto).toBe(30);
  });

  test('calcularTotal deve calcular corretamente o total com IVA 16% (Moçambique)', () => {
    const subtotal = 200;
    const descontoTipo: DescontoTipo = 'percentual';
    const descontoValor = 10;
    const ivaPercentual = 16; // P1-FIX: IVA real de Moçambique é 16%

    const { desconto, baseTributavel, iva, total } = calcularTotal(
      subtotal,
      descontoTipo,
      descontoValor,
      ivaPercentual
    );

    expect(desconto).toBe(20);
    expect(baseTributavel).toBe(180);
    expect(iva).toBeCloseTo(28.8, 1); // 16% de 180 = 28.8
    expect(total).toBeCloseTo(208.8, 1);
  });

  test('calcularTotal deve lidar com valores zero e negativos', () => {
    const subtotal = 0;
    const descontoTipo: DescontoTipo = 'valor'; // P1-FIX: era 'fixo' (não existe no enum)
    const descontoValor = 10;
    const ivaPercentual = 16; // P1-FIX: era 17 (incorreto)

    const { desconto, baseTributavel, iva, total } = calcularTotal(
      subtotal,
      descontoTipo,
      descontoValor,
      ivaPercentual
    );

    expect(desconto).toBe(10);
    expect(baseTributavel).toBe(-10);
    expect(iva).toBeCloseTo(-1.6, 1); // 16% de -10 = -1.6
    expect(total).toBeCloseTo(-11.6, 1);
  });
});
