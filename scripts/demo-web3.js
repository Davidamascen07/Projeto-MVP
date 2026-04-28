// scripts/demo-web3.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRAÇÃO BACKEND WEB3 — Demonstração completa do ACAD Protocol
// Utiliza ethers.js v6 para interagir com todos os contratos deployados.
//
// O QUE É INTEGRAÇÃO WEB3?
// Aplicações Web3 se comunicam com a blockchain via bibliotecas como ethers.js
// ou web3.js. Em vez de um servidor centralizado, chamam funções dos contratos
// diretamente pela RPC do nó (local ou testnet).
//
// Execução local (nó deve estar rodando: npx hardhat node):
//   npx hardhat run scripts/demo-web3.js --network localhost
//
// Execução Sepolia (preencher .env):
//   npx hardhat run scripts/demo-web3.js --network sepolia
// ─────────────────────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

// ── Endereços dos contratos (atualize após cada deploy) ───────────────────────
// Para localhost use os endereços gerados pelo deploy.js
// Para Sepolia substitua pelos endereços reais após o deploy
const CONTRACTS = {
  token:      process.env.TOKEN_ADDRESS      || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  nft:        process.env.NFT_ADDRESS        || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  staking:    process.env.STAKING_ADDRESS    || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  governance: process.env.GOVERNANCE_ADDRESS || "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
};

// ── Utilitário de log formatado ───────────────────────────────────────────────
function log(section, msg) {
  const icons = { info: "ℹ", ok: "✅", tx: "📤", event: "📣", title: "🔷" };
  const icon = icons[section] || "·";
  console.log(`${icon}  ${msg}`);
}
function divider(title) {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

// ── Função auxiliar: aguarda tx e loga gas gasto ──────────────────────────────
async function sendTx(label, txPromise) {
  const tx = await txPromise;
  log("tx", `${label} — hash: ${tx.hash.slice(0, 20)}...`);
  const receipt = await tx.wait();
  log("ok", `Confirmado no bloco ${receipt.blockNumber} | gas usado: ${receipt.gasUsed.toLocaleString()}`);
  return receipt;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const signers  = await ethers.getSigners();
  const admin    = signers[0];  // deployer / proprietário dos contratos
  const aluno    = signers[1];  // aluno da plataforma
  const membro   = signers[2];  // outro membro da DAO

  // ── Conexão com os contratos via ethers.js ────────────────────────────────
  const token      = await ethers.getContractAt("AcadToken",              CONTRACTS.token,      admin);
  const nft        = await ethers.getContractAt("AcademicCertificate",    CONTRACTS.nft,        admin);
  const staking    = await ethers.getContractAt("AcadStaking",            CONTRACTS.staking,    admin);
  const governance = await ethers.getContractAt("AcadGovernance",         CONTRACTS.governance, admin);

  // ─────────────────────────────────────────────────────────────────────────
  divider("ETAPA 1 — Leitura de Dados On-Chain (ethers.js)");
  // ─────────────────────────────────────────────────────────────────────────

  const tokenName    = await token.name();
  const tokenSymbol  = await token.symbol();
  const totalSupply  = await token.totalSupply();
  const adminBalance = await token.balanceOf(admin.address);

  log("info", `Token: ${tokenName} (${tokenSymbol})`);
  log("info", `Supply total: ${ethers.formatEther(totalSupply)} ${tokenSymbol}`);
  log("info", `Saldo admin:  ${ethers.formatEther(adminBalance)} ${tokenSymbol}`);
  log("info", `Admin:  ${admin.address}`);
  log("info", `Aluno:  ${aluno.address}`);
  log("info", `Membro: ${membro.address}`);

  // ─────────────────────────────────────────────────────────────────────────
  divider("ETAPA 2 — Distribuição de Tokens (ERC-20)");
  // ─────────────────────────────────────────────────────────────────────────

  // Distribuir 5.000 ACAD para aluno e membro
  const distribute = ethers.parseEther("5000");
  await sendTx("Transfer → Aluno",  token.transfer(aluno.address,  distribute));
  await sendTx("Transfer → Membro", token.transfer(membro.address, distribute));

  log("ok", `Aluno recebeu:  ${ethers.formatEther(await token.balanceOf(aluno.address))} ACAD`);
  log("ok", `Membro recebeu: ${ethers.formatEther(await token.balanceOf(membro.address))} ACAD`);

  // ─────────────────────────────────────────────────────────────────────────
  divider("ETAPA 3 — Mint de Certificado NFT (ERC-721)");
  // ─────────────────────────────────────────────────────────────────────────

  // Metadados do certificado em formato compatível com OpenSea/IPFS
  const certURI = "ipfs://QmAcadCertificate/david-damasceno-blockchain-2026.json";

  const mintReceipt = await sendTx(
    "mintCertificate → Aluno",
    nft.mintCertificate(aluno.address, certURI)
  );

  // Lê o evento emitido pelo contrato
  const mintEvent = mintReceipt.logs
    .map(l => { try { return nft.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "CertificateMinted");

  if (mintEvent) {
    log("event", `Evento CertificateMinted:`);
    log("info",  `  TokenId:    ${mintEvent.args.tokenId}`);
    log("info",  `  Dono:       ${mintEvent.args.to}`);
    log("info",  `  URI:        ${mintEvent.args.tokenURI}`);
  }

  log("ok", `NFT Owner verificado: ${await nft.ownerOf(0)} == Aluno: ${aluno.address}`);
  log("ok", `Total NFTs emitidos:  ${await nft.totalSupply()}`);

  // ─────────────────────────────────────────────────────────────────────────
  divider("ETAPA 4 — Staking de Tokens + Oráculo Chainlink");
  // ─────────────────────────────────────────────────────────────────────────

  const stakeAmount = ethers.parseEther("2000");

  // Consulta preço ETH/USD via Chainlink antes do stake
  const ethPrice = await staking.getLatestEthPrice();
  log("info", `Preço ETH/USD (Chainlink): $${(Number(ethPrice) / 1e8).toFixed(2)}`);

  // Atualiza taxa de recompensa com base no preço atual
  await sendTx("updateRewardRate (Chainlink)", staking.updateRewardRate());
  const rate = await staking.rewardRate();
  log("info", `Reward rate atual: ${rate.toString()} wei/s`);

  // Aluno aprova e faz stake
  await sendTx("approve (Aluno → Staking)", token.connect(aluno).approve(CONTRACTS.staking, stakeAmount));
  await sendTx("stake 2.000 ACAD (Aluno)",  staking.connect(aluno).stake(stakeAmount));

  log("ok", `Aluno em staking: ${ethers.formatEther(await staking.stakedBalance(aluno.address))} ACAD`);
  log("ok", `Total em staking: ${ethers.formatEther(await staking.totalStaked())} ACAD`);
  log("ok", `Pool de rewards:  ${ethers.formatEther(await staking.rewardPoolBalance())} ACAD`);

  // ─────────────────────────────────────────────────────────────────────────
  divider("ETAPA 5 — Governança DAO (Proposta + Voto)");
  // ─────────────────────────────────────────────────────────────────────────

  // Admin cria proposta
  const descricao = "Integrar modulo de Zero-Knowledge Proofs ao curriculo do ACAD Protocol";
  const propReceipt = await sendTx(
    "createProposal (Admin)",
    governance.createProposal(descricao)
  );

  const propEvent = propReceipt.logs
    .map(l => { try { return governance.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "ProposalCreated");

  const proposalId = propEvent?.args.id ?? 0n;
  const deadline   = propEvent?.args.deadline ?? 0n;

  log("event", `Evento ProposalCreated:`);
  log("info",  `  ID:          ${proposalId}`);
  log("info",  `  Descrição:   ${descricao}`);
  log("info",  `  Deadline:    ${new Date(Number(deadline) * 1000).toLocaleString("pt-BR")}`);

  // Admin e membro votam SIM
  await sendTx("vote SIM (Admin)",  governance.connect(admin).vote(proposalId, true));
  await sendTx("vote SIM (Membro)", governance.connect(membro).vote(proposalId, true));

  // Lê resultado atual
  const [, desc, voteFor, voteAgainst] = await governance.getProposal(proposalId);
  const status = await governance.getProposalStatus(proposalId);

  log("event", `Estado da proposta:`);
  log("info",  `  Status:       ${status}`);
  log("info",  `  Votos SIM:    ${ethers.formatEther(voteFor)} ACAD`);
  log("info",  `  Votos NÃO:    ${ethers.formatEther(voteAgainst)} ACAD`);
  log("info",  `  Total propostas: ${await governance.proposalCount()}`);

  // ─────────────────────────────────────────────────────────────────────────
  divider("RESUMO FINAL — Protocolo ACAD em operação");
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`
  Contratos deployados:
  ─────────────────────────────────────────────────
  AcadToken (ERC-20):           ${CONTRACTS.token}
  AcademicCertificate (ERC-721):${CONTRACTS.nft}
  AcadStaking (Chainlink):      ${CONTRACTS.staking}
  AcadGovernance (DAO):         ${CONTRACTS.governance}

  Estado atual:
  ─────────────────────────────────────────────────
  Supply ACAD:          ${ethers.formatEther(await token.totalSupply())} tokens
  NFTs emitidos:        ${await nft.totalSupply()} certificados
  Total em staking:     ${ethers.formatEther(await staking.totalStaked())} ACAD
  Propostas na DAO:     ${await governance.proposalCount()}
  Preço ETH/USD:        $${(Number(await staking.getLatestEthPrice()) / 1e8).toFixed(2)}
  ─────────────────────────────────────────────────
  Integração Web3 com ethers.js: CONCLUÍDA ✅
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
