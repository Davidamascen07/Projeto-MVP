// test/MVPTest.js
// Suite completa de testes — ACAD Protocol MVP
// Execução: npx hardhat test

const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

describe("ACAD Protocol — Suite de Testes Completa", function () {

  let owner, user1, user2, poorUser;
  let token, nft, staking, governance, mockFeed;

  // Roda antes de cada teste — garante estado limpo
  beforeEach(async () => {
    [owner, user1, user2, poorUser] = await ethers.getSigners();

    // ── Mock Price Feed: ETH = $2.000 (8 decimais → 200_000_000_00) ──────────
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    mockFeed = await MockV3Aggregator.deploy(8, 200_000_000_000n);

    // ── Deploy dos contratos ──────────────────────────────────────────────────
    const AcadToken = await ethers.getContractFactory("AcadToken");
    token = await AcadToken.deploy(owner.address);

    const AcademicCertificate = await ethers.getContractFactory("AcademicCertificate");
    nft = await AcademicCertificate.deploy(owner.address);

    const AcadStaking = await ethers.getContractFactory("AcadStaking");
    staking = await AcadStaking.deploy(
      await token.getAddress(),
      await token.getAddress(),
      await mockFeed.getAddress(),
      owner.address
    );

    const AcadGovernance = await ethers.getContractFactory("AcadGovernance");
    governance = await AcadGovernance.deploy(
      await token.getAddress(),
      owner.address
    );

    // ── Setup: concede MINTER_ROLE ao Staking e deposita recompensas ──────────
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await token.grantRole(MINTER_ROLE, await staking.getAddress());

    const rewardPool = ethers.parseEther("500000");
    await token.approve(await staking.getAddress(), rewardPool);
    await staking.depositRewards(rewardPool);

    // Distribui tokens para os usuários de teste
    await token.transfer(user1.address,   ethers.parseEther("10000"));
    await token.transfer(user2.address,   ethers.parseEther("5000"));
    await token.transfer(poorUser.address, ethers.parseEther("50")); // < 100 ACAD
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AcadToken (ERC-20)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("AcadToken — ERC-20", () => {

    it("deve ter nome, símbolo e decimais corretos", async () => {
      expect(await token.name()).to.equal("AcadToken");
      expect(await token.symbol()).to.equal("ACAD");
      expect(await token.decimals()).to.equal(18);
    });

    it("supply inicial deve ser 1.000.000 ACAD", async () => {
      expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000"));
    });

    it("owner pode mintar novos tokens com MINTER_ROLE", async () => {
      await token.mint(user1.address, ethers.parseEther("500"));
      expect(await token.balanceOf(user1.address))
        .to.equal(ethers.parseEther("10500"));
    });

    it("deve rever se endereço sem MINTER_ROLE tentar mintar", async () => {
      await expect(
        token.connect(user1).mint(user1.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });

    it("usuário pode queimar (burn) seus próprios tokens", async () => {
      await token.connect(user1).burn(ethers.parseEther("100"));
      expect(await token.balanceOf(user1.address))
        .to.equal(ethers.parseEther("9900"));
    });

    it("deve rever mint para zero address", async () => {
      await expect(
        token.mint(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Mint para zero address nao permitido");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. AcademicCertificate (NFT ERC-721)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("AcademicCertificate — ERC-721", () => {

    it("deve mintar NFT e atribuir ao destinatário correto", async () => {
      await nft.mintCertificate(user1.address, "ipfs://QmTeste/cert.json");
      expect(await nft.ownerOf(0)).to.equal(user1.address);
    });

    it("deve armazenar a URI corretamente", async () => {
      await nft.mintCertificate(user1.address, "ipfs://QmTeste/cert.json");
      expect(await nft.tokenURI(0)).to.equal("ipfs://QmTeste/cert.json");
    });

    it("deve emitir o evento CertificateMinted com argumentos corretos", async () => {
      await expect(nft.mintCertificate(user1.address, "ipfs://QmA/cert.json"))
        .to.emit(nft, "CertificateMinted")
        .withArgs(user1.address, 0n, "ipfs://QmA/cert.json");
    });

    it("tokenIds devem incrementar a cada mint", async () => {
      await nft.mintCertificate(user1.address, "ipfs://1");
      await nft.mintCertificate(user2.address, "ipfs://2");
      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user2.address);
      expect(await nft.totalSupply()).to.equal(2n);
    });

    it("deve rever se endereço sem MINTER_ROLE tentar mintar NFT", async () => {
      await expect(
        nft.connect(user1).mintCertificate(user1.address, "ipfs://x")
      ).to.be.reverted;
    });

    it("deve rever mint com URI vazia", async () => {
      await expect(
        nft.mintCertificate(user1.address, "")
      ).to.be.revertedWith("URI nao pode ser vazia");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. AcadStaking
  // ═══════════════════════════════════════════════════════════════════════════
  describe("AcadStaking — Staking com Chainlink", () => {

    const stakeAmount = ethers.parseEther("1000");

    async function approveAndStake(user, amount) {
      await token.connect(user).approve(await staking.getAddress(), amount);
      return staking.connect(user).stake(amount);
    }

    it("usuário pode fazer stake e saldo é atualizado", async () => {
      await approveAndStake(user1, stakeAmount);
      expect(await staking.stakedBalance(user1.address)).to.equal(stakeAmount);
      expect(await staking.totalStaked()).to.equal(stakeAmount);
    });

    it("deve emitir evento Staked", async () => {
      await token.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await expect(staking.connect(user1).stake(stakeAmount))
        .to.emit(staking, "Staked")
        .withArgs(user1.address, stakeAmount);
    });

    it("usuário pode fazer unstake e receber tokens de volta", async () => {
      await approveAndStake(user1, stakeAmount);
      const balBefore = await token.balanceOf(user1.address);
      await staking.connect(user1).unstake(stakeAmount);
      const balAfter = await token.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(stakeAmount);
    });

    it("recompensas devem acumular com o tempo", async () => {
      await approveAndStake(user1, stakeAmount);
      await time.increase(86400); // avança 1 dia
      const earned = await staking.earned(user1.address);
      expect(earned).to.be.gt(0n);
    });

    it("deve rever stake de valor zero", async () => {
      await expect(staking.connect(user1).stake(0n))
        .to.be.revertedWith("Valor deve ser maior que zero");
    });

    it("deve rever unstake com saldo insuficiente", async () => {
      await expect(staking.connect(user1).unstake(stakeAmount))
        .to.be.revertedWith("Saldo insuficiente em staking");
    });

    it("deve rever unstake de valor zero", async () => {
      await approveAndStake(user1, stakeAmount);
      await expect(staking.connect(user1).unstake(0n))
        .to.be.revertedWith("Valor deve ser maior que zero");
    });

    // ── Integração com oráculo Chainlink ──────────────────────────────────────
    it("updateRewardRate: ETH > $3.000 → taxa sobe 50%", async () => {
      await mockFeed.updateAnswer(350_000_000_000n); // $3.500
      await staking.updateRewardRate();
      const BASE = await staking.BASE_REWARD_RATE();
      expect(await staking.rewardRate()).to.equal(BASE * 150n / 100n);
    });

    it("updateRewardRate: ETH < $1.500 → taxa cai 30%", async () => {
      await mockFeed.updateAnswer(100_000_000_000n); // $1.000
      await staking.updateRewardRate();
      const BASE = await staking.BASE_REWARD_RATE();
      expect(await staking.rewardRate()).to.equal(BASE * 70n / 100n);
    });

    it("updateRewardRate: ETH entre $1.500–$3.000 → taxa base", async () => {
      await mockFeed.updateAnswer(200_000_000_000n); // $2.000
      await staking.updateRewardRate();
      const BASE = await staking.BASE_REWARD_RATE();
      expect(await staking.rewardRate()).to.equal(BASE);
    });

    it("deve emitir evento RewardRateUpdated", async () => {
      await mockFeed.updateAnswer(350_000_000_000n);
      await expect(staking.updateRewardRate())
        .to.emit(staking, "RewardRateUpdated");
    });

    it("emergencyWithdraw retorna tokens sem recompensas", async () => {
      await approveAndStake(user1, stakeAmount);
      await time.increase(3600);
      const before = await token.balanceOf(user1.address);
      await staking.connect(user1).emergencyWithdraw();
      const after = await token.balanceOf(user1.address);
      expect(after - before).to.equal(stakeAmount);
      expect(await staking.rewards(user1.address)).to.equal(0n);
    });

    it("emergencyWithdraw deve rever se não há tokens em staking", async () => {
      await expect(staking.connect(user1).emergencyWithdraw())
        .to.be.revertedWith("Nenhum token em staking");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. AcadGovernance (DAO)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("AcadGovernance — DAO", () => {

    it("usuário com ≥ 100 ACAD pode criar proposta", async () => {
      await expect(
        governance.connect(user1).createProposal("Nova disciplina de DeFi")
      ).to.emit(governance, "ProposalCreated");
    });

    it("deve rever criação de proposta com < 100 ACAD", async () => {
      await expect(
        governance.connect(poorUser).createProposal("Proposta inválida")
      ).to.be.revertedWith("Minimo de 100 ACAD para criar proposta");
    });

    it("deve rever criação de proposta com descrição vazia", async () => {
      await expect(
        governance.connect(user1).createProposal("")
      ).to.be.revertedWith("Descricao nao pode ser vazia");
    });

    it("proposalCount incrementa a cada proposta", async () => {
      await governance.connect(user1).createProposal("Proposta 1");
      await governance.connect(user1).createProposal("Proposta 2");
      expect(await governance.proposalCount()).to.equal(2n);
    });

    it("usuário pode votar SIM em proposta ativa", async () => {
      await governance.connect(user1).createProposal("Proposta A");
      await expect(governance.connect(user1).vote(0n, true))
        .to.emit(governance, "Voted");
    });

    it("deve rever voto duplo na mesma proposta", async () => {
      await governance.connect(user1).createProposal("Proposta B");
      await governance.connect(user1).vote(0n, true);
      await expect(governance.connect(user1).vote(0n, false))
        .to.be.revertedWith("Voce ja votou nesta proposta");
    });

    it("deve rever voto após prazo encerrado", async () => {
      await governance.connect(user1).createProposal("Proposta C");
      await time.increase(3 * 24 * 3600 + 1); // 3 dias + 1s
      await expect(governance.connect(user2).vote(0n, true))
        .to.be.revertedWith("Periodo de votacao encerrado");
    });

    it("pode executar proposta com quórum e prazo encerrado", async () => {
      await governance.connect(user1).createProposal("Proposta D");
      await governance.connect(user1).vote(0n, true);  // 10.000 ACAD
      await governance.connect(user2).vote(0n, true);  // 5.000 ACAD
      await time.increase(3 * 24 * 3600 + 1);
      await expect(governance.execute(0n))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(0n, true);
    });

    it("deve rever execução sem quórum mínimo (1.000 ACAD)", async () => {
      await governance.connect(user1).createProposal("Proposta E");
      // poorUser tem 50 ACAD — abaixo do quórum de 1.000
      await governance.connect(poorUser).vote(0n, true);
      await time.increase(3 * 24 * 3600 + 1);
      await expect(governance.execute(0n))
        .to.be.revertedWith("Quorum minimo nao atingido");
    });

    it("deve rever execução antes do prazo", async () => {
      await governance.connect(user1).createProposal("Proposta F");
      await expect(governance.execute(0n))
        .to.be.revertedWith("Votacao ainda em andamento");
    });

    it("deve rever dupla execução", async () => {
      await governance.connect(user1).createProposal("Proposta G");
      await governance.connect(user1).vote(0n, true);
      await governance.connect(user2).vote(0n, true);
      await time.increase(3 * 24 * 3600 + 1);
      await governance.execute(0n);
      await expect(governance.execute(0n))
        .to.be.revertedWith("Proposta ja foi executada");
    });

    it("proponente pode cancelar proposta antes da execução", async () => {
      await governance.connect(user1).createProposal("Proposta H");
      await expect(governance.connect(user1).cancelProposal(0n))
        .to.emit(governance, "ProposalCancelled");
    });

    it("deve rever voto em proposta cancelada", async () => {
      await governance.connect(user1).createProposal("Proposta I");
      await governance.connect(user1).cancelProposal(0n);
      await expect(governance.connect(user2).vote(0n, true))
        .to.be.revertedWith("Proposta foi cancelada");
    });

    it("getProposalStatus retorna status correto", async () => {
      await governance.connect(user1).createProposal("Proposta J");
      expect(await governance.getProposalStatus(0n)).to.equal("Em votacao");

      await governance.connect(user1).vote(0n, true);
      await governance.connect(user2).vote(0n, true);
      await time.increase(3 * 24 * 3600 + 1);
      expect(await governance.getProposalStatus(0n)).to.equal("Aguardando execucao");

      await governance.execute(0n);
      expect(await governance.getProposalStatus(0n)).to.equal("Aprovada");
    });
  });
});
