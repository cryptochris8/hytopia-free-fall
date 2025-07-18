/**
 * Fragment Texture Manager - Manages varied textures for fragment effects
 */
export class FragmentTextureManager {
  private static _instance: FragmentTextureManager;
  
  // Texture variations for different block types
  private readonly _textureVariations: Record<string, string[]> = {
    // Stone-like blocks
    'blocks/stone.png': [
      'blocks/stone.png',
      'blocks/cobblestone.png',
      'blocks/gravel.png',
      'blocks/Free-fall/stone-fragment-1.png',
      'blocks/Free-fall/stone-fragment-2.png'
    ],
    
    // Wood-like blocks
    'blocks/wood-planks.png': [
      'blocks/wood-planks.png',
      'blocks/Free-fall/wood-chip-1.png',
      'blocks/Free-fall/wood-chip-2.png',
      'blocks/Free-fall/splinter.png'
    ],
    
    // Glass-like blocks
    'blocks/glass.png': [
      'blocks/glass.png',
      'blocks/Free-fall/glass-shard-1.png',
      'blocks/Free-fall/glass-shard-2.png',
      'blocks/Free-fall/glass-shard-3.png'
    ],
    
    // Metal/Ore blocks
    'blocks/iron-block.png': [
      'blocks/iron-block.png',
      'blocks/Free-fall/metal-fragment-1.png',
      'blocks/Free-fall/metal-fragment-2.png',
      'blocks/Free-fall/rust-flake.png'
    ],
    
    // Special blocks (emerald for correct answers)
    'blocks/emerald-block.png': [
      'blocks/emerald-block.png',
      'blocks/Free-fall/emerald-shard-1.png',
      'blocks/Free-fall/emerald-shard-2.png',
      'blocks/Free-fall/gem-sparkle.png'
    ],
    
    // Fire blocks (for wrong answers)
    'blocks/fire/fire_01.png': [
      'blocks/fire/fire_01.png',
      'blocks/Free-fall/ember-1.png',
      'blocks/Free-fall/ember-2.png',
      'blocks/Free-fall/ash.png'
    ]
  };
  
  // Default fragments for blocks without specific variations
  private readonly _defaultFragments: string[] = [
    'blocks/Free-fall/generic-fragment-1.png',
    'blocks/Free-fall/generic-fragment-2.png',
    'blocks/Free-fall/generic-fragment-3.png',
    'blocks/Free-fall/dust-particle.png'
  ];

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): FragmentTextureManager {
    if (!FragmentTextureManager._instance) {
      FragmentTextureManager._instance = new FragmentTextureManager();
    }
    return FragmentTextureManager._instance;
  }

  /**
   * Get fragment textures for a given block texture
   */
  public getFragmentTextures(blockTexture: string, count: number = 4): string[] {
    const variations = this._textureVariations[blockTexture] || this._defaultFragments;
    const textures: string[] = [];
    
    // Randomly select textures from available variations
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * variations.length);
      textures.push(variations[randomIndex]);
    }
    
    return textures;
  }

  /**
   * Get a specific effect-based texture set
   */
  public getEffectTextures(effectType: 'sparkle' | 'dust' | 'debris' | 'magic', count: number = 4): string[] {
    const effectTextures: Record<string, string[]> = {
      sparkle: [
        'blocks/Free-fall/sparkle-1.png',
        'blocks/Free-fall/sparkle-2.png',
        'blocks/Free-fall/star-particle.png',
        'blocks/Free-fall/glow-particle.png'
      ],
      dust: [
        'blocks/Free-fall/dust-particle.png',
        'blocks/Free-fall/smoke-particle.png',
        'blocks/Free-fall/cloud-particle.png',
        'blocks/Free-fall/puff-particle.png'
      ],
      debris: [
        'blocks/Free-fall/debris-1.png',
        'blocks/Free-fall/debris-2.png',
        'blocks/Free-fall/debris-3.png',
        'blocks/Free-fall/rubble-particle.png'
      ],
      magic: [
        'blocks/Free-fall/magic-sparkle.png',
        'blocks/Free-fall/mystic-orb.png',
        'blocks/Free-fall/energy-particle.png',
        'blocks/Free-fall/aura-particle.png'
      ]
    };
    
    const textures: string[] = [];
    const availableTextures = effectTextures[effectType] || this._defaultFragments;
    
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availableTextures.length);
      textures.push(availableTextures[randomIndex]);
    }
    
    return textures;
  }

  /**
   * Get texture based on answer correctness
   */
  public getAnswerFragmentTextures(isCorrect: boolean, count: number = 4): string[] {
    if (isCorrect) {
      // Sparkly, positive textures for correct answers
      return this.getFragmentTextures('blocks/emerald-block.png', count);
    } else {
      // Fiery, negative textures for wrong answers
      return this.getFragmentTextures('blocks/fire/fire_01.png', count);
    }
  }

  /**
   * Register custom texture variations
   */
  public registerTextureVariations(blockTexture: string, fragmentTextures: string[]): void {
    this._textureVariations[blockTexture] = fragmentTextures;
  }
}