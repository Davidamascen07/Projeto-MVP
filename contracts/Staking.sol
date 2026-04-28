// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title AcadStaking — Contrato de Staking com recompensa dinâmica via Chainlink
 * @notice Usuários fazem stake de ACAD tokens e ganham recompensas.
 *         A taxa de recompensa é ajustada automaticamente com base no preço ETH/USD
 *         fornecido pelo oráculo Chainlink.
 *
 * O QUE É STAKING?
 * O usuário "trava" seus tokens no contrato por um período e recebe recompensas
 * proporcionais ao tempo e quantidade travados. Similar a uma poupança rendendo juros.
 *
 * INTEGRAÇÃO COM ORÁCULO (Chainlink Price Feed):
 * Oráculos são pontes entre a blockchain (mundo fechado) e dados externos (mundo real).
 * A EVM não consegue acessar APIs externas diretamente — precisamos de um oráculo.
 * Chainlink é o oráculo descentralizado mais utilizado na Ethereum.
 * Neste contrato: se ETH > $3000 → bônus de 50% nas recompensas.
 *                 se ETH < $1500 → redução de 30% nas recompensas.
 *
 * SEGURANÇA — ReentrancyGuard:
 * Previne o ataque de reentrância: um contrato malicioso que chama a função
 * novamente antes que ela termine, drenando fundos (ex: hack do DAO em 2016).
 * O guard adiciona um "lock" que impede chamadas simultâneas.
 *
 * PADRÃO DE CÁLCULO DE RECOMPENSA (baseado no Synthetix):
 * rewardPerToken acumula rewards por token ao longo do tempo.
 * earned(user) = staked * (rewardPerToken - userPaid) / 1e18 + pendente
 */

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Interface mínima do Chainlink AggregatorV3 — evita dependência de versão
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

contract AcadStaking is ReentrancyGuard, Ownable {

    // ─── Tokens ────────────────────────────────────────────────────────────────
    IERC20 public immutable stakingToken;  // Token que o usuário faz stake (ACAD)
    IERC20 public immutable rewardToken;   // Token de recompensa (também ACAD)

    // ─── Oráculo Chainlink ─────────────────────────────────────────────────────
    AggregatorV3Interface public priceFeed; // Feed ETH/USD

    // ─── Parâmetros de Recompensa ──────────────────────────────────────────────
    /// @dev Taxa base: tokens-wei distribuídos por segundo (para todos os stakers)
    uint256 public constant BASE_REWARD_RATE = 1e12;

    uint256 public rewardRate;            // Taxa atual (ajustada pelo oráculo)
    uint256 public rewardPerTokenStored;  // Recompensa acumulada por token (escalonada 1e18)
    uint256 public lastUpdateTime;        // Último timestamp em que rewardPerToken foi atualizado
    uint256 public totalStaked;           // Total de tokens em staking
    uint256 public rewardPoolBalance;     // Saldo disponível para recompensas

    // ─── Mapeamentos por usuário ───────────────────────────────────────────────
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ─── Eventos ───────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate, int256 ethPrice);
    event RewardsDeposited(uint256 amount);

    // ─── Constructor ───────────────────────────────────────────────────────────
    /**
     * @param _stakingToken Endereço do token de staking (ACAD)
     * @param _rewardToken  Endereço do token de recompensa (ACAD)
     * @param _priceFeed    Endereço do feed ETH/USD do Chainlink
     * @param _owner        Endereço do proprietário do contrato
     *
     * Sepolia ETH/USD Feed: 0x694AA1769357215DE4FAC081bf1f309aDC325306
     */
    constructor(
        address _stakingToken,
        address _rewardToken,
        address _priceFeed,
        address _owner
    ) Ownable(_owner) {
        require(_stakingToken != address(0), "Staking token invalido");
        require(_rewardToken  != address(0), "Reward token invalido");
        require(_priceFeed    != address(0), "Price feed invalido");

        stakingToken  = IERC20(_stakingToken);
        rewardToken   = IERC20(_rewardToken);
        priceFeed     = AggregatorV3Interface(_priceFeed);
        rewardRate    = BASE_REWARD_RATE;
        lastUpdateTime = block.timestamp;
    }

    // ─── Modifier: atualiza recompensas antes de qualquer operação ────────────
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ─── Funções de leitura (view — sem custo de gas externo) ─────────────────

    /**
     * @notice Calcula a recompensa acumulada por token até o momento atual.
     * @dev Se ninguém fez stake, retorna o valor armazenado sem incrementar.
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + ((block.timestamp - lastUpdateTime) * rewardRate * 1e18 / totalStaked);
    }

    /**
     * @notice Retorna o total de recompensas pendentes de um usuário.
     * @param account Endereço do usuário
     */
    function earned(address account) public view returns (uint256) {
        return (
            stakedBalance[account]
                * (rewardPerToken() - userRewardPerTokenPaid[account])
                / 1e18
        ) + rewards[account];
    }

    /// @notice Retorna o preço ETH/USD atual do oráculo (8 decimais)
    function getLatestEthPrice() external view returns (int256 price) {
        (, price,,,) = priceFeed.latestRoundData();
    }

    // ─── Funções de escrita ────────────────────────────────────────────────────

    /**
     * @notice Faz stake de `amount` tokens ACAD.
     * @dev Transfere tokens do usuário para o contrato.
     *      O usuário deve chamar token.approve(staking, amount) antes.
     *      nonReentrant previne ataques de reentrância.
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Valor deve ser maior que zero");

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;

        // Checks-Effects-Interactions: estado atualizado ANTES da transferência
        require(
            stakingToken.transferFrom(msg.sender, address(this), amount),
            "Transferencia de staking falhou"
        );

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Remove `amount` tokens do staking e os devolve ao usuário.
     * @dev Não resgata recompensas automaticamente — use claimRewards() separado.
     */
    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Valor deve ser maior que zero");
        require(stakedBalance[msg.sender] >= amount, "Saldo insuficiente em staking");

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        require(
            stakingToken.transfer(msg.sender, amount),
            "Transferencia de unstake falhou"
        );

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Resgata todas as recompensas pendentes do usuário.
     * @dev Transfere recompensas do pool para o usuário.
     */
    function claimRewards() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "Sem recompensas para resgatar");
        require(rewardPoolBalance >= reward, "Pool de recompensas insuficiente");

        rewards[msg.sender] = 0;
        rewardPoolBalance -= reward;

        require(
            rewardToken.transfer(msg.sender, reward),
            "Transferencia de recompensa falhou"
        );

        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Atualiza a taxa de recompensa com base no preço ETH/USD do Chainlink.
     * @dev Qualquer um pode chamar — incentiva manutenção descentralizada do protocolo.
     *      ETH > $3.000 → taxa +50% | ETH < $1.500 → taxa -30% | caso base = taxa padrão
     */
    function updateRewardRate() external updateReward(address(0)) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Preco invalido do oraculo Chainlink");

        uint256 ethPrice = uint256(price); // 8 decimais (ex: $2000 = 200_000_000_00)
        uint256 newRate;

        if (ethPrice >= 300_000_000_000) {         // ETH > $3.000
            newRate = BASE_REWARD_RATE * 150 / 100;  // +50%
        } else if (ethPrice <= 150_000_000_000) {  // ETH < $1.500
            newRate = BASE_REWARD_RATE * 70  / 100;  // -30%
        } else {
            newRate = BASE_REWARD_RATE;              // taxa base
        }

        emit RewardRateUpdated(rewardRate, newRate, price);
        rewardRate = newRate;
    }

    /**
     * @notice Retira todos os tokens de staking em emergência, sem receber recompensas.
     * @dev Proteção para usuários caso o pool de recompensas esteja vazio.
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakedBalance[msg.sender];
        require(amount > 0, "Nenhum token em staking");

        // Zera estado antes de transferir (padrão Checks-Effects-Interactions)
        stakedBalance[msg.sender] = 0;
        totalStaked -= amount;
        rewards[msg.sender] = 0;

        require(
            stakingToken.transfer(msg.sender, amount),
            "Transferencia de emergencia falhou"
        );
    }

    /**
     * @notice Deposita tokens no pool de recompensas (apenas owner).
     * @param amount Quantidade de rewardToken a depositar
     */
    function depositRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "Quantidade deve ser maior que zero");
        rewardPoolBalance += amount;
        require(
            rewardToken.transferFrom(msg.sender, address(this), amount),
            "Deposito de recompensas falhou"
        );
        emit RewardsDeposited(amount);
    }
}
