# Deploy na Sepolia (testnet)

Siga este passo a passo para publicar seus contratos na Sepolia:

---

## 1. Obtenha as credenciais

- **Crie uma conta na Metamask** (ou use uma existente)
- **Pegue saldo Sepolia** (faucet: https://sepoliafaucet.com/)
- **Crie um projeto no Infura, Alchemy ou QuickNode**
- Copie sua **PRIVATE_KEY** (exporte da Metamask)
- Copie sua **URL RPC** (exemplo Infura: https://sepolia.infura.io/v3/SEU_INFURA_KEY)
- (Opcional) Pegue um **ETHERSCAN_API_KEY** (https://etherscan.io/myapikey)

---

## 2. Configure o arquivo `.env`

Crie um arquivo `.env` na raiz do projeto (ou copie `.env.example`):

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/SEU_INFURA_KEY
PRIVATE_KEY=0xSEU_PRIVATE_KEY
ETHERSCAN_API_KEY=SEU_ETHERSCAN_KEY
REPORT_GAS=true
```

---

## 3. Instale as dependências

Abra o terminal na pasta `projeto-mvp` e rode:

```
npm install
```

---

## 4. Execute o deploy

No terminal, rode:

```
npx hardhat run scripts/deploy.js --network sepolia
```

Aguarde o deploy. Os endereços dos contratos aparecerão no terminal.

---

## 5. (Opcional) Verifique no Etherscan

Para verificar o contrato (deixar "verified" no Etherscan):

```
npx hardhat verify --network sepolia ENDERECO_DO_CONTRATO [ARGUMENTOS_DO_CONSTRUTOR]
```

Veja os argumentos no deploy.js ou peça ajuda aqui.

---

## 6. Atualize o README

Copie os endereços dos contratos e links do Etherscan para o README.

---

Pronto! Seu deploy estará público na Sepolia.