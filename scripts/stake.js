// scripts/stake.js
// Faz stake de tokens ACAD, verifica preço ETH/USD via Chainlink e atualiza reward rate
// Uso: TOKEN_ADDRESS=0x... STAKING_ADDRESS=0x... AMOUNT=1000 npx hardhat run scripts/stake.js --network sepolia

const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  const tokenAddress  = process.env.TOKEN_ADDRESS;
  const stakingAddress = process.env.STAKING_ADDRESS;

  if (!tokenAddress || !stakingAddress) {
    throw new Error("Defina TOKEN_ADDRESS e STAKING_ADDRESS no ambiente.");
  }

  const token   = await ethers.getContractAt("AcadToken",   tokenAddress);
  const staking = await ethers.getContractAt("AcadStaking", stakingAddress);

  const amountEther = process.env.AMOUNT || "100";
  const amount = ethers.parseEther(amountEther);

  console.log("=".repeat(55));
  console.log("  ACAD Staking — Stake de Tokens");
  console.log("=".repeat(55));
  console.log("Usuário:         ", user.address);
  console.log("Token:           ", tokenAddress);
  console.log("Staking:         ", stakingAddress);
  console.log("Quantidade:      ", amountEther, "ACAD");
  console.log("-".repeat(55));

  // 1. Verificar saldo
  const balance = await token.balanceOf(user.address);
  console.log("Saldo atual:     ", ethers.formatEther(balance), "ACAD");
  if (balance < amount) throw new Error("Saldo insuficiente para stake.");

  // 2. Aprovar o contrato de staking para gastar tokens
  console.log("\nAprovando tokens...");
  const approveTx = await token.approve(stakingAddress, amount);
  await approveTx.wait();
  console.log("Aprovação confirmada ✓");

  // 3. Fazer stake
  console.log("Fazendo stake de", amountEther, "ACAD...");
  const stakeTx = await staking.stake(amount);
  const receipt = await stakeTx.wait();
  console.log("Stake confirmado no bloco:", receipt.blockNumber, "✓");

  // 4. Exibir saldo em staking
  const staked = await staking.stakedBalance(user.address);
  console.log("\nSaldo em staking:", ethers.formatEther(staked), "ACAD");

  // 5. Consultar preço ETH/USD via Chainlink
  const ethPrice = await staking.getLatestEthPrice();
  console.log("Preço ETH/USD (Chainlink): $" + (Number(ethPrice) / 1e8).toFixed(2));

  // 6. Atualizar taxa de recompensa baseada no preço atual
  console.log("\nAtualizando reward rate com base no oráculo...");
  const updateTx = await staking.updateRewardRate();
  await updateTx.wait();
  const newRate = await staking.rewardRate();
  console.log("Nova reward rate:", newRate.toString(), "wei/s por token total");

  // 7. Recompensas pendentes (recém-stakado, então deve ser ~0)
  const earned = await staking.earned(user.address);
  console.log("Recompensas pendentes:", ethers.formatEther(earned), "ACAD");

  console.log("\nStake realizado com sucesso!");
  console.log("=".repeat(55));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
