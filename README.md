# ACAD Protocol — MVP Descentralizado

**Aluno:** David Damasceno da Frota  
**Arquivo de entrega:** `U1C5O1T1_DavidDamascenoDaFrota.pdf`

---

## Problema Resolvido

Plataformas de ensino centralizadas sofrem com fraude em certificados, falta de transparência e dependência de intermediários.

O **ACAD Protocol** é um protocolo descentralizado que:
- Emite tokens **ACAD** como recompensa por participação acadêmica.
- Emite **certificados NFT** imutáveis para alunos formados.
- Permite **staking** com rendimento ajustado ao preço ETH via Chainlink.
- Governa mudanças curriculares via **DAO** on-chain.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                       ACAD Protocol                         │
├──────────────┬──────────────┬─────────────┬─────────────────┤
│  ERC20Token  │     NFT      │   Staking   │   Governance    │
│  (AcadToken) │(Certificate) │ (AcadStake) │  (AcadGov DAO)  │
│   ACAD/ERC20 │  CERT/ERC721 │ Reward Pool │ Proposals+Votes │
└──────┬───────┴──────────────┴──────┬──────┴─────────────────┘
       │  MINTER_ROLE                │ Chainlink Oracle
       │  (mint rewards)             │ ETH/USD Price Feed
       └─────────────────────────────┘
```

**Fluxo principal:**
1. Admin distribui ACAD tokens para alunos.
2. Professor (MINTER_ROLE) minta NFT certificado para aluno formado.
3. Aluno faz stake de ACAD → acumula recompensas (taxa ajustada pelo preço ETH/USD).
4. Detentor de ACAD cria proposta na DAO → membros votam → resultado executado on-chain.

---

## Contratos

| Contrato | Padrão | Arquivo |
|---|---|---|
| `AcadToken` | ERC-20 + AccessControl | `contracts/ERC20Token.sol` |
| `AcademicCertificate` | ERC-721 + URIStorage | `contracts/NFT.sol` |
| `AcadStaking` | ReentrancyGuard + Ownable + Chainlink | `contracts/Staking.sol` |
| `AcadGovernance` | DAO simples + Ownable | `contracts/Governance.sol` |
| `MockV3Aggregator` | Mock de oráculo (só testes) | `contracts/mocks/MockV3Aggregator.sol` |

---

## Justificativa dos Padrões ERC

| Padrão | Motivo |
|---|---|
| **ERC-20** | Token fungível — 1 ACAD = 1 ACAD. Compatível com DEXs, carteiras e staking. |
| **ERC-721** | NFT único por certificado — não replicável, verificável publicamente. |
| **AccessControl** | Controle por papéis (roles) mais granular que `Ownable` simples. |

---

## Segurança Aplicada

| Proteção | Onde | Como |
|---|---|---|
| **ReentrancyGuard** | `Staking.sol` | Previne ataques de reentrância em `stake`, `unstake`, `claimRewards`, `emergencyWithdraw` |
| **Checks-Effects-Interactions** | `Staking.sol` | Estado atualizado **antes** de transferências externas |
| **require() com mensagens** | Todos os contratos | Validação de entradas e estado |
| **AccessControl / Ownable** | Todos os contratos | Restrição de funções privilegiadas |
| **Zero address check** | `ERC20Token.sol`, `NFT.sol`, `Staking.sol` | Impede mint/deploy com endereços inválidos |
| **Solidity ^0.8.x** | Todos | Overflow/underflow revertidos automaticamente |
| **Voto único por proposta** | `Governance.sol` | `hasVoted` mapping impede dupla votação |

---

## Integração com Oráculo — Chainlink

O contrato `AcadStaking` consome o feed **ETH/USD** da Chainlink:

- **Sepolia:** `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Função `updateRewardRate()` pode ser chamada por qualquer um a qualquer momento.

| Condição | Efeito |
|---|---|
| ETH > $3.000 | Taxa de recompensa **+50%** |
| ETH < $1.500 | Taxa de recompensa **-30%** |
| $1.500–$3.000 | Taxa de recompensa **base** |

---

## Endereços na Testnet Sepolia

> Preencher após o deploy com `npx hardhat run scripts/deploy.js --network sepolia`

| Contrato | Endereço | Explorer |
|---|---|---|
| AcadToken | `0x...` | [Etherscan]() |
| AcademicCertificate | `0x...` | [Etherscan]() |
| AcadStaking | `0x...` | [Etherscan]() |
| AcadGovernance | `0x...` | [Etherscan]() |

---

## Como Executar

### Pré-requisitos
```bash
node --version   # >= 18
npm --version    # >= 9
```

### Instalação
```bash
cd projeto-mvp
npm install
```

### Compilar contratos
```bash
npx hardhat compile
```

### Rodar testes
```bash
npx hardhat test
# Com relatório de gas:
REPORT_GAS=true npx hardhat test
```

### Deploy local
```bash
# Terminal 1 — sobe nó local
npx hardhat node

# Terminal 2 — faz deploy
npx hardhat run scripts/deploy.js --network localhost
```

### Deploy na Sepolia
```bash
# 1. Copie e configure o .env
cp .env.example .env
# Edite .env com suas chaves

# 2. Deploy
npx hardhat run scripts/deploy.js --network sepolia
```

### Interagir com os contratos
```bash
# Mintar certificado NFT
NFT_ADDRESS=0x... RECIPIENT=0x... TOKEN_URI=ipfs://... \
  npx hardhat run scripts/mint.js --network sepolia

# Fazer stake de tokens
TOKEN_ADDRESS=0x... STAKING_ADDRESS=0x... AMOUNT=1000 \
  npx hardhat run scripts/stake.js --network sepolia

# Criar proposta e votar na DAO
GOVERNANCE_ADDRESS=0x... TOKEN_ADDRESS=0x... \
  npx hardhat run scripts/vote.js --network sepolia
```

---

## Estrutura do Projeto

```
projeto-mvp/
├── contracts/
│   ├── ERC20Token.sol          # Token ACAD (ERC-20)
│   ├── NFT.sol                 # Certificado (ERC-721)
│   ├── Staking.sol             # Staking + Chainlink
│   ├── Governance.sol          # DAO
│   └── mocks/
│       └── MockV3Aggregator.sol  # Mock do oráculo (testes)
├── scripts/
│   ├── deploy.js               # Deploy de todos os contratos
│   ├── mint.js                 # Mint de NFT
│   ├── stake.js                # Stake de tokens
│   └── vote.js                 # Criar proposta e votar
├── test/
│   └── MVPTest.js              # Suite de testes (33 casos)
├── .env.example
├── hardhat.config.js
├── package.json
├── relatorio-auditoria.md
└── README.md
```

---

## Repositório

[github.com/Davidamascen07/Projeto-MVP](https://github.com/Davidamascen07/Projeto-MVP.git)
