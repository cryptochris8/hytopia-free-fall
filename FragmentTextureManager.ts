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
      'blocks/Free-fall/0.png',
      'blocks/Free-fall/1.png'
    ],
    
    // Wood-like blocks
    'blocks/oak-planks.png': [
      'blocks/oak-planks.png',
      'blocks/Free-fall/2.png',
      'blocks/Free-fall/3.png',
      'blocks/Free-fall/4.png'
    ],
    
    // Glass-like blocks
    'blocks/glass.png': [
      'blocks/glass.png',
      'blocks/Free-fall/5.png',
      'blocks/Free-fall/6.png',
      'blocks/Free-fall/7.png'
    ],
    
    // Metal/Ore blocks
    'blocks/iron-ore.png': [
      'blocks/iron-ore.png',
      'blocks/Free-fall/8.png',
      'blocks/Free-fall/9.png',
      'blocks/Free-fall/10.png'
    ],
    
    // Special blocks (emerald for correct answers)
    'blocks/emerald-block.png': [
      'blocks/emerald-block.png',
      'blocks/Free-fall/11.png',
      'blocks/Free-fall/12.png',
      'blocks/Free-fall/13.png'
    ],
    
    // Fire blocks (for wrong answers)
    'blocks/fire/fire_01.png': [
      'blocks/fire/fire_01.png',
      'blocks/Free-fall/14.png',
      'blocks/Free-fall/15.png',
      'blocks/fire/fire2.png'
    ]
  };
  
  // Default fragments for blocks without specific variations
  private readonly _defaultFragments: string[] = [
    'blocks/Free-fall/0.png',
    'blocks/Free-fall/1.png',
    'blocks/Free-fall/2.png',
    'blocks/Free-fall/3.png'
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
        'blocks/Free-fall/4.png',
        'blocks/Free-fall/5.png',
        'blocks/diamond-block.png',
        'blocks/emerald-block.png'
      ],
      dust: [
        'blocks/Free-fall/6.png',
        'blocks/Free-fall/7.png',
        'blocks/sand.png',
        'blocks/gravel.png'
      ],
      debris: [
        'blocks/Free-fall/8.png',
        'blocks/Free-fall/9.png',
        'blocks/Free-fall/10.png',
        'blocks/cobblestone.png'
      ],
      magic: [
        'blocks/Free-fall/11.png',
        'blocks/Free-fall/12.png',
        'blocks/swirl-rune.png',
        'blocks/emerald-block.png'
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