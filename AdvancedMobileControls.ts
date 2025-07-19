import { World, Player, PlayerEntity, Vector3Like } from 'hytopia';

/**
 * Touch Gesture Types
 */
export enum TouchGesture {
  TAP = 'tap',
  SWIPE_LEFT = 'swipe_left',
  SWIPE_RIGHT = 'swipe_right',
  SWIPE_UP = 'swipe_up',
  SWIPE_DOWN = 'swipe_down',
  PINCH = 'pinch',
  DOUBLE_TAP = 'double_tap',
  LONG_PRESS = 'long_press'
}

/**
 * Mobile Control Settings
 */
interface MobileControlSettings {
  gestureEnabled: boolean;
  hapticEnabled: boolean;
  touchSensitivity: number; // 0.1 to 2.0
  swipeThreshold: number; // pixels
  longPressDelay: number; // milliseconds
  doubleTapDelay: number; // milliseconds
}

/**
 * Touch Event Data
 */
interface TouchEventData {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;
  force?: number;
}

/**
 * Gesture Detection Result
 */
interface GestureResult {
  type: TouchGesture;
  data: any;
  confidence: number; // 0.0 to 1.0
}

/**
 * Advanced Mobile Controls System
 * Provides gesture-based movement, haptic feedback, and optimized touch controls
 */
export class AdvancedMobileControls {
  private static _instance: AdvancedMobileControls;
  private _world: World | undefined;
  private _settings: MobileControlSettings;
  private _touchData: Map<number, TouchEventData> = new Map();
  private _gestureHistory: GestureResult[] = [];
  private _lastGestureTime: number = 0;
  private _isCalibrating: boolean = false;
  private _calibrationData: TouchEventData[] = [];

  // Touch target optimization
  private _minTouchTarget: number = 44; // 44px minimum touch target (Apple HIG)
  private _currentTouchTargets: Map<string, HTMLElement> = new Map();

  // Haptic feedback support
  private _hapticSupported: boolean = false;

  public static get instance(): AdvancedMobileControls {
    if (!this._instance) {
      this._instance = new AdvancedMobileControls();
    }
    return this._instance;
  }

  private constructor() {
    this._settings = {
      gestureEnabled: true,
      hapticEnabled: true,
      touchSensitivity: 1.0,
      swipeThreshold: 50,
      longPressDelay: 500,
      doubleTapDelay: 300
    };

    this._detectHapticSupport();
  }

  /**
   * Initialize the advanced mobile controls system
   */
  public initialize(world: World): void {
    try {
      if (!world) {
        throw new Error('World instance is required for AdvancedMobileControls');
      }
      
      this._world = world;
      this._setupTouchEventListeners();
      this._optimizeTouchTargets();
      this._loadSettings();
      
      console.log('[AdvancedMobileControls] Initialized successfully');
      console.log(`[AdvancedMobileControls] Haptic support: ${this._hapticSupported ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('[AdvancedMobileControls] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Update settings for mobile controls
   */
  public updateSettings(newSettings: Partial<MobileControlSettings>): void {
    this._settings = { ...this._settings, ...newSettings };
    this._saveSettings();
    console.log('[AdvancedMobileControls] Settings updated:', this._settings);
  }

  /**
   * Get current settings
   */
  public getSettings(): MobileControlSettings {
    return { ...this._settings };
  }

  /**
   * Start touch calibration for user
   */
  public startCalibration(): void {
    this._isCalibrating = true;
    this._calibrationData = [];
    console.log('[AdvancedMobileControls] Starting touch calibration...');
    
    // Show calibration UI
    this._showCalibrationUI();
  }

  /**
   * Process touch calibration and adjust sensitivity
   */
  public finishCalibration(): void {
    if (!this._isCalibrating || this._calibrationData.length < 5) {
      console.warn('[AdvancedMobileControls] Insufficient calibration data');
      return;
    }

    this._isCalibrating = false;
    
    // Analyze calibration data to determine optimal sensitivity
    const avgPressure = this._calibrationData.reduce((sum, data) => sum + (data.pressure || 0.5), 0) / this._calibrationData.length;
    const newSensitivity = Math.max(0.1, Math.min(2.0, avgPressure * 2));
    
    this.updateSettings({ touchSensitivity: newSensitivity });
    this._hideCalibrationUI();
    
    console.log(`[AdvancedMobileControls] Calibration complete. New sensitivity: ${newSensitivity}`);
  }

  /**
   * Handle player movement based on gesture
   */
  public handleMovementGesture(player: Player, gesture: GestureResult): void {
    if (!this._world || !this._settings.gestureEnabled) return;

    const playerData = (global as any).playerEntityMap?.get(player.username);
    if (!playerData?.entity) return;

    const entity = playerData.entity as PlayerEntity;
    const currentPos = entity.position;
    let newPosition: Vector3Like = { ...currentPos };

    // Apply haptic feedback for movement
    if (this._settings.hapticEnabled) {
      this._triggerHaptic('light');
    }

    switch (gesture.type) {
      case TouchGesture.SWIPE_LEFT:
        newPosition.x -= 1 * this._settings.touchSensitivity;
        break;
      case TouchGesture.SWIPE_RIGHT:
        newPosition.x += 1 * this._settings.touchSensitivity;
        break;
      case TouchGesture.SWIPE_UP:
        // Jump gesture
        entity.applyImpulse({ x: 0, y: 10 * this._settings.touchSensitivity, z: 0 });
        this._triggerHaptic('medium');
        return;
      case TouchGesture.SWIPE_DOWN:
        // Fast fall
        entity.applyImpulse({ x: 0, y: -5 * this._settings.touchSensitivity, z: 0 });
        break;
      case TouchGesture.DOUBLE_TAP:
        // Special action - could trigger power-up or special move
        this._world.emit('doubleTapAction', { player });
        this._triggerHaptic('heavy');
        return;
    }

    // Clamp movement within bounds
    newPosition.x = Math.max(-10, Math.min(10, newPosition.x));
    entity.setPosition(newPosition);
  }

  /**
   * Detect haptic feedback support
   */
  private _detectHapticSupport(): void {
    try {
      // Only detect haptic support in browser environment
      if (typeof navigator !== 'undefined' && typeof window !== 'undefined') {
        this._hapticSupported = 'vibrate' in navigator || 
                               'hapticFeedback' in navigator ||
                               ('Accelerometer' in window) ||
                               /iPhone|iPad|iPod/.test(navigator.userAgent);
      } else {
        this._hapticSupported = false;
      }
    } catch (error) {
      console.warn('[AdvancedMobileControls] Error detecting haptic support:', error);
      this._hapticSupported = false;
    }
  }

  /**
   * Setup touch event listeners for gesture detection
   */
  private _setupTouchEventListeners(): void {
    if (typeof document === 'undefined') return;

    let startTouch: TouchEventData | null = null;
    let tapCount = 0;
    let tapTimeout: NodeJS.Timeout | null = null;

    // Touch start
    document.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const touchData: TouchEventData = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
        pressure: (touch as any).force || 0.5
      };

      startTouch = touchData;
      
      if (this._isCalibrating) {
        this._calibrationData.push(touchData);
      }

      // Handle long press
      setTimeout(() => {
        if (startTouch && this._isSameTouch(startTouch, touchData, 10)) {
          this._processGesture({
            type: TouchGesture.LONG_PRESS,
            data: touchData,
            confidence: 0.9
          });
        }
      }, this._settings.longPressDelay);
    });

    // Touch end
    document.addEventListener('touchend', (e) => {
      if (!startTouch) return;

      const touch = e.changedTouches[0];
      const endTouch: TouchEventData = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
        pressure: (touch as any).force || 0.5
      };

      const deltaX = endTouch.x - startTouch.x;
      const deltaY = endTouch.y - startTouch.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const duration = endTouch.timestamp - startTouch.timestamp;

      // Detect swipe gestures
      if (distance > this._settings.swipeThreshold && duration < 500) {
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        let gestureType: TouchGesture;

        if (Math.abs(angle) < 45) {
          gestureType = TouchGesture.SWIPE_RIGHT;
        } else if (Math.abs(angle) > 135) {
          gestureType = TouchGesture.SWIPE_LEFT;
        } else if (angle > 45 && angle < 135) {
          gestureType = TouchGesture.SWIPE_DOWN;
        } else {
          gestureType = TouchGesture.SWIPE_UP;
        }

        this._processGesture({
          type: gestureType,
          data: { deltaX, deltaY, distance, duration },
          confidence: Math.min(1.0, distance / (this._settings.swipeThreshold * 2))
        });
      }
      // Detect tap gestures
      else if (distance < 20 && duration < 200) {
        tapCount++;
        
        if (tapTimeout) {
          clearTimeout(tapTimeout);
        }

        tapTimeout = setTimeout(() => {
          if (tapCount === 1) {
            this._processGesture({
              type: TouchGesture.TAP,
              data: startTouch,
              confidence: 0.9
            });
          } else if (tapCount === 2) {
            this._processGesture({
              type: TouchGesture.DOUBLE_TAP,
              data: startTouch,
              confidence: 0.9
            });
          }
          tapCount = 0;
        }, this._settings.doubleTapDelay);
      }

      startTouch = null;
    });
  }

  /**
   * Process detected gesture
   */
  private _processGesture(gesture: GestureResult): void {
    if (!this._world) return;

    this._gestureHistory.push(gesture);
    if (this._gestureHistory.length > 10) {
      this._gestureHistory.shift();
    }

    this._lastGestureTime = Date.now();

    // Find the player to apply gesture to
    const playerEntityMap = (global as any).playerEntityMap;
    if (!playerEntityMap) return;

    for (const [username, playerData] of playerEntityMap.entries()) {
      if (playerData?.entity?.player) {
        this.handleMovementGesture(playerData.entity.player, gesture);
        break; // Apply to first player for now
      }
    }

    console.log(`[AdvancedMobileControls] Gesture detected: ${gesture.type} (confidence: ${gesture.confidence})`);
  }

  /**
   * Optimize touch targets for better mobile accessibility
   */
  private _optimizeTouchTargets(): void {
    if (typeof document === 'undefined') return;

    const touchElements = document.querySelectorAll('.mobile-dir-button, .button, .power-up-button');
    
    touchElements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      
      // Ensure minimum touch target size
      if (rect.width < this._minTouchTarget || rect.height < this._minTouchTarget) {
        htmlElement.style.minWidth = `${this._minTouchTarget}px`;
        htmlElement.style.minHeight = `${this._minTouchTarget}px`;
        htmlElement.style.padding = '8px';
      }

      // Add visual feedback
      htmlElement.style.transition = 'transform 0.1s ease';
      
      htmlElement.addEventListener('touchstart', () => {
        htmlElement.style.transform = 'scale(0.95)';
        this._triggerHaptic('light');
      });

      htmlElement.addEventListener('touchend', () => {
        htmlElement.style.transform = 'scale(1)';
      });

      this._currentTouchTargets.set(htmlElement.id || htmlElement.className, htmlElement);
    });

    console.log(`[AdvancedMobileControls] Optimized ${touchElements.length} touch targets`);
  }

  /**
   * Trigger haptic feedback
   */
  private _triggerHaptic(type: 'light' | 'medium' | 'heavy'): void {
    if (!this._settings.hapticEnabled || !this._hapticSupported) return;

    try {
      if ('vibrate' in navigator) {
        const patterns = {
          light: [10],
          medium: [20],
          heavy: [30, 10, 30]
        };
        navigator.vibrate(patterns[type]);
      }
    } catch (error) {
      console.warn('[AdvancedMobileControls] Haptic feedback failed:', error);
    }
  }

  /**
   * Show calibration UI
   */
  private _showCalibrationUI(): void {
    if (typeof document === 'undefined') return;

    const calibrationOverlay = document.createElement('div');
    calibrationOverlay.id = 'mobile-calibration-overlay';
    calibrationOverlay.innerHTML = `
      <div class="calibration-content">
        <h2>Touch Calibration</h2>
        <p>Tap the screen 5 times with your normal touch pressure</p>
        <div class="calibration-progress">
          <div class="progress-bar" id="calibration-progress"></div>
        </div>
        <button id="calibration-skip">Skip Calibration</button>
      </div>
    `;

    calibrationOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-family: Arial, sans-serif;
    `;

    document.body.appendChild(calibrationOverlay);

    // Setup skip button
    const skipButton = calibrationOverlay.querySelector('#calibration-skip') as HTMLElement;
    skipButton?.addEventListener('click', () => {
      this._isCalibrating = false;
      this._hideCalibrationUI();
    });

    // Update progress
    const updateProgress = () => {
      const progress = calibrationOverlay.querySelector('#calibration-progress') as HTMLElement;
      if (progress) {
        const percentage = (this._calibrationData.length / 5) * 100;
        progress.style.width = `${percentage}%`;
        
        if (this._calibrationData.length >= 5) {
          setTimeout(() => this.finishCalibration(), 500);
        }
      }
    };

    const progressInterval = setInterval(() => {
      if (!this._isCalibrating) {
        clearInterval(progressInterval);
        return;
      }
      updateProgress();
    }, 100);
  }

  /**
   * Hide calibration UI
   */
  private _hideCalibrationUI(): void {
    const overlay = document.getElementById('mobile-calibration-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Check if two touches are the same (within threshold)
   */
  private _isSameTouch(touch1: TouchEventData, touch2: TouchEventData, threshold: number): boolean {
    const distance = Math.sqrt(
      Math.pow(touch1.x - touch2.x, 2) + 
      Math.pow(touch1.y - touch2.y, 2)
    );
    return distance < threshold;
  }

  /**
   * Load settings from localStorage
   */
  private _loadSettings(): void {
    try {
      // Only access localStorage in browser environment
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('mobileControlSettings');
        if (stored) {
          const settings = JSON.parse(stored) as Partial<MobileControlSettings>;
          this._settings = { ...this._settings, ...settings };
        }
      }
    } catch (error) {
      console.warn('[AdvancedMobileControls] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  private _saveSettings(): void {
    try {
      // Only access localStorage in browser environment
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mobileControlSettings', JSON.stringify(this._settings));
      }
    } catch (error) {
      console.warn('[AdvancedMobileControls] Failed to save settings:', error);
    }
  }

  /**
   * Get gesture statistics for debugging
   */
  public getGestureStats(): any {
    return {
      gestureHistory: this._gestureHistory,
      lastGestureTime: this._lastGestureTime,
      calibrationData: this._calibrationData.length,
      hapticSupported: this._hapticSupported,
      settings: this._settings
    };
  }
}