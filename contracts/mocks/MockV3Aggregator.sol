// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockV3Aggregator — Simulação do feed de preço Chainlink para testes
 * @dev Usado APENAS em ambiente de testes (hardhat/localhost).
 *      Permite controlar o preço ETH/USD manualmente nos testes.
 *      Nunca deve ser deployado em produção (mainnet/testnet).
 */
contract MockV3Aggregator {
    uint8  public decimals;
    int256 public latestAnswer;
    uint80 private _roundId;

    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals     = _decimals;
        latestAnswer = _initialAnswer;
        _roundId     = 1;
    }

    /// @notice Atualiza o preço simulado (apenas em testes)
    function updateAnswer(int256 _answer) external {
        latestAnswer = _answer;
        _roundId++;
        emit AnswerUpdated(_answer, _roundId, block.timestamp);
    }

    /// @notice Retorna dados do último round — compatível com AggregatorV3Interface
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, latestAnswer, block.timestamp, block.timestamp, _roundId);
    }
}
