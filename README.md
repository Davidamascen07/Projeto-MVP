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
 │   │  NFT Cert CERT  │         │  createProposal()      │    │
 │   │  IPFS Metadata  │         │  vote()                │    │
 │   └─────────────────┘         │  execute()             │    │
 │                                └────────────────────────┘    │
 │                                                              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │         Backend Web3 (ethers.js — demo-web3.js)       │  │
 │  │  mint NFT │ stake tokens │ vote DAO │ read oracle     │  │
 │  └───────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────┘
```

**Fluxo principal:**
1. Admin distribui ACAD tokens (ERC-20) para alunos via `transfer()`.
2. Professor (MINTER_ROLE) minta NFT certificado para aluno formado via `mintCertificate()`.
3. Aluno aprova e faz `stake()` de ACAD → acumula recompensas ao longo do tempo.
4. `updateRewardRate()` consulta Chainlink ETH/USD e ajusta a taxa dinamicamente.
5. Detentor de ACAD cria proposta na DAO → membros votam com peso proporcional ao saldo → resultado executado on-chain após prazo.
6. Script `demo-web3.js` (ethers.js) demonstra todo o fluxo de forma integrada.

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

> Deploy realizado em 27/04/2026 | Deployer: `0xEBe73c58B63a20622418c2800e6dDA32aD5A52FB`  
> Setup completo: MINTER_ROLE concedido + 200.000 ACAD depositados como recompensas ✓

| Contrato | Endereço | Explorer |
|---|---|---|
| AcadToken (ERC-20) | `0x468AA5C2e59D5a503d8aa35a4fF0808882e7CC5D` | [Etherscan](https://sepolia.etherscan.io/address/0x468AA5C2e59D5a503d8aa35a4fF0808882e7CC5D) |
| AcademicCertificate (ERC-721) | `0x5ed7B7a93C67915751cB6A01453aF1CF9Bb605EE` | [Etherscan](https://sepolia.etherscan.io/address/0x5ed7B7a93C67915751cB6A01453aF1CF9Bb605EE) |
| AcadStaking | `0x57031f4631526368d53Cf09CFaf5C68722ABE9FD` | [Etherscan](https://sepolia.etherscan.io/address/0x57031f4631526368d53Cf09CFaf5C68722ABE9FD) |
| AcadGovernance (DAO) | `0x3BA9646636ebE72B4fC636C0b13808A2A873e503` | [Etherscan](https://sepolia.etherscan.io/address/0x3BA9646636ebE72B4fC636C0b13808A2A873e503) |
| Chainlink ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | [Etherscan](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306) |

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

### Demonstração Web3 completa (ethers.js)
```bash
# Roda toda a integração: distribuição, mint NFT, stake, oráculo e DAO
npx hardhat run scripts/demo-web3.js --network localhost
```

### Interagir individualmente
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
│   ├── ERC20Token.sol          # Token ACAD (ERC-20 + AccessControl)
│   ├── NFT.sol                 # Certificado (ERC-721 + URIStorage)
│   ├── Staking.sol             # Staking + Chainlink + ReentrancyGuard
│   ├── Governance.sol          # DAO (proposta, voto, execução)
│   └── mocks/
│       └── MockV3Aggregator.sol  # Mock do oráculo (somente testes)
├── scripts/
│   ├── deploy.js               # Deploy completo (localhost + Sepolia)
│   ├── demo-web3.js            # Integração Web3 completa (ethers.js)
│   ├── mint.js                 # Mint de NFT
│   ├── stake.js                # Stake de tokens + Chainlink
│   └── vote.js                 # Criar proposta e votar na DAO
├── test/
│   └── MVPTest.js              # Suite de testes (39 casos — 100% passando)
├── .env.example
├── .gitignore
├── hardhat.config.js
├── package.json
├── relatorio-auditoria.md
└── README.md
```

---

## Repositório

[github.com/Davidamascen07/Projeto-MVP](https://github.com/Davidamascen07/Projeto-MVP.git)
