# Relatório Técnico — ACAD Protocol MVP Descentralizado

**Disciplina:** Desenvolvimento de Protocolos Descentralizados  
**Aluno:** David Damasceno da Frota  
**Arquivo:** U1C5O1T1_DavidDamascenoDaFrota.pdf  
**Data:** Abril/2026  
**GitHub:** https://github.com/Davidamascen07/Projeto-MVP  
**Testnet (Sepolia):** Contratos deployados e verificáveis no Etherscan

---

## 1. Arquitetura e Modelagem (20%)

### 1.1 Problema Resolvido

Plataformas de ensino centralizadas sofrem com:
- **Fraude em certificados** — falsificação e revogação arbitrária
- **Falta de transparência** — alunos não têm visibilidade sobre critérios de aprovação
- **Dependência de intermediários** — universidades e empresas controlam registros

O **ACAD Protocol** resolve isso com um protocolo descentralizado na Ethereum que:
- Emite tokens **ACAD** (ERC-20) como recompensa por participação acadêmica
- Emite **certificados NFT** (ERC-721) imutáveis e verificáveis on-chain
- Permite **staking** com rendimento ajustado ao preço de ETH via oráculo Chainlink
- Governa mudanças curriculares via **DAO** on-chain com votação ponderada por tokens

### 1.2 Justificativa dos Padrões ERC

| Padrão | Contrato | Justificativa |
|---|---|---|
| **ERC-20** | AcadToken | Fungível, divisível — ideal para tokens de recompensa e votação |
| **ERC-721** | AcademicCertificate | Não-fungível — cada certificado é único e pertence a um aluno |
| **AccessControl** | Token + NFT | Controle granular de papéis (MINTER_ROLE vs DEFAULT_ADMIN_ROLE) |
| **ReentrancyGuard** | Staking | Proteção contra ataques de reentrância em funções financeiras |
| **Ownable** | Staking + DAO | Controle administrativo simples para funções sensíveis |

### 1.3 Diagrama de Arquitetura

```
 ┌──────────────────────────────────────────────────────────────┐
 │                    ACAD Protocol MVP                         │
 │                                                              │
 │   ┌────────────┐   MINTER_ROLE   ┌────────────────────┐     │
 │   │ AcadToken  │◄───────────────►│    AcadStaking     │     │
 │   │  (ERC-20)  │  mint rewards   │  ReentrancyGuard   │     │
 │   │  ACAD      │                 │  Ownable           │     │
 │   └─────┬──────┘                 └─────────┬──────────┘     │
 │         │ balanceOf                        │ latestRoundData│
 │         │ transfer                         ▼                │
 │         │              ┌─────────────────────────────────┐  │
 │         │              │   Chainlink Price Feed          │  │
 │         │              │   ETH/USD (AggregatorV3)        │  │
 │         │              │   Sepolia: 0x694AA...325306     │  │
 │         │              └─────────────────────────────────┘  │
 │         │                                                    │
 │         ▼                                                    │
 │   ┌─────────────────┐         ┌────────────────────────┐    │
 │   │AcademicCertif.  │         │    AcadGovernance      │    │
 │   │  (ERC-721)      │         │    (DAO)               │    │
 │   │  NFT CERT       │         │  createProposal()      │    │
 │   │  IPFS Metadata  │         │  vote() + execute()    │    │
 │   └─────────────────┘         └────────────────────────┘    │
 │                                                              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │         Backend Web3 (ethers.js — demo-web3.js)       │  │
 │  │  mint NFT │ stake tokens │ vote DAO │ read oracle     │  │
 │  └───────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────┘
```

### 1.4 Fluxo Principal

1. Admin distribui ACAD tokens para alunos via `transfer()`
2. Professor (MINTER_ROLE) minta NFT certificado para aluno formado via `mintCertificate()`
3. Aluno aprova e faz `stake()` de ACAD → acumula recompensas ao longo do tempo
4. `updateRewardRate()` consulta Chainlink ETH/USD e ajusta taxa dinamicamente
5. Detentor de ACAD cria proposta na DAO → membros votam com peso proporcional ao saldo → execução on-chain após prazo

---

## 2. Implementação Técnica (20%)

### 2.1 Contratos Implementados

#### AcadToken — ERC-20 (`contracts/ERC20Token.sol`)
- Supply inicial: 1.000.000 ACAD
- Funções: `mint()` (MINTER_ROLE), `burn()`, `transfer()`, `approve()`
- Controle de acesso: `AccessControl` com `MINTER_ROLE` e `DEFAULT_ADMIN_ROLE`

#### AcademicCertificate — ERC-721 (`contracts/NFT.sol`)
- NFTs de certificado acadêmico com URI IPFS
- Funções: `mintCertificate(address to, string uri)` retorna `tokenId`
- Evento: `CertificateMinted(tokenId, recipient, uri)`
- Counter automático de tokenIds

#### AcadStaking (`contracts/Staking.sol`)
- Staking de tokens ACAD com recompensas dinâmicas
- Funções: `stake()`, `unstake()`, `claimRewards()`, `emergencyWithdraw()`, `updateRewardRate()`
- Integração Chainlink: ETH > $3.000 → taxa +50% | ETH < $1.500 → taxa -30%
- Proteções: `ReentrancyGuard`, `Ownable`, padrão Checks-Effects-Interactions

#### AcadGovernance — DAO (`contracts/Governance.sol`)
- Governança descentralizada com propostas e votação por token
- Funções: `createProposal()` (min 100 ACAD), `vote()`, `execute()`, `cancelProposal()`
- Prazo de votação: 3 dias | Quórum: 1.000 ACAD
- Peso de voto = `balanceOf(voter)` no momento do voto

### 2.2 Stack Técnica

| Componente | Versão |
|---|---|
| Solidity | ^0.8.25 |
| Hardhat | ^2.22.0 |
| OpenZeppelin Contracts | ^5.0.2 |
| @chainlink/contracts | ^1.2.0 |
| ethers.js | v6 (via hardhat-toolbox) |
| EVM Version | cancun |

### 2.3 Testes Automatizados — 39/39 Passando

```
npx hardhat test

  AcadToken — ERC-20          ✔ 6 testes
  AcademicCertificate — NFT   ✔ 6 testes
  AcadStaking — Chainlink     ✔ 13 testes
  AcadGovernance — DAO        ✔ 14 testes

  39 passing (5s) — 0 falhas
```

---

## 3. Segurança (20%)

### 3.1 Proteções Implementadas

| Proteção | Contrato | Descrição |
|---|---|---|
| `ReentrancyGuard` | Staking | Previne ataques de reentrância em `stake()`, `unstake()`, `claimRewards()` |
| `AccessControl` | Token, NFT | Controle de roles — apenas MINTER_ROLE pode mintar |
| `Ownable` | Staking, DAO | Apenas owner pode executar funções administrativas |
| Checks-Effects-Interactions | Staking | Estado atualizado ANTES de chamadas externas |
| `require()` validations | Todos | Validações em todas as entradas: zero address, valor zero, saldo insuficiente |
| Solidity ^0.8.25 | Todos | Overflow/underflow revertidos automaticamente |
| `_safeMint` | NFT | Verifica se destinatário aceita ERC-721 |

### 3.2 Achados de Auditoria

| ID | Severidade | Descrição | Status |
|---|---|---|---|
| S-01 | Alto | Reentrância em funções de transferência | **Mitigado** (ReentrancyGuard + CEI) |
| S-02 | Médio | Oracle staleness (dado Chainlink desatualizado) | Documentado para produção |
| G-01 | Médio | Flash loan attack no poder de voto | Aceito (escopo MVP) |
| G-02 | Baixo | Sem timelock na execução de propostas | Aceito (escopo MVP) |
| T-01 | Info | Supply sem cap máximo | Aceito por design |

**Conclusão:** Nenhuma vulnerabilidade crítica. Todos os riscos altos foram mitigados.

### 3.3 Relatório Completo

Ver arquivo `relatorio-auditoria.md` no repositório.

---

## 4. Integração com Oráculo (10%)

### 4.1 Chainlink ETH/USD

O contrato `AcadStaking.sol` integra o oráculo **Chainlink AggregatorV3Interface** para ajustar dinamicamente a taxa de recompensa com base no preço do ETH:

```solidity
AggregatorV3Interface public priceFeed;

function updateRewardRate() public {
    (, int256 price,,,) = priceFeed.latestRoundData();
    uint256 ethPrice = uint256(price) / 1e8; // 8 decimais

    if (ethPrice > 3000) {
        rewardRate = BASE_REWARD_RATE * 150 / 100; // +50%
    } else if (ethPrice < 1500) {
        rewardRate = BASE_REWARD_RATE * 70 / 100;  // -30%
    } else {
        rewardRate = BASE_REWARD_RATE;              // taxa base
    }
    emit RewardRateUpdated(rewardRate, ethPrice);
}
```

**Endereço do Price Feed na Sepolia:** `0x694AA1769357215DE4FAC081bf1f309aDC325306`

**Testes de oráculo (3 cenários verificados):**
- ETH > $3.000 → taxa sobe 50% ✔
- ETH < $1.500 → taxa cai 30% ✔
- ETH entre $1.500–$3.000 → taxa base ✔

---

## 5. Integração Web3 com ethers.js (10%)

### 5.1 Script de Integração (`scripts/demo-web3.js`)

Script completo com 5 etapas demonstrando integração backend Web3:

```
ETAPA 1: Leitura on-chain — nome, símbolo, supply via ethers.js
ETAPA 2: Transfer ERC-20 — 5.000 ACAD para aluno e membro
ETAPA 3: Mint NFT — certificado com URI IPFS, evento CertificateMinted
ETAPA 4: Staking — 2.000 ACAD em staking + consulta Chainlink ETH/USD
ETAPA 5: DAO — criar proposta + votar + consultar resultado
```

**Resultado real de execução:**
```
ETAPA 1: AcadToken (ACAD), supply 1.000.000 ✅
ETAPA 2: Transfer 5.000 ACAD confirmado, gas: ~51.000 ✅
ETAPA 3: NFT TokenId 1 mintado, evento emitido ✅
ETAPA 4: Staking 2.000 ACAD, Chainlink $2000, taxa atualizada ✅
ETAPA 5: Proposta criada, 794.000 ACAD votos SIM ✅

Integração Web3 com ethers.js: CONCLUÍDA ✅
```

---

## 6. Deploy em Testnet (10%)

### 6.1 Contratos na Sepolia

> **Deploy realizado em:** 27/04/2026  
> **Deployer:** `0xEBe73c58B63a20622418c2800e6dDA32aD5A52FB`  
> **Setup:** MINTER_ROLE concedido + 200.000 ACAD depositados como recompensas

| Contrato | Endereço na Sepolia | Etherscan |
|---|---|---|
| AcadToken (ERC-20) | `0x468AA5C2e59D5a503d8aa35a4fF0808882e7CC5D` | https://sepolia.etherscan.io/address/0x468AA5C2e59D5a503d8aa35a4fF0808882e7CC5D |
| AcademicCertificate (ERC-721) | `0x5ed7B7a93C67915751cB6A01453aF1CF9Bb605EE` | https://sepolia.etherscan.io/address/0x5ed7B7a93C67915751cB6A01453aF1CF9Bb605EE |
| AcadStaking | `0x57031f4631526368d53Cf09CFaf5C68722ABE9FD` | https://sepolia.etherscan.io/address/0x57031f4631526368d53Cf09CFaf5C68722ABE9FD |
| AcadGovernance (DAO) | `0x3BA9646636ebE72B4fC636C0b13808A2A873e503` | https://sepolia.etherscan.io/address/0x3BA9646636ebE72B4fC636C0b13808A2A873e503 |
| Chainlink ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306 |

---

## 7. Clareza do Relatório (10%)

### 7.1 Documentação

- `README.md` — Documentação completa com arquitetura, setup e como executar
- `relatorio-auditoria.md` — Relatório de auditoria de segurança com achados reais
- `PASSO_A_PASSO_DEPLOY_SEPOLIA.md` — Guia de deploy na testnet
- Comentários inline em todos os contratos Solidity

### 7.2 Repositório GitHub

**URL:** https://github.com/Davidamascen07/Projeto-MVP

```
projeto-mvp/
├── contracts/
│   ├── ERC20Token.sol       # AcadToken — ERC-20 com AccessControl
│   ├── NFT.sol              # AcademicCertificate — ERC-721
│   ├── Staking.sol          # AcadStaking — com Chainlink oracle
│   ├── Governance.sol       # AcadGovernance — DAO
│   └── mocks/
│       └── MockV3Aggregator.sol  # Mock Chainlink para testes
├── scripts/
│   ├── deploy.js            # Deploy completo (localhost + Sepolia)
│   ├── demo-web3.js         # Integração Web3 completa com ethers.js
│   ├── mint.js              # Script de mint NFT
│   ├── stake.js             # Script de staking
│   └── vote.js              # Script de votação DAO
├── test/
│   └── MVPTest.js           # 39 testes cobrindo todos os contratos
├── hardhat.config.js
├── README.md
└── relatorio-auditoria.md
```

---

## 8. Roteiro para Vídeo Demonstrativo (5–10 min)

**Sugestão de roteiro:**

| Tempo | Conteúdo |
|---|---|
| 0:00–1:00 | Apresentação: problema, solução, arquitetura no README |
| 1:00–2:00 | Mostrar os 4 contratos no VS Code (ERC20, NFT, Staking, DAO) |
| 2:00–3:30 | Rodar `npx hardhat test` — mostrar 39 testes passando |
| 3:30–5:00 | Rodar `npx hardhat run scripts/demo-web3.js --network localhost` — mostrar 5 etapas |
| 5:00–6:30 | Abrir Etherscan Sepolia — mostrar os contratos deployados e transações |
| 6:30–7:30 | Mostrar `relatorio-auditoria.md` — achados e mitigações |
| 7:30–8:00 | Conclusão: GitHub, tecnologias usadas, próximos passos |

**Comandos para o vídeo:**
```bash
# Testes
npx hardhat test

# Demo Web3 (precisa do hardhat node rodando)
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/demo-web3.js --network localhost
```

---

*Relatório gerado em 27/04/2026 — David Damasceno da Frota*
