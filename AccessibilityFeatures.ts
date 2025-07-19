import { World, Player, Audio } from 'hytopia';

/**
 * Accessibility Configuration Options
 */
export interface AccessibilityOptions {
  // Visual Accessibility
  colorBlindFriendly: boolean;
  highContrast: boolean;
  textSize: 'small' | 'medium' | 'large' | 'extra-large';
  reducedMotion: boolean;
  flashReduction: boolean;
  
  // Audio Accessibility
  audioDescriptions: boolean;
  soundVolume: number; // 0.0 to 1.0
  musicVolume: number; // 0.0 to 1.0
  audioCues: boolean;
  
  // Motor Accessibility
  oneHandedMode: boolean;
  autoAnswer: boolean;
  extendedTimeouts: boolean;
  simplifiedControls: boolean;
  
  // Cognitive Accessibility
  slowGameMode: boolean;
  visualFeedback: boolean;
  hapticFeedback: boolean;
  repetitionMode: boolean;
}

/**
 * Color Palette for Colorblind Support
 */
interface ColorBlindPalette {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  text: string;
}

/**
 * Audio Cue Types
 */
export enum AudioCueType {
  CORRECT_ANSWER = 'correct_answer',
  WRONG_ANSWER = 'wrong_answer',
  NEW_QUESTION = 'new_question',
  GAME_START = 'game_start',
  GAME_END = 'game_end',
  POWER_UP_COLLECTED = 'power_up_collected',
  WARNING = 'warning',
  NAVIGATION = 'navigation',
  BUTTON_PRESS = 'button_press',
  SUCCESS = 'success'
}

/**
 * Text-to-Speech Utterance Queue
 */
interface TTSUtterance {
  text: string;
  priority: 'low' | 'medium' | 'high';
  interrupt: boolean;
}

/**
 * Accessibility Features System
 * Provides comprehensive accessibility support for various disabilities
 */
export class AccessibilityFeatures {
  private static _instance: AccessibilityFeatures;
  private _world: World | undefined;
  private _options: AccessibilityOptions;
  private _speechSynthesis: SpeechSynthesis | undefined;
  private _currentVoice: SpeechSynthesisVoice | undefined;
  private _ttsQueue: TTSUtterance[] = [];
  private _isSpeaking: boolean = false;
  
  // Audio system
  private _audioCues: Map<AudioCueType, Audio> = new Map();
  private _audioContext: AudioContext | undefined;
  
  // Visual systems
  private _originalColors: Map<string, string> = new Map();
  private _colorBlindPalettes: Map<string, ColorBlindPalette> = new Map();
  
  // Timing adjustments
  private _timeMultiplier: number = 1.0;
  
  // UI Elements cache
  private _uiElements: Map<string, HTMLElement> = new Map();

  public static get instance(): AccessibilityFeatures {
    if (!this._instance) {
      this._instance = new AccessibilityFeatures();
    }
    return this._instance;
  }

  private constructor() {
    this._options = this._getDefaultOptions();
    this._initializeSpeechSynthesis();
    this._setupColorBlindPalettes();
    this._loadUserPreferences();
  }

  /**
   * Initialize the accessibility system
   */
  public initialize(world: World): void {
    try {
      if (!world) {
        throw new Error('World instance is required for AccessibilityFeatures');
      }

      this._world = world;
      this._setupAudioCues();
      this._setupEventListeners();
      
      // Only apply UI settings in browser environment
      if (typeof document !== 'undefined') {
        this._applyAccessibilitySettings();
        this._setupKeyboardNavigation();
      }
      
      console.log('[AccessibilityFeatures] Initialized successfully');
      this._announceAccessibilityStatus();
    } catch (error) {
      console.error('[AccessibilityFeatures] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Update accessibility options
   */
  public updateOptions(newOptions: Partial<AccessibilityOptions>): void {
    const oldOptions = { ...this._options };
    this._options = { ...this._options, ...newOptions };
    
    this._applyAccessibilitySettings();
    this._saveUserPreferences();
    
    // Announce changes
    this._announceSettingsChange(oldOptions, this._options);
    
    console.log('[AccessibilityFeatures] Options updated:', this._options);
  }

  /**
   * Get current accessibility options
   */
  public getOptions(): AccessibilityOptions {
    return { ...this._options };
  }

  /**
   * Play audio cue for specific event
   */
  public playAudioCue(type: AudioCueType, volume?: number): void {
    if (!this._options.audioCues || !this._world) return;

    const audioCue = this._audioCues.get(type);
    if (audioCue) {
      if (volume !== undefined) {
        audioCue.setVolume(volume * this._options.soundVolume);
      } else {
        audioCue.setVolume(this._options.soundVolume);
      }
      
      audioCue.play(this._world, true);
      console.log(`[AccessibilityFeatures] Played audio cue: ${type}`);
    }
  }

  /**
   * Announce text using text-to-speech
   */
  public announce(text: string, priority: 'low' | 'medium' | 'high' = 'medium', interrupt: boolean = false): void {
    if (!this._options.audioDescriptions || !this._speechSynthesis) return;

    const utterance: TTSUtterance = { text, priority, interrupt };
    
    if (interrupt) {
      this._clearTTSQueue();
    }
    
    this._ttsQueue.push(utterance);
    this._processTTSQueue();
  }

  /**
   * Describe current game state
   */
  public describeGameState(): void {
    if (!this._options.audioDescriptions) return;

    // Get current game state information
    const playerGameStateMap = (global as any).playerGameStateMap;
    const playerEntityMap = (global as any).playerEntityMap;
    
    if (!playerGameStateMap || !playerEntityMap) return;

    const playerCount = playerEntityMap.size;
    let description = `Game active with ${playerCount} player${playerCount !== 1 ? 's' : ''}. `;

    // Get first player's state for description
    for (const [username, gameState] of playerGameStateMap.entries()) {
      if (gameState) {
        description += `Current score: ${gameState.score}. `;
        description += `Questions answered: ${gameState.questionsPresented}. `;
        description += `Difficulty: ${gameState.difficulty}. `;
        break;
      }
    }

    this.announce(description, 'medium');
  }

  /**
   * Describe math problem with audio
   */
  public describeMathProblem(num1: number, operator: string, num2: number): void {
    if (!this._options.audioDescriptions) return;

    const operatorWords = {
      '+': 'plus',
      '-': 'minus',
      '*': 'times',
      '/': 'divided by'
    };

    const operatorWord = operatorWords[operator as keyof typeof operatorWords] || operator;
    const description = `Math problem: ${num1} ${operatorWord} ${num2}`;
    
    this.announce(description, 'high', true);
  }

  /**
   * Apply colorblind-friendly color scheme
   */
  public applyColorBlindFriendlyColors(colorBlindType: 'protanopia' | 'deuteranopia' | 'tritanopia' = 'deuteranopia'): void {
    if (!this._options.colorBlindFriendly || typeof document === 'undefined') return;

    const palette = this._colorBlindPalettes.get(colorBlindType);
    if (!palette) return;

    // Store original colors before changing
    this._storeOriginalColors();

    // Apply colorblind-friendly palette
    this._applyColorPalette(palette);
    
    console.log(`[AccessibilityFeatures] Applied ${colorBlindType} color palette`);
  }

  /**
   * Adjust text sizes throughout the interface
   */
  public adjustTextSizes(): void {
    // Only operate in browser environment
    if (typeof document === 'undefined') return;
    
    const sizeMultipliers = {
      'small': 0.8,
      'medium': 1.0,
      'large': 1.3,
      'extra-large': 1.6
    };

    const multiplier = sizeMultipliers[this._options.textSize];
    const elements = document.querySelectorAll('body, body *');

    elements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlElement);
      const currentSize = parseFloat(computedStyle.fontSize);
      
      if (currentSize > 0) {
        htmlElement.style.fontSize = `${currentSize * multiplier}px`;
      }
    });

    console.log(`[AccessibilityFeatures] Text size adjusted to: ${this._options.textSize}`);
  }

  /**
   * Enable high contrast mode
   */
  public applyHighContrast(): void {
    if (!this._options.highContrast || typeof document === 'undefined') return;

    document.body.classList.add('high-contrast');
    
    // Apply high contrast styles
    const style = document.createElement('style');
    style.id = 'accessibility-high-contrast';
    style.textContent = `
      .high-contrast {
        filter: contrast(150%) !important;
      }
      .high-contrast * {
        background-color: var(--bg-color, #000000) !important;
        color: var(--text-color, #ffffff) !important;
        border-color: var(--border-color, #ffffff) !important;
      }
      .high-contrast .button {
        background-color: #000000 !important;
        color: #ffffff !important;
        border: 2px solid #ffffff !important;
      }
      .high-contrast .button:hover {
        background-color: #ffffff !important;
        color: #000000 !important;
      }
    `;
    
    document.head.appendChild(style);
    console.log('[AccessibilityFeatures] High contrast mode enabled');
  }

  /**
   * Enable reduced motion mode
   */
  public applyReducedMotion(): void {
    if (!this._options.reducedMotion || typeof document === 'undefined') return;

    document.body.classList.add('reduced-motion');
    
    const style = document.createElement('style');
    style.id = 'accessibility-reduced-motion';
    style.textContent = `
      .reduced-motion * {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transform: none !important;
      }
    `;
    
    document.head.appendChild(style);
    console.log('[AccessibilityFeatures] Reduced motion mode enabled');
  }

  /**
   * Setup keyboard navigation
   */
  public setupKeyboardNavigation(): void {
    // Only setup in browser environment
    if (typeof document === 'undefined') return;
    
    document.addEventListener('keydown', (event) => {
      // Tab navigation
      if (event.key === 'Tab') {
        this._handleTabNavigation(event);
      }
      
      // Enter/Space for activation
      if (event.key === 'Enter' || event.key === ' ') {
        this._handleActivation(event);
      }
      
      // Arrow key navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        this._handleArrowNavigation(event);
      }
      
      // Escape for cancel/back
      if (event.key === 'Escape') {
        this._handleEscape(event);
      }

      // Accessibility shortcuts
      if (event.ctrlKey || event.metaKey) {
        this._handleAccessibilityShortcuts(event);
      }
    });

    console.log('[AccessibilityFeatures] Keyboard navigation enabled');
  }

  /**
   * Enable one-handed mode
   */
  public enableOneHandedMode(): void {
    if (!this._options.oneHandedMode || typeof document === 'undefined') return;

    // Adjust UI layout for one-handed use
    const mobileControls = document.querySelector('.mobile-controls') as HTMLElement;
    if (mobileControls) {
      mobileControls.classList.add('one-handed-mode');
      
      // Move controls to preferred side (could be configurable)
      mobileControls.style.transform = 'translateX(-20px)'; // Shift left for right-handed use
    }

    // Increase touch target sizes
    const touchElements = document.querySelectorAll('.mobile-dir-button, .button');
    touchElements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.minWidth = '60px';
      htmlElement.style.minHeight = '60px';
      htmlElement.style.margin = '5px';
    });

    console.log('[AccessibilityFeatures] One-handed mode enabled');
  }

  /**
   * Get default accessibility options
   */
  private _getDefaultOptions(): AccessibilityOptions {
    return {
      colorBlindFriendly: false,
      highContrast: false,
      textSize: 'medium',
      reducedMotion: false,
      flashReduction: false,
      audioDescriptions: false,
      soundVolume: 0.7,
      musicVolume: 0.5,
      audioCues: true,
      oneHandedMode: false,
      autoAnswer: false,
      extendedTimeouts: false,
      simplifiedControls: false,
      slowGameMode: false,
      visualFeedback: true,
      hapticFeedback: true,
      repetitionMode: false
    };
  }

  /**
   * Initialize speech synthesis
   */
  private _initializeSpeechSynthesis(): void {
    if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
      this._speechSynthesis = window.speechSynthesis;
      
      // Wait for voices to load
      this._speechSynthesis.onvoiceschanged = () => {
        const voices = this._speechSynthesis!.getVoices();
        // Prefer English voices
        this._currentVoice = voices.find(voice => voice.lang.startsWith('en-')) || voices[0];
      };
    }
  }

  /**
   * Setup color blind palettes
   */
  private _setupColorBlindPalettes(): void {
    // Deuteranopia (most common)
    this._colorBlindPalettes.set('deuteranopia', {
      primary: '#1f77b4',
      secondary: '#ff7f0e',
      success: '#2ca02c',
      warning: '#ffbb33',
      error: '#d62728',
      info: '#17a2b8',
      background: '#ffffff',
      text: '#000000'
    });

    // Protanopia
    this._colorBlindPalettes.set('protanopia', {
      primary: '#1f77b4',
      secondary: '#ff7f0e',
      success: '#2ca02c',
      warning: '#ffbb33',
      error: '#8b4513',
      info: '#17a2b8',
      background: '#ffffff',
      text: '#000000'
    });

    // Tritanopia
    this._colorBlindPalettes.set('tritanopia', {
      primary: '#1f77b4',
      secondary: '#ff1493',
      success: '#32cd32',
      warning: '#ff6347',
      error: '#dc143c',
      info: '#00bfff',
      background: '#ffffff',
      text: '#000000'
    });
  }

  /**
   * Setup audio cues
   */
  private _setupAudioCues(): void {
    if (!this._world) return;

    const audioCueConfigs = [
      { type: AudioCueType.CORRECT_ANSWER, uri: 'audio/sfx/correct-answer.mp3' },
      { type: AudioCueType.WRONG_ANSWER, uri: 'audio/sfx/wrong-answer.mp3' },
      { type: AudioCueType.NEW_QUESTION, uri: 'audio/sfx/new-question.mp3' },
      { type: AudioCueType.GAME_START, uri: 'audio/sfx/game-start.mp3' },
      { type: AudioCueType.GAME_END, uri: 'audio/sfx/game-end.mp3' },
      { type: AudioCueType.POWER_UP_COLLECTED, uri: 'audio/sfx/power-up-collected.mp3' },
      { type: AudioCueType.WARNING, uri: 'audio/sfx/warning.mp3' },
      { type: AudioCueType.NAVIGATION, uri: 'audio/sfx/navigation.mp3' },
      { type: AudioCueType.BUTTON_PRESS, uri: 'audio/sfx/button-press.mp3' },
      { type: AudioCueType.SUCCESS, uri: 'audio/sfx/success.mp3' }
    ];

    audioCueConfigs.forEach(config => {
      try {
        const audio = new Audio({
          uri: config.uri,
          volume: this._options.soundVolume,
          referenceDistance: 1,
          cutoffDistance: 10
        });
        this._audioCues.set(config.type, audio);
      } catch (error) {
        console.warn(`[AccessibilityFeatures] Failed to load audio cue: ${config.type}`, error);
      }
    });
  }

  /**
   * Setup event listeners for game events
   */
  private _setupEventListeners(): void {
    if (!this._world) return;

    this._world.on('correctAnswer', ({ player }) => {
      this.playAudioCue(AudioCueType.CORRECT_ANSWER);
      if (this._options.audioDescriptions) {
        this.announce('Correct answer!', 'high');
      }
    });

    this._world.on('wrongAnswer', ({ player }) => {
      this.playAudioCue(AudioCueType.WRONG_ANSWER);
      if (this._options.audioDescriptions) {
        this.announce('Incorrect answer. Try again!', 'high');
      }
    });

    this._world.on('newMathProblem', (data: any) => {
      this.playAudioCue(AudioCueType.NEW_QUESTION);
      if (data && this._options.audioDescriptions) {
        this.describeMathProblem(data.num1, data.operator, data.num2);
      }
    });
  }

  /**
   * Apply all accessibility settings
   */
  private _applyAccessibilitySettings(): void {
    if (this._options.colorBlindFriendly) {
      this.applyColorBlindFriendlyColors();
    }
    
    if (this._options.highContrast) {
      this.applyHighContrast();
    }
    
    if (this._options.reducedMotion) {
      this.applyReducedMotion();
    }
    
    if (this._options.oneHandedMode) {
      this.enableOneHandedMode();
    }
    
    this.adjustTextSizes();
  }

  /**
   * Process text-to-speech queue
   */
  private _processTTSQueue(): void {
    if (this._isSpeaking || this._ttsQueue.length === 0 || !this._speechSynthesis) return;

    // Sort by priority
    this._ttsQueue.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });

    const utterance = this._ttsQueue.shift()!;
    const speechUtterance = new SpeechSynthesisUtterance(utterance.text);
    
    if (this._currentVoice) {
      speechUtterance.voice = this._currentVoice;
    }
    
    speechUtterance.rate = this._options.slowGameMode ? 0.8 : 1.0;
    speechUtterance.volume = this._options.soundVolume;

    speechUtterance.onstart = () => {
      this._isSpeaking = true;
    };

    speechUtterance.onend = () => {
      this._isSpeaking = false;
      this._processTTSQueue(); // Process next item
    };

    speechUtterance.onerror = () => {
      this._isSpeaking = false;
      console.warn('[AccessibilityFeatures] TTS error occurred');
      this._processTTSQueue();
    };

    this._speechSynthesis.speak(speechUtterance);
  }

  /**
   * Clear TTS queue
   */
  private _clearTTSQueue(): void {
    this._ttsQueue = [];
    if (this._speechSynthesis) {
      this._speechSynthesis.cancel();
      this._isSpeaking = false;
    }
  }

  /**
   * Store original colors before applying accessibility changes
   */
  private _storeOriginalColors(): void {
    if (this._originalColors.size > 0) return; // Already stored

    const elements = document.querySelectorAll('*');
    elements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlElement);
      
      this._originalColors.set(`${index}-bg`, computedStyle.backgroundColor);
      this._originalColors.set(`${index}-color`, computedStyle.color);
      this._originalColors.set(`${index}-border`, computedStyle.borderColor);
    });
  }

  /**
   * Apply color palette
   */
  private _applyColorPalette(palette: ColorBlindPalette): void {
    const style = document.createElement('style');
    style.id = 'accessibility-colorblind-palette';
    style.textContent = `
      :root {
        --primary-color: ${palette.primary} !important;
        --secondary-color: ${palette.secondary} !important;
        --success-color: ${palette.success} !important;
        --warning-color: ${palette.warning} !important;
        --error-color: ${palette.error} !important;
        --info-color: ${palette.info} !important;
        --bg-color: ${palette.background} !important;
        --text-color: ${palette.text} !important;
      }
      .correct { background-color: ${palette.success} !important; }
      .incorrect { background-color: ${palette.error} !important; }
      .warning { background-color: ${palette.warning} !important; }
      .info { background-color: ${palette.info} !important; }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Handle keyboard navigation
   */
  private _handleTabNavigation(event: KeyboardEvent): void {
    // Enhanced tab navigation logic
    this.playAudioCue(AudioCueType.NAVIGATION, 0.3);
  }

  private _handleActivation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'BUTTON' || target.classList.contains('button'))) {
      target.click();
      this.playAudioCue(AudioCueType.BUTTON_PRESS);
      event.preventDefault();
    }
  }

  private _handleArrowNavigation(event: KeyboardEvent): void {
    // Arrow key navigation for answer blocks
    this.playAudioCue(AudioCueType.NAVIGATION, 0.2);
  }

  private _handleEscape(event: KeyboardEvent): void {
    // Handle escape key for going back
    this.playAudioCue(AudioCueType.NAVIGATION);
  }

  private _handleAccessibilityShortcuts(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'h': // High contrast toggle
        this.updateOptions({ highContrast: !this._options.highContrast });
        event.preventDefault();
        break;
      case 'r': // Reduced motion toggle
        this.updateOptions({ reducedMotion: !this._options.reducedMotion });
        event.preventDefault();
        break;
      case 's': // Speech toggle
        this.updateOptions({ audioDescriptions: !this._options.audioDescriptions });
        event.preventDefault();
        break;
    }
  }

  /**
   * Announce accessibility status
   */
  private _announceAccessibilityStatus(): void {
    if (this._options.audioDescriptions) {
      this.announce('Accessibility features initialized. Press Control+S to toggle speech descriptions.', 'medium');
    }
  }

  /**
   * Announce settings changes
   */
  private _announceSettingsChange(oldOptions: AccessibilityOptions, newOptions: AccessibilityOptions): void {
    if (!newOptions.audioDescriptions) return;

    const changes: string[] = [];
    
    if (oldOptions.highContrast !== newOptions.highContrast) {
      changes.push(`High contrast ${newOptions.highContrast ? 'enabled' : 'disabled'}`);
    }
    
    if (oldOptions.textSize !== newOptions.textSize) {
      changes.push(`Text size changed to ${newOptions.textSize}`);
    }
    
    if (oldOptions.reducedMotion !== newOptions.reducedMotion) {
      changes.push(`Reduced motion ${newOptions.reducedMotion ? 'enabled' : 'disabled'}`);
    }

    if (changes.length > 0) {
      this.announce(changes.join('. '), 'medium');
    }
  }

  /**
   * Load user preferences from localStorage
   */
  private _loadUserPreferences(): void {
    try {
      // Only access localStorage in browser environment
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('accessibilityOptions');
        if (stored) {
          const options = JSON.parse(stored) as Partial<AccessibilityOptions>;
          this._options = { ...this._options, ...options };
        }
      }
    } catch (error) {
      console.warn('[AccessibilityFeatures] Failed to load user preferences:', error);
    }
  }

  /**
   * Save user preferences to localStorage
   */
  private _saveUserPreferences(): void {
    try {
      // Only access localStorage in browser environment
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('accessibilityOptions', JSON.stringify(this._options));
      }
    } catch (error) {
      console.warn('[AccessibilityFeatures] Failed to save user preferences:', error);
    }
  }
}