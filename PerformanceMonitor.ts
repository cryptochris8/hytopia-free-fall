import { World, Entity, PlayerEntity } from 'hytopia';

/**
 * Performance Metrics Data
 */
export interface PerformanceMetrics {
  frameRate: {
    current: number;
    average: number;
    minimum: number;
    maximum: number;
  };
  entityCount: {
    total: number;
    players: number;
    fragments: number;
    powerUps: number;
    others: number;
  };
  memory: {
    used: number; // MB
    available: number; // MB
    percentage: number;
  };
  network: {
    latency: number; // ms
    packetLoss: number; // percentage
  };
  gameplay: {
    averageAnswerTime: number; // ms
    correctAnswerRate: number; // percentage
    activePowerUps: number;
    currentDifficulty: string;
  };
  system: {
    deviceType: 'mobile' | 'desktop' | 'tablet';
    batteryLevel?: number; // percentage
    thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  };
}

/**
 * Performance Alert Configuration
 */
interface PerformanceAlert {
  metric: keyof PerformanceMetrics;
  threshold: number;
  type: 'warning' | 'critical';
  action: 'log' | 'notify' | 'reduce_quality' | 'pause_game';
}

/**
 * Performance Optimization Settings
 */
interface OptimizationSettings {
  autoOptimize: boolean;
  targetFPS: number;
  maxEntities: number;
  reducedQualityMode: boolean;
  adaptiveQuality: boolean;
}

/**
 * Performance Monitor System
 * Tracks game performance metrics and provides optimization suggestions
 */
export class PerformanceMonitor {
  private static _instance: PerformanceMonitor;
  private _world: World | undefined;
  private _metrics: PerformanceMetrics;
  private _frameTimeHistory: number[] = [];
  private _lastFrameTime: number = 0;
  private _monitoring: boolean = false;
  private _monitoringInterval: NodeJS.Timeout | undefined;
  private _optimizationSettings: OptimizationSettings;
  private _alerts: PerformanceAlert[] = [];
  private _performanceLog: any[] = [];

  // Timing variables
  private _lastTickTime: number = 0;
  private _frameCount: number = 0;
  private _startTime: number = 0;

  // Memory tracking
  private _memoryCheckInterval: NodeJS.Timeout | undefined;
  private _lastMemoryUsage: number = 0;

  // Network tracking
  private _pingStartTime: number = 0;
  private _lastPingTime: number = 0;

  public static get instance(): PerformanceMonitor {
    if (!this._instance) {
      this._instance = new PerformanceMonitor();
    }
    return this._instance;
  }

  private constructor() {
    this._metrics = this._initializeMetrics();
    this._optimizationSettings = {
      autoOptimize: true,
      targetFPS: 60,
      maxEntities: 100,
      reducedQualityMode: false,
      adaptiveQuality: true
    };

    this._setupDefaultAlerts();
    this._detectSystemInfo();
    this._startTime = performance.now();
  }

  /**
   * Initialize the performance monitoring system
   */
  public initialize(world: World): void {
    try {
      if (!world) {
        throw new Error('World instance is required for PerformanceMonitor');
      }

      this._world = world;
      this._setupPerformanceTracking();
      this.startMonitoring();

      console.log('[PerformanceMonitor] Initialized successfully');
      console.log(`[PerformanceMonitor] Target FPS: ${this._optimizationSettings.targetFPS}`);
      console.log(`[PerformanceMonitor] Auto-optimization: ${this._optimizationSettings.autoOptimize ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(): void {
    if (this._monitoring) return;

    this._monitoring = true;
    this._monitoringInterval = setInterval(() => {
      this._updateMetrics();
      this._checkAlerts();
      this._applyOptimizations();
    }, 1000); // Update every second

    this._memoryCheckInterval = setInterval(() => {
      this._updateMemoryMetrics();
    }, 5000); // Check memory every 5 seconds

    console.log('[PerformanceMonitor] Monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    this._monitoring = false;
    
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = undefined;
    }

    if (this._memoryCheckInterval) {
      clearInterval(this._memoryCheckInterval);
      this._memoryCheckInterval = undefined;
    }

    console.log('[PerformanceMonitor] Monitoring stopped');
  }

  /**
   * Track performance for a single frame/tick
   */
  public trackPerformance(deltaTimeMs: number): void {
    if (!this._monitoring) return;

    const currentTime = performance.now();
    this._frameCount++;

    // Calculate frame rate
    if (this._lastFrameTime > 0) {
      const frameTime = currentTime - this._lastFrameTime;
      this._frameTimeHistory.push(frameTime);
      
      // Keep only recent frame times (last 60 frames)
      if (this._frameTimeHistory.length > 60) {
        this._frameTimeHistory.shift();
      }

      // Update frame rate metrics
      this._updateFrameRateMetrics();
    }

    this._lastFrameTime = currentTime;
    this._lastTickTime = currentTime;
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this._metrics };
  }

  /**
   * Get performance report as string
   */
  public getPerformanceReport(): string {
    const metrics = this._metrics;
    
    return `
=== PERFORMANCE REPORT ===
Frame Rate: ${metrics.frameRate.current.toFixed(1)} FPS (avg: ${metrics.frameRate.average.toFixed(1)})
Entities: ${metrics.entityCount.total} (Players: ${metrics.entityCount.players}, Fragments: ${metrics.entityCount.fragments})
Memory: ${metrics.memory.used.toFixed(1)}MB (${metrics.memory.percentage.toFixed(1)}%)
Network: ${metrics.network.latency}ms latency
Device: ${metrics.system.deviceType} ${metrics.system.batteryLevel ? `(Battery: ${metrics.system.batteryLevel}%)` : ''}
Quality Mode: ${this._optimizationSettings.reducedQualityMode ? 'Reduced' : 'Normal'}
=========================
    `.trim();
  }

  /**
   * Update optimization settings
   */
  public updateOptimizationSettings(settings: Partial<OptimizationSettings>): void {
    this._optimizationSettings = { ...this._optimizationSettings, ...settings };
    console.log('[PerformanceMonitor] Optimization settings updated:', this._optimizationSettings);
  }

  /**
   * Add custom performance alert
   */
  public addAlert(alert: PerformanceAlert): void {
    this._alerts.push(alert);
    console.log(`[PerformanceMonitor] Added ${alert.type} alert for ${alert.metric as string}`);
  }

  /**
   * Manually trigger optimization
   */
  public optimizeNow(): void {
    this._applyOptimizations();
    console.log('[PerformanceMonitor] Manual optimization triggered');
  }

  /**
   * Get performance log for debugging
   */
  public getPerformanceLog(): any[] {
    return [...this._performanceLog];
  }

  /**
   * Initialize default metrics
   */
  private _initializeMetrics(): PerformanceMetrics {
    return {
      frameRate: {
        current: 0,
        average: 0,
        minimum: Infinity,
        maximum: 0
      },
      entityCount: {
        total: 0,
        players: 0,
        fragments: 0,
        powerUps: 0,
        others: 0
      },
      memory: {
        used: 0,
        available: 0,
        percentage: 0
      },
      network: {
        latency: 0,
        packetLoss: 0
      },
      gameplay: {
        averageAnswerTime: 0,
        correctAnswerRate: 0,
        activePowerUps: 0,
        currentDifficulty: 'moderate'
      },
      system: {
        deviceType: this._detectDeviceType(),
        batteryLevel: undefined,
        thermalState: 'nominal'
      }
    };
  }

  /**
   * Setup performance tracking with world events
   */
  private _setupPerformanceTracking(): void {
    if (!this._world) return;

    // Track gameplay metrics
    this._world.on('correctAnswer', () => {
      this._updateGameplayMetrics('correct');
    });

    this._world.on('wrongAnswer', () => {
      this._updateGameplayMetrics('wrong');
    });

    // Track network latency with periodic pings
    this._startNetworkMonitoring();
  }

  /**
   * Update all metrics
   */
  private _updateMetrics(): void {
    this._updateEntityCounts();
    this._updateSystemMetrics();
    this._logPerformanceData();
  }

  /**
   * Update frame rate metrics
   */
  private _updateFrameRateMetrics(): void {
    if (this._frameTimeHistory.length === 0) return;

    const avgFrameTime = this._frameTimeHistory.reduce((sum, time) => sum + time, 0) / this._frameTimeHistory.length;
    const currentFPS = 1000 / (this._frameTimeHistory[this._frameTimeHistory.length - 1] || 16.67);
    const avgFPS = 1000 / avgFrameTime;
    const minFPS = 1000 / Math.max(...this._frameTimeHistory);
    const maxFPS = 1000 / Math.min(...this._frameTimeHistory);

    this._metrics.frameRate = {
      current: Math.round(currentFPS),
      average: Math.round(avgFPS),
      minimum: Math.round(Math.min(this._metrics.frameRate.minimum, minFPS)),
      maximum: Math.round(Math.max(this._metrics.frameRate.maximum, maxFPS))
    };
  }

  /**
   * Update entity counts
   */
  private _updateEntityCounts(): void {
    if (!this._world) return;

    try {
      // Get entities from global playerEntityMap and estimate others
      const playerEntityMap = (global as any).playerEntityMap;
      const playerCount = playerEntityMap ? playerEntityMap.size : 0;

      // Estimate other entity counts based on game state
      const fragmentPool = (global as any).fragmentPool;
      const fragmentCount = fragmentPool ? fragmentPool._activeFragments?.size || 0 : 0;

      const powerUpCount = this._estimatePowerUpCount();
      const otherCount = this._estimateOtherEntities();

      this._metrics.entityCount = {
        players: playerCount,
        fragments: fragmentCount,
        powerUps: powerUpCount,
        others: otherCount,
        total: playerCount + fragmentCount + powerUpCount + otherCount
      };
    } catch (error) {
      console.warn('[PerformanceMonitor] Error updating entity counts:', error);
    }
  }

  /**
   * Update memory metrics
   */
  private _updateMemoryMetrics(): void {
    try {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;
        const totalMB = memInfo.totalJSHeapSize / 1024 / 1024;
        const limitMB = memInfo.jsHeapSizeLimit / 1024 / 1024;

        this._metrics.memory = {
          used: usedMB,
          available: limitMB - usedMB,
          percentage: (usedMB / limitMB) * 100
        };
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Error updating memory metrics:', error);
    }
  }

  /**
   * Update system metrics
   */
  private _updateSystemMetrics(): void {
    try {
      // Update battery level if available
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          this._metrics.system.batteryLevel = Math.round(battery.level * 100);
        });
      }

      // Estimate thermal state based on performance
      if (this._metrics.frameRate.current < this._optimizationSettings.targetFPS * 0.6) {
        this._metrics.system.thermalState = 'serious';
      } else if (this._metrics.frameRate.current < this._optimizationSettings.targetFPS * 0.8) {
        this._metrics.system.thermalState = 'fair';
      } else {
        this._metrics.system.thermalState = 'nominal';
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Error updating system metrics:', error);
    }
  }

  /**
   * Update gameplay metrics
   */
  private _updateGameplayMetrics(result: 'correct' | 'wrong'): void {
    // These would be updated based on actual game events
    // For now, we'll estimate based on game state
    const powerUpManager = (global as any).powerUpManager;
    this._metrics.gameplay.activePowerUps = powerUpManager ? Object.keys(powerUpManager._activePowerUps || {}).length : 0;
  }

  /**
   * Check performance alerts
   */
  private _checkAlerts(): void {
    this._alerts.forEach(alert => {
      const value = this._getMetricValue(alert.metric);
      if (value !== null && value > alert.threshold) {
        this._handleAlert(alert, value);
      }
    });
  }

  /**
   * Apply automatic optimizations
   */
  private _applyOptimizations(): void {
    if (!this._optimizationSettings.autoOptimize) return;

    const currentFPS = this._metrics.frameRate.current;
    const targetFPS = this._optimizationSettings.targetFPS;
    const entityCount = this._metrics.entityCount.total;

    // Reduce quality if FPS is too low
    if (currentFPS < targetFPS * 0.7 && !this._optimizationSettings.reducedQualityMode) {
      this._enableReducedQuality();
    }

    // Limit entities if too many
    if (entityCount > this._optimizationSettings.maxEntities) {
      this._limitEntities();
    }

    // Re-enable quality if performance improves
    if (currentFPS > targetFPS * 0.9 && this._optimizationSettings.reducedQualityMode) {
      this._disableReducedQuality();
    }
  }

  /**
   * Setup default performance alerts
   */
  private _setupDefaultAlerts(): void {
    this._alerts = [
      {
        metric: 'frameRate' as keyof PerformanceMetrics,
        threshold: 30,
        type: 'warning',
        action: 'reduce_quality'
      },
      {
        metric: 'memory' as keyof PerformanceMetrics,
        threshold: 85,
        type: 'critical',
        action: 'notify'
      },
      {
        metric: 'entityCount' as keyof PerformanceMetrics,
        threshold: 150,
        type: 'warning',
        action: 'reduce_quality'
      }
    ];
  }

  /**
   * Detect device type
   */
  private _detectDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';
    
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod/.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/.test(userAgent)) {
      return 'tablet';
    }
    
    return 'desktop';
  }

  /**
   * Detect system information
   */
  private _detectSystemInfo(): void {
    try {
      this._metrics.system.deviceType = this._detectDeviceType();
      
      // Try to get battery info
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          this._metrics.system.batteryLevel = Math.round(battery.level * 100);
        });
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Error detecting system info:', error);
    }
  }

  /**
   * Start network monitoring
   */
  private _startNetworkMonitoring(): void {
    // Simulate network monitoring
    setInterval(() => {
      this._pingServer();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Ping server to measure latency
   */
  private _pingServer(): void {
    const startTime = performance.now();
    
    // Simulate network request
    fetch('/ping').then(() => {
      const latency = Math.round(performance.now() - startTime);
      this._metrics.network.latency = latency;
    }).catch(() => {
      // If ping fails, estimate latency based on recent history
      this._metrics.network.latency = this._lastPingTime || 50;
    });
  }

  /**
   * Get metric value by key
   */
  private _getMetricValue(metric: keyof PerformanceMetrics): number | null {
    try {
      const value = this._metrics[metric];
      if (typeof value === 'number') return value;
      if (typeof value === 'object' && 'current' in value) return value.current;
      if (typeof value === 'object' && 'total' in value) return value.total;
      if (typeof value === 'object' && 'percentage' in value) return value.percentage;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Handle performance alert
   */
  private _handleAlert(alert: PerformanceAlert, value: number): void {
    const message = `[PerformanceMonitor] ${alert.type.toUpperCase()}: ${alert.metric as string} = ${value} (threshold: ${alert.threshold})`;
    
    if (alert.type === 'critical') {
      console.error(message);
    } else {
      console.warn(message);
    }

    // Execute alert action
    switch (alert.action) {
      case 'reduce_quality':
        this._enableReducedQuality();
        break;
      case 'pause_game':
        this._pauseGame();
        break;
      case 'notify':
        this._notifyUser(alert, value);
        break;
    }
  }

  /**
   * Enable reduced quality mode
   */
  private _enableReducedQuality(): void {
    if (this._optimizationSettings.reducedQualityMode) return;
    
    this._optimizationSettings.reducedQualityMode = true;
    
    // Reduce fragment effects
    const fragmentPool = (global as any).fragmentPool;
    if (fragmentPool) {
      fragmentPool._poolSize = Math.min(fragmentPool._poolSize, 20);
    }

    console.log('[PerformanceMonitor] Reduced quality mode enabled');
  }

  /**
   * Disable reduced quality mode
   */
  private _disableReducedQuality(): void {
    if (!this._optimizationSettings.reducedQualityMode) return;
    
    this._optimizationSettings.reducedQualityMode = false;
    console.log('[PerformanceMonitor] Reduced quality mode disabled');
  }

  /**
   * Limit entities to improve performance
   */
  private _limitEntities(): void {
    const fragmentPool = (global as any).fragmentPool;
    if (fragmentPool && fragmentPool._activeFragments) {
      const activeFragments = Array.from(fragmentPool._activeFragments.keys());
      if (activeFragments.length > this._optimizationSettings.maxEntities / 2) {
        // Return some fragments to pool
        const toReturn = activeFragments.slice(0, 10);
        toReturn.forEach((fragment: any) => fragmentPool.returnFragment(fragment));
      }
    }
  }

  /**
   * Pause game for critical performance issues
   */
  private _pauseGame(): void {
    console.error('[PerformanceMonitor] Critical performance issue - consider pausing game');
    // This would integrate with the main game pause system
  }

  /**
   * Notify user of performance issues
   */
  private _notifyUser(alert: PerformanceAlert, value: number): void {
    // This would show a user notification
    console.log(`[PerformanceMonitor] User notification: Performance issue detected (${alert.metric as string}: ${value})`);
  }

  /**
   * Estimate power-up count
   */
  private _estimatePowerUpCount(): number {
    const powerUpManager = (global as any).powerUpManager;
    return powerUpManager ? Object.keys(powerUpManager._activePowerUps || {}).length : 0;
  }

  /**
   * Estimate other entities
   */
  private _estimateOtherEntities(): number {
    // Estimate based on game state (UI elements, effects, etc.)
    return 5;
  }

  /**
   * Log performance data
   */
  private _logPerformanceData(): void {
    const logEntry = {
      timestamp: Date.now(),
      metrics: { ...this._metrics },
      optimizations: { ...this._optimizationSettings }
    };

    this._performanceLog.push(logEntry);
    
    // Keep only recent log entries (last 100)
    if (this._performanceLog.length > 100) {
      this._performanceLog.shift();
    }
  }
}