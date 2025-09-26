// AVG AI Service - Integrates with existing LLM services for AVG story mode

import {
  AVGAIService,
  DialogueContext,
  AIResponse,
  StreamCallbacks,
  DialogueEntry,
  Choice,
} from '../types/avg';
import { streamChat, createAbortController } from './llm';

export class AVGAIServiceImpl implements AVGAIService {
  private abortController?: AbortController;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  /**
   * Generate a non-streaming response from AI
   */
  async generateResponse(
    context: DialogueContext,
    userInput: string
  ): Promise<AIResponse> {
    console.log('[AVG AI] Generate response for:', userInput);

    try {
      const messages = this.buildMessageHistory(context, userInput);
      let fullResponse = '';
      let error: Error | null = null;

      await streamChat({
        messages,
        onToken: (token) => {
          fullResponse += token;
        },
        onDone: () => {
          console.log('[AVG AI] Response generation complete');
        },
        onError: (err) => {
          error = err;
          console.error('[AVG AI] Error generating response:', err);
        },
      });

      if (error) {
        throw error;
      }

      // Parse response for choices if present
      const { response, choices } = this.parseAIResponse(fullResponse);

      return {
        response,
        choices,
        sceneUpdate: this.extractSceneUpdate(fullResponse, context),
      };
    } catch (error) {
      console.error('[AVG AI] Failed to generate response:', error);
      return this.getFallbackResponse(userInput, error as Error);
    }
  }

  /**
   * Stream response from AI with token-by-token delivery
   */
  async streamResponse(
    context: DialogueContext,
    userInput: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    console.log('[AVG AI] Stream response for:', userInput);

    // Cancel any existing stream
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = createAbortController();

    let retryCount = 0;
    let fullResponse = '';

    const attemptStream = async (): Promise<void> => {
      try {
        const messages = this.buildMessageHistory(context, userInput);
        fullResponse = '';

        await streamChat({
          messages,
          controller: this.abortController,
          onToken: (token) => {
            fullResponse += token;
            callbacks.onToken(token);
          },
          onDone: () => {
            console.log('[AVG AI] Streaming complete');
            callbacks.onComplete(fullResponse);
          },
          onError: (error) => {
            console.error('[AVG AI] Streaming error:', error);
            
            // Check if this is an abort (user cancelled)
            if (error?.name === 'AbortError') {
              return;
            }

            // Retry logic
            if (retryCount < this.maxRetries) {
              retryCount++;
              console.log(`[AVG AI] Retrying stream (${retryCount}/${this.maxRetries})`);
              setTimeout(() => attemptStream(), this.retryDelay * retryCount);
              return;
            }

            // Max retries exceeded, provide fallback
            const fallback = this.getFallbackResponse(userInput, error);
            callbacks.onToken(fallback.response);
            callbacks.onComplete(fallback.response);
          },
        });
      } catch (error) {
        console.error('[AVG AI] Stream attempt failed:', error);
        
        if (retryCount < this.maxRetries) {
          retryCount++;
          console.log(`[AVG AI] Retrying stream (${retryCount}/${this.maxRetries})`);
          setTimeout(() => attemptStream(), this.retryDelay * retryCount);
          return;
        }

        // Max retries exceeded
        const fallback = this.getFallbackResponse(userInput, error as Error);
        callbacks.onError(error as Error);
        callbacks.onToken(fallback.response);
        callbacks.onComplete(fallback.response);
      }
    };

    await attemptStream();
  }

  /**
   * Cancel any ongoing streaming operation
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }

  /**
   * Build message history for LLM from dialogue context
   */
  private buildMessageHistory(
    context: DialogueContext,
    userInput: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt with AVG context
    const systemPrompt = this.buildSystemPrompt(context);
    messages.push({ role: 'system', content: systemPrompt });

    // Add recent dialogue history (limit to last 10 exchanges to manage context length)
    const recentHistory = context.recentHistory.slice(-20); // Last 20 entries = ~10 exchanges
    
    for (const entry of recentHistory) {
      if (entry.type === 'user') {
        messages.push({ role: 'user', content: entry.text });
      } else if (entry.type === 'character') {
        messages.push({ role: 'assistant', content: entry.text });
      }
      // Skip system and narration messages in LLM context
    }

    // Add current user input
    messages.push({ role: 'user', content: userInput });

    return messages;
  }

  /**
   * Build comprehensive system prompt for AVG context
   */
  private buildSystemPrompt(context: DialogueContext): string {
    const { characterName, userName, systemPrompt, currentScene } = context;

    let prompt = systemPrompt || `You are ${characterName}, an AI character in an interactive visual novel story.`;
    
    prompt += `\n\nContext:
- You are speaking with ${userName}
- Character name: ${characterName}
- Current scene: ${currentScene.id}`;

    if (currentScene.character?.expression) {
      prompt += `\n- Current expression: ${currentScene.character.expression}`;
    }

    if (currentScene.ambientText) {
      prompt += `\n- Scene description: ${currentScene.ambientText}`;
    }

    prompt += `\n\nInstructions:
- Stay in character as ${characterName}
- Respond naturally and conversationally
- Keep responses concise but engaging (1-3 sentences typically)
- You can occasionally suggest choices for the user by ending with options like:
  [Choice 1: "Option text"] [Choice 2: "Another option"]
- Maintain the immersive story atmosphere
- Be helpful and engaging while staying true to your character`;

    return prompt;
  }

  /**
   * Parse AI response to extract choices if present
   */
  private parseAIResponse(response: string): { response: string; choices?: Choice[] } {
    // Look for choice patterns like [Choice 1: "text"] [Choice 2: "text"]
    const choiceRegex = /\[Choice\s+(\d+):\s*"([^"]+)"\]/g;
    const choices: Choice[] = [];
    let match;

    while ((match = choiceRegex.exec(response)) !== null) {
      choices.push({
        id: match[1],
        text: match[2],
        action: 'continue',
      });
    }

    // Remove choice markers from response text
    const cleanResponse = response.replace(choiceRegex, '').trim();

    return {
      response: cleanResponse,
      choices: choices.length > 0 ? choices : undefined,
    };
  }

  /**
   * Extract scene updates from AI response (future enhancement)
   */
  private extractSceneUpdate(response: string, context: DialogueContext): Partial<any> | undefined {
    // For V0, we don't implement scene updates
    // This is a placeholder for future story progression features
    return undefined;
  }

  /**
   * Provide fallback response when AI service fails
   */
  private getFallbackResponse(userInput: string, error: Error): AIResponse {
    console.warn('[AVG AI] Using fallback response due to error:', error.message);

    const fallbackResponses = [
      "抱歉，我现在有些困惑。能再说一遍吗？",
      "让我想想...你刚才说什么？",
      "网络似乎有些问题，请稍后再试。",
      "我需要一点时间来理解你的话。",
    ];

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    return {
      response: randomResponse,
      choices: [
        { id: 'retry', text: '重试', action: 'retry' },
        { id: 'continue', text: '继续', action: 'continue' },
      ],
    };
  }

  /**
   * Test connection to AI service
   */
  async testConnection(): Promise<boolean> {
    try {
      const testContext: DialogueContext = {
        characterName: 'Test',
        userName: 'User',
        systemPrompt: 'You are a test character.',
        recentHistory: [],
        currentScene: {
          id: 'test',
          backgroundImage: '',
        },
      };

      const response = await this.generateResponse(testContext, 'ping');
      return response.response.length > 0;
    } catch (error) {
      console.error('[AVG AI] Connection test failed:', error);
      return false;
    }
  }
}

export const avgAIService = new AVGAIServiceImpl();
