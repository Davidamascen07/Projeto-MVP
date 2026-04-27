// scripts/mint.js
// Minta um certificado NFT para um endereço
// Uso: NFT_ADDRESS=0x... RECIPIENT=0x... TOKEN_URI=ipfs://... npx hardhat run scripts/mint.js --network sepolia

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const nftAddress = process.env.NFT_ADDRESS;
  if (!nftAddress) throw new Error("Defina NFT_ADDRESS no ambiente. Ex: NFT_ADDRESS=0x... node scripts/mint.js");

  const nft = await ethers.getContractAt("AcademicCertificate", nftAddress);

  // Endereço do destinatário (padrão: próprio deployer)
  const recipient = process.env.RECIPIENT || deployer.address;

  // URI dos metadados do certificado no IPFS
  const uri = process.env.TOKEN_URI || "ipfs://QmExemploCertificado/metadata.json";

  console.log("=".repeat(55));
  console.log("  Mintando Certificado NFT");
  console.log("=".repeat(55));
  console.log("NFT Contract: ", nftAddress);
  console.log("Destinatário: ", recipient);
  console.log("Metadata URI: ", uri);
  console.log("-".repeat(55));

  const tx = await nft.mintCertificate(recipient, uri);
  console.log("Transação enviada:", tx.hash);

  const receipt = await tx.wait();
  console.log("Confirmada no bloco:", receipt.blockNumber);

  // Lê o evento para obter o tokenId
  const event = receipt.logs
    .map((log) => { try { return nft.interface.parseLog(log); } catch { return null; } })
    .find((e) => e && e.name === "CertificateMinted");

  if (event) {
    console.log("\nCertificado NFT mintado com sucesso!");
    console.log("TokenId:      ", event.args.tokenId.toString());
    console.log("Proprietário: ", event.args.to);
    console.log("URI:          ", event.args.tokenURI);
  }

  const total = await nft.totalSupply();
  console.log("\nTotal de certificados emitidos:", total.toString());
  console.log("=".repeat(55));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
