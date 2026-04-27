// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AcadGovernance — DAO simplificada para governança do protocolo
 * @notice Detentores de ACAD podem propor, votar e executar mudanças no protocolo.
 *
 * O QUE É UMA DAO (Decentralized Autonomous Organization)?
 * Uma organização governada por código (Smart Contracts) e votos dos detentores de tokens,
 * sem diretoria central ou autoridade única. Decisões são tomadas coletivamente on-chain.
 * Exemplos reais: Uniswap, Compound, MakerDAO.
 *
 * FLUXO DE GOVERNANÇA:
 * 1. Membro com ≥ 100 ACAD cria uma proposta com descrição.
 * 2. Qualquer detentor de ACAD vota SIM ou NÃO durante o período de votação (3 dias).
 * 3. Após o prazo, qualquer um pode executar a proposta se houver quórum.
 * 4. Se votos SIM > votos NÃO e quórum atingido → proposta aprovada.
 *
 * PODER DE VOTO:
 * O peso do voto é igual ao saldo de ACAD no momento da votação (snapshot simples).
 * Quórum mínimo: 1.000 ACAD de votos totais para a proposta ser válida.
 *
 * SEGURANÇA:
 * - Apenas um voto por endereço por proposta.
 * - Não é possível votar em propostas encerradas.
 * - Não é possível executar a mesma proposta duas vezes.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AcadGovernance is Ownable {

    IERC20 public immutable governanceToken;

    /// @dev Quórum mínimo de votos (em tokens-wei) para proposta ser válida
    uint256 public constant MINIMUM_QUORUM  = 1_000 * 1e18;

    /// @dev Período de votação: 3 dias
    uint256 public constant VOTING_PERIOD   = 3 days;

    /// @dev Mínimo de tokens para criar proposta
    uint256 public constant MIN_TOKENS_TO_PROPOSE = 100 * 1e18;

    /// @dev Contador de propostas (ID começa em 0)
    uint256 public proposalCount;

    // ─── Struct da Proposta ────────────────────────────────────────────────────
    struct Proposal {
        uint256 id;
        address proposer;
        string  description;
        uint256 voteFor;       // Soma dos pesos de votos SIM
        uint256 voteAgainst;   // Soma dos pesos de votos NÃO
        uint256 deadline;      // Timestamp de encerramento da votação
        bool    executed;
        bool    cancelled;
    }

    /// @dev ID → Proposta
    mapping(uint256 => Proposal) public proposals;

    /// @dev proposalId → voter → já votou?
    mapping(uint256 => mapping(address => bool))    public hasVoted;

    /// @dev proposalId → voter → peso do voto
    mapping(uint256 => mapping(address => uint256)) public votePower;

    // ─── Eventos ───────────────────────────────────────────────────────────────
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string  description,
        uint256 deadline
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool    support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId, bool approved);
    event ProposalCancelled(uint256 indexed proposalId);

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address _governanceToken, address _owner) Ownable(_owner) {
        require(_governanceToken != address(0), "Token de governanca invalido");
        governanceToken = IERC20(_governanceToken);
    }

    // ─── Funções principais ────────────────────────────────────────────────────

    /**
     * @notice Cria uma nova proposta de governança.
     * @dev Requer saldo mínimo de 100 ACAD para evitar spam.
     * @param description Texto descritivo da proposta (ex: "Adicionar novo curso de DeFi")
     * @return proposalId ID da proposta criada
     */
    function createProposal(string calldata description) external returns (uint256) {
        require(
            governanceToken.balanceOf(msg.sender) >= MIN_TOKENS_TO_PROPOSE,
            "Minimo de 100 ACAD para criar proposta"
        );
        require(bytes(description).length > 0, "Descricao nao pode ser vazia");

        uint256 proposalId = proposalCount++;
        uint256 deadline   = block.timestamp + VOTING_PERIOD;

        proposals[proposalId] = Proposal({
            id:          proposalId,
            proposer:    msg.sender,
            description: description,
            voteFor:     0,
            voteAgainst: 0,
            deadline:    deadline,
            executed:    false,
            cancelled:   false
        });

        emit ProposalCreated(proposalId, msg.sender, description, deadline);
        return proposalId;
    }

    /**
     * @notice Vota em uma proposta ativa.
     * @dev Peso do voto = saldo de ACAD no momento da chamada.
     *      Cada endereço pode votar apenas uma vez por proposta.
     * @param proposalId ID da proposta
     * @param support    true = SIM, false = NÃO
     */
    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposalCount, "Proposta nao existe");

        Proposal storage proposal = proposals[proposalId];

        require(block.timestamp <= proposal.deadline, "Periodo de votacao encerrado");
        require(!proposal.cancelled,                  "Proposta foi cancelada");
        require(!hasVoted[proposalId][msg.sender],    "Voce ja votou nesta proposta");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "Sem tokens ACAD para votar");

        hasVoted[proposalId][msg.sender]   = true;
        votePower[proposalId][msg.sender]  = weight;

        if (support) {
            proposal.voteFor     += weight;
        } else {
            proposal.voteAgainst += weight;
        }

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Executa a proposta após o período de votação.
     * @dev Pode ser chamado por qualquer um. Verifica quórum e resultado.
     * @param proposalId ID da proposta a executar
     */
    function execute(uint256 proposalId) external {
        require(proposalId < proposalCount, "Proposta nao existe");

        Proposal storage proposal = proposals[proposalId];

        require(block.timestamp > proposal.deadline, "Votacao ainda em andamento");
        require(!proposal.executed,                  "Proposta ja foi executada");
        require(!proposal.cancelled,                 "Proposta foi cancelada");
        require(
            proposal.voteFor + proposal.voteAgainst >= MINIMUM_QUORUM,
            "Quorum minimo nao atingido"
        );

        proposal.executed = true;
        bool approved = proposal.voteFor > proposal.voteAgainst;

        emit ProposalExecuted(proposalId, approved);
    }

    /**
     * @notice Cancela uma proposta antes de sua execução.
     * @dev Apenas o proponente ou o owner do contrato podem cancelar.
     */
    function cancelProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Proposta nao existe");

        Proposal storage proposal = proposals[proposalId];

        require(
            msg.sender == proposal.proposer || msg.sender == owner(),
            "Somente o proponente ou owner pode cancelar"
        );
        require(!proposal.executed,  "Nao e possivel cancelar proposta ja executada");
        require(!proposal.cancelled, "Proposta ja esta cancelada");

        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    // ─── Funções de leitura ────────────────────────────────────────────────────

    /**
     * @notice Retorna os dados completos de uma proposta.
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            string memory description,
            uint256 voteFor,
            uint256 voteAgainst,
            uint256 deadline,
            bool    executed,
            bool    cancelled
        )
    {
        require(proposalId < proposalCount, "Proposta nao existe");
        Proposal storage p = proposals[proposalId];
        return (p.proposer, p.description, p.voteFor, p.voteAgainst, p.deadline, p.executed, p.cancelled);
    }

    /**
     * @notice Retorna o status legível de uma proposta.
     */
    function getProposalStatus(uint256 proposalId) external view returns (string memory) {
        require(proposalId < proposalCount, "Proposta nao existe");
        Proposal storage p = proposals[proposalId];

        if (p.cancelled)                          return "Cancelada";
        if (block.timestamp <= p.deadline)        return "Em votacao";
        if (!p.executed)                          return "Aguardando execucao";
        return (p.voteFor > p.voteAgainst)        ? "Aprovada" : "Rejeitada";
    }
}
