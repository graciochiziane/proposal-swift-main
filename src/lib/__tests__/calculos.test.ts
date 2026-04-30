import { calcularSubtotal, calcularDesconto, calcularTotal } from '../calculos';
import { DescontoTipo, ItemProposta } from '@/types';

describe('Funções de cálculo', () => {
  test('calcularSubtotal deve calcular corretamente o subtotal', () => {
    const itens: ItemProposta[] = [
      { quantidade: 2, precoUnitario: 50 },
      { quantidade: 3, precoUnitario: 30 },
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
    const desconto = calcularDesconto(subtotal, 'fixo', 30);
    expect(desconto).toBe(30);
  });

  test('calcularTotal deve calcular corretamente o total com IVA', () => {
    const subtotal = 200;
    const descontoTipo: DescontoTipo = 'percentual';
    const descontoValor = 10;
    const ivaPercentual = 17;

    const { desconto, baseTributavel, iva, total } = calcularTotal(
      subtotal,
      descontoTipo,
      descontoValor,
      ivaPercentual
    );

    expect(desconto).toBe(20);
    expect(baseTributavel).toBe(180);
    expect(iva).toBeCloseTo(30.6, 1);
    expect(total).toBeCloseTo(210.6, 1);
  });

  test('calcularTotal deve lidar com valores zero e negativos', () => {
    const subtotal = 0;
    const descontoTipo: DescontoTipo = 'fixo';
    const descontoValor = 10;
    const ivaPercentual = 17;

    const { desconto, baseTributavel, iva, total } = calcularTotal(
      subtotal,
      descontoTipo,
      descontoValor,
      ivaPercentual
    );

    expect(desconto).toBe(10);
    expect(baseTributavel).toBe(-10);
    expect(iva).toBeCloseTo(-1.7, 1);
    expect(total).toBeCloseTo(-11.7, 1);
  });
});