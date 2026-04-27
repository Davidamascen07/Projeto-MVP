// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AcademicCertificate (CERT) — NFT ERC-721 de certificados acadêmicos
 * @notice Cada NFT representa um certificado de conclusão único e não-fungível.
 *
 * PADRÃO ERC-721 (NFT — Non-Fungible Token):
 * Diferente do ERC-20, cada token ERC-721 é único — possui um ID exclusivo.
 * Utilizado para representar: obras de arte, certificados, títulos de propriedade, etc.
 * No protocolo ACAD: professores/admin mintam certificados NFT para alunos formados.
 *
 * ERC721URIStorage:
 * Extensão que permite associar uma URI (ex: IPFS) a cada tokenId.
 * A URI aponta para um JSON com metadados do certificado (nome, curso, data, nota, etc.).
 * Exemplo: ipfs://QmXXX.../certificate.json
 *
 * CONTROLE DE ACESSO:
 * Apenas endereços com MINTER_ROLE podem emitir certificados (professores/admin).
 * Evita que alunos criem certificados falsos.
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AcademicCertificate is ERC721, ERC721URIStorage, AccessControl {

    /// @dev Papel de mintador — concedido a professores e administradores
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Contador de tokenIds (começa em 0, incrementa a cada mint)
    uint256 private _tokenIdCounter;

    /// @dev Emitido quando um novo certificado NFT é criado
    event CertificateMinted(
        address indexed to,
        uint256 indexed tokenId,
        string tokenURI
    );

    /**
     * @param initialOwner Endereço que recebe os papéis admin e minter inicialmente
     */
    constructor(address initialOwner) ERC721("AcademicCertificate", "CERT") {
        require(initialOwner != address(0), "Owner nao pode ser zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
    }

    /**
     * @notice Minta um novo certificado NFT para o endereço `to`.
     * @dev Apenas MINTER_ROLE. Armazena a URI de metadados no storage.
     *      GAS: safeMint + setTokenURI = ~100.000 gas.
     * @param to  Endereço do aluno que receberá o certificado
     * @param uri URI dos metadados (ex: ipfs://QmXXX/certificado.json)
     * @return tokenId ID único do NFT criado
     */
    function mintCertificate(address to, string memory uri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        require(to != address(0), "Destinatario nao pode ser zero address");
        require(bytes(uri).length > 0, "URI nao pode ser vazia");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit CertificateMinted(to, tokenId, uri);
        return tokenId;
    }

    /// @notice Retorna o número total de certificados emitidos
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ─── Overrides obrigatórios pelo Solidity para herança múltipla ───────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
