// Core AVG Types and Interfaces

export interface Position {
  x: number;
  y: number;
  scale?: number;
}

export interface SceneData {
  id: string;
  backgroundImage: string;
  character?: {
    name: string;
    image: string;
    position: Position;
    expression?: string;
  };
  ambientText?: string;
}

export interface DialogueEntry {
  id: string;
  timestamp: number;
  speaker: string;
  text: string;
  type: 'user' | 'character' | 'system' | 'narration';
  sceneId?: string;
}

export interface Choice {
  id: string;
  text: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface GameConfig {
  sessionId: string;
  characterName: string;
  userName: string;
  initialScene: string;
  systemPrompt?: string;
}

export interface GameSave {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  gameConfig: GameConfig;
  currentScene: SceneData;
  dialogueHistory: DialogueEntry[];
  gameVariables: Record<string, any>;
}

// Canvas Renderer Interface
export interface CanvasRenderer {
  loadBackground(imagePath: string): Promise<void>;
  loadCharacter(imagePath: string, position: Position): Promise<void>;
  updateCharacter(position: Position, expression?: string): void;
  clearCanvas(): void;
  resize(width: number, height: number): void;
}

// Game Engine Interface
export interface GameEngine {
  // Game state management
  initializeGame(config: GameConfig): Promise<void>;
  loadScene(sceneId: string): Promise<void>;
  
  // Dialogue system
  processUserInput(input: string): Promise<AIResponse>;
  generateChoices(context: DialogueContext): Promise<Choice[]>;
  
  // Rendering control
  updateVisuals(scene: SceneData): void;
  playDialogue(text: string, character: string): void;
}

// AI Service Interfaces
export interface DialogueContext {
  characterName: string;
  userName: string;
  systemPrompt: string;
  recentHistory: DialogueEntry[];
  currentScene: SceneData;
}

export interface AIResponse {
  response: string;
  choices?: Choice[];
  sceneUpdate?: Partial<SceneData>;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface AVGAIService {
  generateResponse(
    context: DialogueContext,
    userInput: string
  ): Promise<AIResponse>;
  
  streamResponse(
    context: DialogueContext,
    userInput: string,
    callbacks: StreamCallbacks
  ): Promise<void>;
}

// Component Props Interfaces
export interface AVGCanvasProps {
  backgroundImage: string;
  characterImage?: string;
  characterPosition?: Position;
  onCanvasReady: () => void;
}

export interface AVGDialogueBoxProps {
  speaker: string;
  text: string;
  isStreaming: boolean;
  onComplete?: () => void;
}

export interface AVGChoicePanelProps {
  choices: Choice[];
  onChoiceSelect: (choice: Choice) => void;
  visible: boolean;
}

export interface AVGInputPanelProps {
  visible: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

// Store State Interface
export interface AVGState {
  // Game state
  currentSession?: string;
  currentScene: SceneData;
  dialogueHistory: DialogueEntry[];
  gameConfig?: GameConfig;
  
  // UI state
  isDialogueActive: boolean;
  isChoicePanelVisible: boolean;
  isInputPanelVisible: boolean;
  
  // Streaming state
  streamingText: string;
  isStreaming: boolean;
  
  // Actions
  initializeGame: (config: GameConfig) => Promise<void>;
  setScene: (scene: SceneData) => void;
  addDialogue: (entry: DialogueEntry) => void;
  setStreamingText: (text: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setChoicePanelVisible: (visible: boolean) => void;
  setInputPanelVisible: (visible: boolean) => void;
  saveGameState: () => Promise<void>;
  loadGameState: (sessionId: string) => Promise<void>;
  clearSession: () => void;
}

// Default configurations
export const DEFAULT_SCENE: SceneData = {
  id: 'default',
  backgroundImage: 'assets/avg/backgrounds/default.png',
  character: {
    name: 'Assistant',
    image: 'assets/avg/characters/default/neutral.png',
    position: { x: 0.5, y: 0.5, scale: 1.0 },
    expression: 'neutral',
  },
};

export const DEFAULT_GAME_CONFIG: Partial<GameConfig> = {
  characterName: 'Assistant',
  userName: 'User',
  initialScene: 'default',
  systemPrompt: 'You are a helpful AI assistant in an interactive story. Respond naturally and stay in character.',
};