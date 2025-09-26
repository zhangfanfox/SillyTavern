#!/usr/bin/env tsx

/**
 * Manual test script for AVG Save Manager
 * Run with: tsx scripts/test-avg-save-manager.ts
 */

import { AVGSaveManager } from '../src/services/avg-save-manager';
import { GameConfig, DEFAULT_SCENE } from '../src/types/avg';

// Mock the dependencies for testing
const mockFileSystem = {
  documentDirectory: '/tmp/test-st-mobile/',
  makeDirectoryAsync: async () => {},
  writeAsStringAsync: async () => {},
  readAsStringAsync: async () => {
    throw new Error('File not found');
  },
  deleteAsync: async () => {},
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({ exists: false }),
  EncodingType: { UTF8: 'utf8' },
};

const mockAsyncStorage = {
  setItem: async () => {},
  getItem: async () => null,
  removeItem: async () => {},
};

// Mock the modules
jest.mock('expo-file-system/legacy', () => mockFileSystem);
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

async function testSaveManager() {
  console.log('🧪 Testing AVG Save Manager...\n');

  const saveManager = AVGSaveManager.getInstance();
  const testSessionId = 'test-session-' + Date.now();

  const mockGameState = {
    gameConfig: {
      sessionId: testSessionId,
      characterName: 'Test Character',
      userName: 'Test User',
      initialScene: 'default',
      systemPrompt: 'You are a test character.',
    } as GameConfig,
    currentScene: DEFAULT_SCENE,
    dialogueHistory: [
      {
        id: 'test-dialogue-1',
        timestamp: Date.now(),
        speaker: 'Test Character',
        text: 'Hello, this is a test dialogue!',
        type: 'character' as const,
        sceneId: 'default',
      },
    ],
  };

  try {
    // Test 1: Save game
    console.log('📝 Test 1: Saving game...');
    const saveResult = await saveManager.saveGame(testSessionId, mockGameState);
    console.log('Save result:', saveResult);
    
    if (saveResult.success) {
      console.log('✅ Save test passed');
    } else {
      console.log('❌ Save test failed:', saveResult.error);
    }

    // Test 2: Check if save exists
    console.log('\n🔍 Test 2: Checking if save exists...');
    const exists = await saveManager.saveExists(testSessionId);
    console.log('Save exists:', exists);

    // Test 3: Load game
    console.log('\n📖 Test 3: Loading game...');
    const loadResult = await saveManager.loadGame(testSessionId);
    console.log('Load result:', loadResult.success ? 'Success' : 'Failed');
    
    if (loadResult.success && loadResult.data) {
      console.log('✅ Load test passed');
      console.log('Loaded data preview:', {
        id: loadResult.data.id,
        title: loadResult.data.title,
        characterName: loadResult.data.gameConfig.characterName,
        dialogueCount: loadResult.data.dialogueHistory.length,
      });
    } else {
      console.log('❌ Load test failed:', loadResult.error);
    }

    // Test 4: Get save metadata
    console.log('\n📋 Test 4: Getting save metadata...');
    const metadataResult = await saveManager.getSaveMetadata(testSessionId);
    console.log('Metadata result:', metadataResult.success ? 'Success' : 'Failed');

    // Test 5: List saves
    console.log('\n📚 Test 5: Listing saves...');
    const listResult = await saveManager.listSaves();
    console.log('List result:', listResult.success ? `Found ${listResult.saves?.length || 0} saves` : 'Failed');

    // Test 6: Delete save
    console.log('\n🗑️ Test 6: Deleting save...');
    const deleteResult = await saveManager.deleteGame(testSessionId);
    console.log('Delete result:', deleteResult);
    
    if (deleteResult.success) {
      console.log('✅ Delete test passed');
    } else {
      console.log('❌ Delete test failed:', deleteResult.error);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Test validation functions
function testValidation() {
  console.log('\n🔍 Testing validation functions...\n');

  const saveManager = AVGSaveManager.getInstance();
  
  // Test invalid game state
  console.log('Testing invalid game state validation...');
  const invalidState = {
    gameConfig: undefined,
    currentScene: undefined,
  };

  saveManager.saveGame('invalid-test', invalidState).then(result => {
    if (!result.success && result.error?.type === 'validation') {
      console.log('✅ Validation test passed - correctly rejected invalid state');
    } else {
      console.log('❌ Validation test failed - should have rejected invalid state');
    }
  });
}

if (require.main === module) {
  testSaveManager().then(() => {
    testValidation();
  });
}

export { testSaveManager, testValidation };