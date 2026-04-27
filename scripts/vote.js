// scripts/vote.js
// Cria uma proposta na DAO e vota nela
// Uso: GOVERNANCE_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run scripts/vote.js --network sepolia

const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const proposer = signers[0];
  const voter    = signers[1] || signers[0]; // segundo signer ou o mesmo

  const govAddress   = process.env.GOVERNANCE_ADDRESS;
  const tokenAddress = process.env.TOKEN_ADDRESS;

  if (!govAddress || !tokenAddress) {
    throw new Error("Defina GOVERNANCE_ADDRESS e TOKEN_ADDRESS no ambiente.");
  }

  const governance = await ethers.getContractAt("AcadGovernance", govAddress);
  const token      = await ethers.getContractAt("AcadToken",      tokenAddress);

  console.log("=".repeat(60));
  console.log("  ACAD DAO — Governança Descentralizada");
  console.log("=".repeat(60));

  // ── 1. Verificar saldo do proponente ──────────────────────────────────────
  const balance = await token.balanceOf(proposer.address);
  console.log("Proponente:", proposer.address);
  console.log("Saldo ACAD:", ethers.formatEther(balance), "ACAD");

  if (balance < ethers.parseEther("100")) {
    throw new Error("Saldo insuficiente. Mínimo de 100 ACAD para propor.");
  }

  // ── 2. Criar proposta ─────────────────────────────────────────────────────
  const description = process.env.PROPOSAL ||
    "Adicionar modulo avancado de Seguranca em Smart Contracts ao curriculo do protocolo";

  console.log("\n[1] Criando proposta...");
  console.log("Descrição:", description);

  const createTx = await governance.connect(proposer).createProposal(description);
  const createReceipt = await createTx.wait();

  // Obtém o ID da proposta a partir do evento
  const event = createReceipt.logs
    .map((log) => { try { return governance.interface.parseLog(log); } catch { return null; } })
    .find((e) => e && e.name === "ProposalCreated");

  const proposalId = event ? event.args.id : 0n;
  const deadline   = event ? event.args.deadline : 0n;

  console.log("Proposta criada! ID:", proposalId.toString());
  console.log("Prazo de votação:", new Date(Number(deadline) * 1000).toLocaleString("pt-BR"));

  // ── 3. Votar SIM ──────────────────────────────────────────────────────────
  console.log("\n[2] Votando SIM na proposta", proposalId.toString(), "...");
  console.log("Eleitor:", voter.address);

  const voteTx = await governance.connect(voter).vote(proposalId, true);
  const voteReceipt = await voteTx.wait();
  console.log("Voto registrado no bloco:", voteReceipt.blockNumber);

  // ── 4. Exibir situação atual da proposta ──────────────────────────────────
  const [, desc, voteFor, voteAgainst, , executed, cancelled] =
    await governance.getProposal(proposalId);

  const status = await governance.getProposalStatus(proposalId);

  console.log("\n" + "─".repeat(40));
  console.log("Proposta:", desc);
  console.log("Status:  ", status);
  console.log("Votos SIM:   ", ethers.formatEther(voteFor),     "ACAD");
  console.log("Votos NÃO:   ", ethers.formatEther(voteAgainst), "ACAD");
  console.log("Executada:", executed, "| Cancelada:", cancelled);
  console.log("─".repeat(40));

  console.log("\nTotal de propostas:", (await governance.proposalCount()).toString());
  console.log("\nPara executar após o prazo:");
  console.log(`  GOVERNANCE_ADDRESS=${govAddress} npx hardhat run scripts/execute.js --network sepolia`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
