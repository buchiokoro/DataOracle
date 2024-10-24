import { describe, expect, test, beforeEach } from 'vitest';
import {
  Client,
  Provider,
  ProviderRegistry,
  Receipt,
  Result,
  Transaction
} from '@stacks/transactions';
import {
  standardPrincipalCV,
  uintCV,
  stringUtf8CV,
  trueCV,
  falseCV
} from '@stacks/transactions/dist/clarity/types/principalCV';

// Mock client setup
const mockClient = new Client("http://localhost:20443");
const CONTRACT_NAME = "data-oracle";
const CONTRACT_ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

// Test accounts
const DEPLOYER = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const ORACLE_PROVIDER = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
const SUBSCRIBER = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";

describe('Data Oracle Contract Tests', () => {
  let provider: Provider;
  
  beforeEach(async () => {
    // Reset blockchain state before each test
    provider = await ProviderRegistry.createProvider();
    await mockClient.connect(provider);
  });
  
  describe('Subscription Management', () => {
    test('should allow users to subscribe with valid payment', async () => {
      // Arrange
      const subscriptionType = stringUtf8CV("premium");
      const subscriptionFee = uintCV(100);
      
      // Act
      const txOptions = {
        senderKey: SUBSCRIBER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'subscribe',
        functionArgs: [subscriptionType],
        fee: 1000,
        nonce: 0,
        network: provider.network,
      };
      
      const transaction = await makeContractCall(txOptions);
      const receipt = await broadcastTransaction(transaction, provider);
      
      // Assert
      expect(receipt.success).toBe(true);
      
      // Verify subscription state
      const subscriptionResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-subscription',
        functionArgs: [standardPrincipalCV(SUBSCRIBER)],
        senderAddress: SUBSCRIBER,
      });
      
      const subscription = Result.unwrap(subscriptionResult);
      expect(subscription.active).toBe(true);
      expect(subscription['subscription-type']).toBe('premium');
    });
    
    test('should reject subscription with insufficient payment', async () => {
      // Arrange
      const subscriptionType = stringUtf8CV("premium");
      const lowFee = uintCV(50); // Less than required
      
      // Act & Assert
      await expect(
          makeContractCall({
            senderKey: SUBSCRIBER,
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'subscribe',
            functionArgs: [subscriptionType],
            fee: lowFee,
            nonce: 0,
            network: provider.network,
          })
      ).rejects.toThrow(/ERR_INSUFFICIENT_PAYMENT/);
    });
  });
  
  describe('Oracle Management', () => {
    test('should register new oracle with sufficient stake', async () => {
      // Arrange
      const dataType = stringUtf8CV("weather");
      const stake = uintCV(10000);
      
      // Act
      const txOptions = {
        senderKey: ORACLE_PROVIDER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'register-oracle',
        functionArgs: [dataType],
        fee: 1000,
        nonce: 0,
        network: provider.network,
      };
      
      const transaction = await makeContractCall(txOptions);
      const receipt = await broadcastTransaction(transaction, provider);
      
      // Assert
      expect(receipt.success).toBe(true);
      
      // Verify oracle registration
      const oracleResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-oracle',
        functionArgs: [uintCV(1)], // First oracle ID
        senderAddress: ORACLE_PROVIDER,
      });
      
      const oracle = Result.unwrap(oracleResult);
      expect(oracle.provider).toBe(ORACLE_PROVIDER);
      expect(oracle['data-type']).toBe('weather');
      expect(oracle.active).toBe(false);
      expect(oracle.votes).toBe(0);
    });
    
    test('should allow data submission from registered oracle', async () => {
      // Arrange
      const oracleId = uintCV(1);
      const dataValue = stringUtf8CV("72.5"); // Temperature value
      
      // First register the oracle
      await makeContractCall({
        senderKey: ORACLE_PROVIDER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'register-oracle',
        functionArgs: [stringUtf8CV("weather")],
        fee: 1000,
        nonce: 0,
        network: provider.network,
      });
      
      // Act
      const txOptions = {
        senderKey: ORACLE_PROVIDER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'submit-data',
        functionArgs: [oracleId, dataValue],
        fee: 1000,
        nonce: 1,
        network: provider.network,
      };
      
      const transaction = await makeContractCall(txOptions);
      const receipt = await broadcastTransaction(transaction, provider);
      
      // Assert
      expect(receipt.success).toBe(true);
      
      // Verify submitted data
      const dataResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-latest-data',
        functionArgs: [oracleId],
        senderAddress: ORACLE_PROVIDER,
      });
      
      const data = Result.unwrap(dataResult);
      expect(data.value).toBe('72.5');
      expect(data.provider).toBe(ORACLE_PROVIDER);
      expect(data.verified).toBe(false);
    });
  });
  
  describe('Voting System', () => {
    test('should allow subscribers to vote for oracles', async () => {
      // Arrange
      // 1. Create subscription
      await makeContractCall({
        senderKey: SUBSCRIBER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'subscribe',
        functionArgs: [stringUtf8CV("premium")],
        fee: 1000,
        nonce: 0,
        network: provider.network,
      });
      
      // 2. Register oracle
      await makeContractCall({
        senderKey: ORACLE_PROVIDER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'register-oracle',
        functionArgs: [stringUtf8CV("weather")],
        fee: 1000,
        nonce: 0,
        network: provider.network,
      });
      
      // Act
      const txOptions = {
        senderKey: SUBSCRIBER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'vote-oracle',
        functionArgs: [uintCV(1)], // First oracle ID
        fee: 1000,
        nonce: 1,
        network: provider.network,
      };
      
      const transaction = await makeContractCall(txOptions);
      const receipt = await broadcastTransaction(transaction, provider);
      
      // Assert
      expect(receipt.success).toBe(true);
      
      // Verify vote count
      const oracleResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-oracle',
        functionArgs: [uintCV(1)],
        senderAddress: SUBSCRIBER,
      });
      
      const oracle = Result.unwrap(oracleResult);
      expect(oracle.votes).toBe(1);
    });
    
    test('should not allow non-subscribers to vote', async () => {
      // Arrange
      const oracleId = uintCV(1);
      const nonSubscriber = "ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ";
      
      // Act & Assert
      await expect(
          makeContractCall({
            senderKey: nonSubscriber,
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'vote-oracle',
            functionArgs: [oracleId],
            fee: 1000,
            nonce: 0,
            network: provider.network,
          })
      ).rejects.toThrow(/ERR_INVALID_SUBSCRIPTION/);
    });
  });
  
  describe('Admin Functions', () => {
    test('should allow owner to update subscription fee', async () => {
      // Arrange
      const newFee = uintCV(200);
      
      // Act
      const txOptions = {
        senderKey: DEPLOYER,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'set-subscription-fee',
        functionArgs: [newFee],
        fee: 1000,
        nonce: 0,
        network: provider.network,
      };
      
      const transaction = await makeContractCall(txOptions);
      const receipt = await broadcastTransaction(transaction, provider);
      
      // Assert
      expect(receipt.success).toBe(true);
      
      // Verify new fee
      const subscriptionFee = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-subscription-fee',
        functionArgs: [],
        senderAddress: DEPLOYER,
      });
      
      expect(Result.unwrap(subscriptionFee)).toBe(200);
    });
    
    test('should reject fee updates from non-owner', async () => {
      // Arrange
      const newFee = uintCV(200);
      const nonOwner = "ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ";
      
      // Act & Assert
      await expect(
          makeContractCall({
            senderKey: nonOwner,
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'set-subscription-fee',
            functionArgs: [newFee],
            fee: 1000,
            nonce: 0,
            network: provider.network,
          })
      ).rejects.toThrow(/ERR_UNAUTHORIZED/);
    });
  });
});
