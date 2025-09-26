// Unit tests for AVG streaming functionality

import { avgStreamingService } from '../src/services/avg-streaming';
import { avgAIService } from '../src/services/avg-ai';
import { StreamCallbacks, DialogueContext } from '../src/types/avg';

// Mock the LLM service
jest.mock('../src/services/llm', () => ({
  streamChat: jest.fn(),
  createAbortController: jest.fn(() => ({
    abort: jest.fn(),
    signal: { addEventListener: jest.fn() },
  })),
}));

describe('AVG Streaming Service', () => {
  beforeEach(() => {
    // Reset service state
    avgStreamingService.stopStreaming();
  });

  test('should start streaming session', () => {
    const callbacks: StreamCallbacks = {
      onToken: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    const onStateChange = jest.fn();

    avgStreamingService.startStreaming(callbacks, onStateChange);

    expect(avgStreamingService.isStreaming()).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        isStreaming: true,
        currentText: '',
        fullText: '',
        canInterrupt: true,
      })
    );
  });

  test('should stop streaming session', () => {
    const callbacks: StreamCallbacks = {
      onToken: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    const onStateChange = jest.fn();

    avgStreamingService.startStreaming(callbacks, onStateChange);
    avgStreamingService.stopStreaming();

    expect(avgStreamingService.isStreaming()).toBe(false);
  });

  test('should interrupt streaming', () => {
    const callbacks: StreamCallbacks = {
      onToken: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    const onStateChange = jest.fn();

    avgStreamingService.startStreaming(callbacks, onStateChange);
    const interrupted = avgStreamingService.interruptStreaming();

    expect(interrupted).toBe(true);
    expect(avgStreamingService.isStreaming()).toBe(false);
    expect(callbacks.onComplete).toHaveBeenCalled();
  });

  test('should handle token updates', () => {
    const callbacks: StreamCallbacks = {
      onToken: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    const onStateChange = jest.fn();

    avgStreamingService.startStreaming(callbacks, onStateChange);

    // Simulate token updates
    const currentStream = (avgStreamingService as any).currentStream;
    currentStream.callbacks.onToken('Hello');
    currentStream.callbacks.onToken(' world');

    expect(callbacks.onToken).toHaveBeenCalledWith('Hello');
    expect(callbacks.onToken).toHaveBeenCalledWith(' world');
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        currentText: 'Hello world',
        fullText: 'Hello world',
      })
    );
  });
});

describe('AVG AI Service', () => {
  const mockContext: DialogueContext = {
    characterName: 'Test Character',
    userName: 'Test User',
    systemPrompt: 'Test prompt',
    recentHistory: [],
    currentScene: {
      id: 'test',
      backgroundImage: 'test.png',
    },
  };

  test('should build system prompt correctly', () => {
    const service = new (avgAIService.constructor as any)();
    const prompt = service.buildSystemPrompt(mockContext);

    expect(prompt).toContain('Test Character');
    expect(prompt).toContain('Test User');
    expect(prompt).toContain('Test prompt');
    expect(prompt).toContain('test');
  });

  test('should parse AI response with choices', () => {
    const service = new (avgAIService.constructor as any)();
    const response = 'Hello there! [Choice 1: "Say hello back"] [Choice 2: "Ask a question"]';
    
    const parsed = service.parseAIResponse(response);

    expect(parsed.response).toBe('Hello there!');
    expect(parsed.choices).toHaveLength(2);
    expect(parsed.choices[0].text).toBe('Say hello back');
    expect(parsed.choices[1].text).toBe('Ask a question');
  });

  test('should parse AI response without choices', () => {
    const service = new (avgAIService.constructor as any)();
    const response = 'Just a regular response without choices.';
    
    const parsed = service.parseAIResponse(response);

    expect(parsed.response).toBe('Just a regular response without choices.');
    expect(parsed.choices).toBeUndefined();
  });

  test('should provide fallback response on error', () => {
    const service = new (avgAIService.constructor as any)();
    const error = new Error('Test error');
    
    const fallback = service.getFallbackResponse('test input', error);

    expect(fallback.response).toBeTruthy();
    expect(fallback.choices).toHaveLength(2);
    expect(fallback.choices.some((c: any) => c.action === 'retry')).toBe(true);
  });

  test('should build message history correctly', () => {
    const service = new (avgAIService.constructor as any)();
    const contextWithHistory: DialogueContext = {
      ...mockContext,
      recentHistory: [
        {
          id: '1',
          timestamp: Date.now(),
          speaker: 'Test User',
          text: 'Hello',
          type: 'user',
        },
        {
          id: '2',
          timestamp: Date.now(),
          speaker: 'Test Character',
          text: 'Hi there!',
          type: 'character',
        },
      ],
    };

    const messages = service.buildMessageHistory(contextWithHistory, 'How are you?');

    expect(messages).toHaveLength(4); // system + 2 history + current input
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Hello');
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toBe('Hi there!');
    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toBe('How are you?');
  });
});

describe('Integration Tests', () => {
  test('should handle streaming workflow', async () => {
    const mockStreamChat = require('../src/services/llm').streamChat as jest.Mock;
    
    // Mock successful streaming
    mockStreamChat.mockImplementation(async ({ onToken, onDone }) => {
      const response = 'Hello from AI!';
      for (const char of response) {
        onToken(char);
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      onDone();
    });

    const context: DialogueContext = {
      characterName: 'Test',
      userName: 'User',
      systemPrompt: 'Test',
      recentHistory: [],
      currentScene: { id: 'test', backgroundImage: 'test.png' },
    };

    let streamedText = '';
    let completed = false;

    const callbacks: StreamCallbacks = {
      onToken: (token) => { streamedText += token; },
      onComplete: () => { completed = true; },
      onError: jest.fn(),
    };

    await avgAIService.streamResponse(context, 'test input', callbacks);

    expect(streamedText).toBe('Hello from AI!');
    expect(completed).toBe(true);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  test('should handle streaming errors with retry', async () => {
    const mockStreamChat = require('../src/services/llm').streamChat as jest.Mock;
    
    // Mock error on first call, success on retry
    let callCount = 0;
    mockStreamChat.mockImplementation(async ({ onError, onToken, onDone }) => {
      callCount++;
      if (callCount === 1) {
        onError(new Error('Network error'));
      } else {
        onToken('Retry success!');
        onDone();
      }
    });

    const context: DialogueContext = {
      characterName: 'Test',
      userName: 'User',
      systemPrompt: 'Test',
      recentHistory: [],
      currentScene: { id: 'test', backgroundImage: 'test.png' },
    };

    let finalText = '';
    const callbacks: StreamCallbacks = {
      onToken: (token) => { finalText += token; },
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    await avgAIService.streamResponse(context, 'test input', callbacks);

    // Should eventually succeed after retry
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    expect(callCount).toBeGreaterThan(1);
  });
});