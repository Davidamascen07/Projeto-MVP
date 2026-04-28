// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title AcadToken (ACAD) — Token ERC-20 do protocolo acadêmico
 * @notice Token de governança e recompensa do ACAD Protocol.
 *         Utiliza a biblioteca OpenZeppelin para garantir segurança e padronização.
 *
 * PADRÃO ERC-20:
 * Define uma interface padrão para tokens fungíveis na Ethereum.
 * "Fungível" = cada unidade é idêntica e intercambiável (como dinheiro).
 * Garante compatibilidade com carteiras (MetaMask), DEXs (Uniswap) e outros protocolos.
 *
 * POR QUE OpenZeppelin?
 * Contratos auditados pela comunidade, amplamente utilizados em produção.
 * Reduz superfície de ataque ao reutilizar código provado e testado.
 *
 * CONTROLE DE ACESSO (AccessControl):
 * Usa roles (papéis) ao invés de Ownable simples.
 * MINTER_ROLE: permite criar novos tokens (mint) — atribuído ao Staking contract.
 * DEFAULT_ADMIN_ROLE: gerencia os papéis — atribuído ao deployer.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AcadToken is ERC20, ERC20Burnable, AccessControl {

    /// @dev Papel de mintador — concedido ao contrato de Staking
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @param initialOwner Endereço que recebe os papéis admin e minter inicialmente
     */
    constructor(address initialOwner) ERC20("AcadToken", "ACAD") {
        require(initialOwner != address(0), "Owner nao pode ser zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);

        // Mint inicial de 1.000.000 ACAD para o deployer
        // Esses tokens serão distribuídos para staking rewards e usuários iniciais
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Cria novos tokens e os envia para o endereço `to`.
     * @dev Apenas endereços com MINTER_ROLE podem chamar esta função.
     *      GAS: operação de escrita no storage (~50.000 gas).
     * @param to     Destinatário dos novos tokens
     * @param amount Quantidade a mintar (em wei, 18 decimais)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Mint para zero address nao permitido");
        _mint(to, amount);
    }
}
