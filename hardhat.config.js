require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    // Rede local (npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Testnet Sepolia — configure no .env
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  // Verificação de contratos no Etherscan
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  // Relatório de gas ao rodar testes
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
