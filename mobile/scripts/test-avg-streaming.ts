#!/usr/bin/env npx tsx

// Test script for AVG streaming functionality

// Mock React Native dependencies
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const mockExpoFileSystem = {
  documentDirectory: '/mock/documents/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
};

// Mock modules before importing
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-file-system/legacy', () => mockExpoFileSystem);
jest.mock('zustand', () => ({
  create: (fn: any) => fn(() => {}, () => ({})),
}));
jest.mock('zustand/middleware', () => ({
  persist: (fn: any) => fn,
  createJSONStorage: () => ({}),
}));

import { avgAIService } from '../src/services/avg-ai';
import { avgAIService } from '../src/services/avg-ai';
import { avgAIService } from '../src/services/avg-ai';
import { avgStreamingService } from '../src/services/avg-streaming';
import { avgStreamingService } from '../src/services/avg-streaming';
import { avgAIService } from '../src/services/avg-ai';
import { avgStreamingService } from '../src/services/avg-streaming';
import { DialogueContext, StreamCallbacks } from '../src/types/avg';

async function testStreamingService() {
  console.log('🧪 Testing AVG Streaming Service...\n');

  // Test context
  const context: DialogueContext = {
    characterName: 'Test Character',
    userName: 'Test User',
    systemPrompt: 'You are a helpful test character.',
    recentHistory: [],
    currentScene: {
      id: 'test-scene',
      backgroundImage: 'test.png',
    },
  };

  console.log('📝 Test Context:', JSON.stringify(context, null, 2));

  // Test streaming callbacks
  let streamedText = '';
  let isComplete = false;
  let hasError = false;

  const callbacks: StreamCallbacks = {
    onToken: (token: string) => {
      streamedText += token;
      process.stdout.write(token);
    },
    onComplete: (fullText: string) => {
      console.log('\n\n✅ Streaming completed!');
      console.log('📄 Full text:', fullText);
      isComplete = true;
    },
    onError: (error: Error) => {
      console.error('\n❌ Streaming error:', error.message);
      hasError = true;
    },
  };

  // Test streaming state management
  console.log('\n🔄 Starting streaming state test...');
  
  avgStreamingService.startStreaming(callbacks, (state) => {
    console.log(`📊 State update: streaming=${state.isStreaming}, text length=${state.currentText.length}`);
  });

  // Simulate streaming
  console.log('\n💬 Simulating AI response streaming...');
  
  try {
    await avgAIService.streamResponse(context, 'Hello, test!', callbacks);
    
    // Wait for completion
    let timeout = 0;
    while (!isComplete && !hasError && timeout < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      timeout++;
    }

    if (isComplete) {
      console.log('\n🎉 Streaming test completed successfully!');
      console.log(`📊 Final streamed text length: ${streamedText.length}`);
    } else if (hasError) {
      console.log('\n⚠️ Streaming test completed with errors');
    } else {
      console.log('\n⏰ Streaming test timed out');
    }

  } catch (error) {
    console.error('\n💥 Test failed with exception:', error);
  }

  // Test interruption
  console.log('\n🛑 Testing stream interruption...');
  
  avgStreamingService.startStreaming(callbacks, (state) => {
    console.log(`📊 Interrupt test state: streaming=${state.isStreaming}`);
  });

  // Start another stream and immediately interrupt
  setTimeout(() => {
    const interrupted = avgStreamingService.interruptStreaming();
    console.log(`🛑 Interruption result: ${interrupted}`);
  }, 100);

  await avgAIService.streamResponse(context, 'This should be interrupted', callbacks);

  console.log('\n✨ All streaming tests completed!');
}

async function testAIServiceIntegration() {
  console.log('\n🤖 Testing AI Service Integration...\n');

  const context: DialogueContext = {
    characterName: 'Assistant',
    userName: 'User',
    systemPrompt: 'You are a helpful AI assistant in a visual novel.',
    recentHistory: [
      {
        id: '1',
        timestamp: Date.now() - 10000,
        speaker: 'User',
        text: 'Hello!',
        type: 'user',
      },
      {
        id: '2',
        timestamp: Date.now() - 5000,
        speaker: 'Assistant',
        text: 'Hello! How can I help you today?',
        type: 'character',
      },
    ],
    currentScene: {
      id: 'main-scene',
      backgroundImage: 'main.png',
      character: {
        name: 'Assistant',
        image: 'assistant.png',
        position: { x: 0.5, y: 0.5 },
      },
    },
  };

  try {
    // Test non-streaming response
    console.log('📤 Testing non-streaming response...');
    const response = await avgAIService.generateResponse(context, 'Tell me a short story.');
    console.log('📥 Response:', response.response);
    if (response.choices) {
      console.log('🎯 Choices:', response.choices.map(c => c.text));
    }

    // Test connection
    console.log('\n🔗 Testing AI service connection...');
    const connectionOk = await avgAIService.testConnection();
    console.log(`🔗 Connection status: ${connectionOk ? '✅ OK' : '❌ Failed'}`);

  } catch (error) {
    console.error('💥 AI service test failed:', error);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting AVG Streaming Tests\n');
  console.log('=' .repeat(50));
  
  await testAIServiceIntegration();
  console.log('\n' + '=' .repeat(50));
  
  await testStreamingService();
  console.log('\n' + '=' .repeat(50));
  
  console.log('\n🏁 All tests completed!');
}

if (require.main === module) {
  runTests().catch(console.error);
}