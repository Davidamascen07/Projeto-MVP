// scripts/deploy.js
// Deploy completo do ACAD Protocol em localhost ou Sepolia testnet
// Execução: npx hardhat run scripts/deploy.js --network sepolia

const { ethers } = require("hardhat");

// Chainlink ETH/USD Price Feed na Sepolia
// Fonte: https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1#sepolia-testnet
const SEPOLIA_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  ACAD Protocol — Deploy Script");
  console.log("=".repeat(60));
  console.log("Deployer:  ", deployer.address);
  console.log("Network:   ", network.name, `(chainId: ${network.chainId})`);
  console.log("Balance:   ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("-".repeat(60));

  // ── 1. AcadToken (ERC-20) ─────────────────────────────────────────────────
  console.log("\n[1/4] Deployando AcadToken (ERC-20)...");
  const AcadToken = await ethers.getContractFactory("AcadToken");
  const token = await AcadToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("      AcadToken:          ", tokenAddr);

  // ── 2. AcademicCertificate (NFT ERC-721) ─────────────────────────────────
  console.log("\n[2/4] Deployando AcademicCertificate (ERC-721)...");
  const AcademicCertificate = await ethers.getContractFactory("AcademicCertificate");
  const nft = await AcademicCertificate.deploy(deployer.address);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("      AcademicCertificate:", nftAddr);

  // ── 3. AcadStaking ────────────────────────────────────────────────────────
  console.log("\n[3/4] Deployando AcadStaking...");
  const priceFeedAddr = network.chainId === 31337n
    ? await deployMockFeed()   // Rede local: usa mock
    : SEPOLIA_ETH_USD_FEED;    // Sepolia: usa feed real da Chainlink

  const AcadStaking = await ethers.getContractFactory("AcadStaking");
  const staking = await AcadStaking.deploy(
    tokenAddr,
    tokenAddr,
    priceFeedAddr,
    deployer.address
  );
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("      AcadStaking:        ", stakingAddr);
  console.log("      Price Feed:         ", priceFeedAddr);

  // ── 4. AcadGovernance (DAO) ───────────────────────────────────────────────
  console.log("\n[4/4] Deployando AcadGovernance (DAO)...");
  const AcadGovernance = await ethers.getContractFactory("AcadGovernance");
  const governance = await AcadGovernance.deploy(tokenAddr, deployer.address);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("      AcadGovernance:     ", govAddr);

  // ── Setup pós-deploy ──────────────────────────────────────────────────────
  console.log("\n[Setup] Configurando contratos...");

  // Concede MINTER_ROLE ao contrato de Staking
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  await (await token.grantRole(MINTER_ROLE, stakingAddr)).wait();
  console.log("      MINTER_ROLE concedido ao Staking ✓");

  // Deposita 200.000 ACAD no pool de recompensas do Staking
  const rewardAmount = ethers.parseEther("200000");
  await (await token.approve(stakingAddr, rewardAmount)).wait();
  await (await staking.depositRewards(rewardAmount)).wait();
  console.log("      200.000 ACAD depositados como recompensas ✓");

  // ── Resumo final ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOY CONCLUÍDO — Endereços dos Contratos");
  console.log("=".repeat(60));
  console.log(`AcadToken:           ${tokenAddr}`);
  console.log(`AcademicCertificate: ${nftAddr}`);
  console.log(`AcadStaking:         ${stakingAddr}`);
  console.log(`AcadGovernance:      ${govAddr}`);

  if (network.chainId !== 31337n) {
    console.log("\n  Links no Etherscan (Sepolia):");
    console.log(`  Token:    https://sepolia.etherscan.io/address/${tokenAddr}`);
    console.log(`  NFT:      https://sepolia.etherscan.io/address/${nftAddr}`);
    console.log(`  Staking:  https://sepolia.etherscan.io/address/${stakingAddr}`);
    console.log(`  DAO:      https://sepolia.etherscan.io/address/${govAddr}`);
  }
  console.log("=".repeat(60));
}

// Helper: deploya o mock apenas em rede local
async function deployMockFeed() {
  const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
  // ETH/USD = $2.000 (200_000_000_00 com 8 decimais)
  const mock = await MockV3Aggregator.deploy(8, 200_000_000_000n);
  await mock.waitForDeployment();
  console.log("      MockV3Aggregator:   ", await mock.getAddress(), "(local)");
  return await mock.getAddress();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
