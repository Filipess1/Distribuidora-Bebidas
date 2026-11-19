# 🍺 Distribuidora de Bebidas — Gestão de Estoque, Vendas e Clientes

Sistema web local (PC + celular) no mesmo modelo do app de depósito de alimentos, adaptado para **distribuidora/depósito de bebidas**.

## Como abrir
Dois cliques em **`Abrir App.bat`** (precisa do [Node.js](https://nodejs.org)). O navegador abre em `http://localhost:3000`.
No celular: mesmo Wi-Fi → botão **📱 Celular** (QR Code). Para usar a **câmera** no celular é preciso HTTPS: deixe o `cloudflared.exe` nesta pasta e o link seguro é gerado sozinho.

## O que mudou em relação ao app de alimentos
| Alimentos (escola) | Bebidas (distribuidora) |
|---|---|
| Baixa "merenda" | **Venda a clientes** (bares, mercados…) com romaneio de separação |
| Quantidade em unidades | **Caixa/fardo/engradado + unidades soltas** (ex.: `3 cx + 5 un`) |
| Sem preço de venda | Custo, preço un/caixa, **margem e lucro** |
| Sem clientes | **Clientes**, fiado com limite de crédito, recebimentos |
| — | **Vasilhame retornável** (engradados/cascos/galões) por cliente |
| Zonas da despensa | Câmara fria, galpões, adega, chopp/barris |
| Validade em dias fixos | FEFO + **lotes vencidos bloqueados na venda** |
| Reposição fixa (≤3/≤6/≤10) | Reposição por **estoque mínimo + giro de vendas (30 dias)** |
| NFC-e por QR | **Importação de NF-e (XML)** do fornecedor |
| Sincronia via serviço público (ntfy) | Servidor único local; todos os aparelhos leem os mesmos dados |

## Telas
Painel · Reposição · Estoque & Lotes · Entrada de Compras (manual / XML) · Vendas & Saídas · Clientes · Depósitos · Histórico (pedidos e movimentações, CSV).

## Dados e segurança
- Tudo fica em `dados_distribuidora.json`; backup automático diário em `backups/` (20 dias).
- **Ajustes → PIN**: protege o acesso (recomendado ao usar o link HTTPS do celular).
- **Ajustes → Carregar exemplos / Zerar tudo** (zerar guarda uma cópia antes).
- Testes automáticos da regra de negócio: `node teste.cjs`.
