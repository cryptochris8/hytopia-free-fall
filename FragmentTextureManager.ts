/**
 * Fragment Texture Manager - Manages varied textures for fragment effects
 */
export class FragmentTextureManager {
  private static _instance: FragmentTextureManager;
  
  // Texture variations for different block types
  private readonly _textureVariations: Record<string, string[]> = {
    // Stone-like blocks
    'assets/blocks/stone.png': [
      'assets/blocks/stone.png',
      'assets/blocks/cobblestone.png',
      'assets/blocks/gravel.png',
      'assets/blocks/Free-fall/0.png',
      'assets/blocks/Free-fall/1.png'
    ],
    
    // Wood-like blocks
    'blocks/oak-planks.png': [
      'assets/blocks/oak-planks.png',
      'assets/blocks/Free-fall/2.png',
      'assets/blocks/Free-fall/3.png',
      'assets/blocks/Free-fall/4.png'
    ],
    
    // Glass-like blocks
    'assets/blocks/glass.png': [
      'assets/blocks/glass.png',
      'assets/blocks/Free-fall/5.png',
      'assets/blocks/Free-fall/6.png',
      'assets/blocks/Free-fall/7.png'
    ],
    
    // Metal/Ore blocks
    'assets/blocks/iron-ore.png': [
      'assets/blocks/iron-ore.png',
      'assets/blocks/Free-fall/8.png',
      'assets/blocks/Free-fall/9.png',
      'assets/blocks/Free-fall/10.png'
    ],
    
    // Special blocks (emerald for correct answers)
    'assets/blocks/emerald-block.png': [
      'assets/blocks/emerald-block.png',
      'assets/blocks/Free-fall/11.png',
      'assets/blocks/Free-fall/12.png',
      'assets/blocks/Free-fall/13.png'
    ],
    
    // Fire blocks (for wrong answers)
    'assets/blocks/fire/fire_01.png': [
      'assets/blocks/fire/fire_01.png',
      'assets/blocks/Free-fall/14.png',
      'assets/blocks/Free-fall/15.png',
      'assets/blocks/fire/fire2.png'
    ]
  };
  
  // Default fragments for blocks without specific variations
  private readonly _defaultFragments: string[] = [
    'assets/blocks/Free-fall/0.png',
    'assets/blocks/Free-fall/1.png',
    'assets/blocks/Free-fall/2.png',
    'assets/blocks/Free-fall/3.png'
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
        'assets/blocks/Free-fall/4.png',
        'assets/blocks/Free-fall/5.png',
        'assets/blocks/diamond-block.png',
        'assets/blocks/emerald-block.png'
      ],
      dust: [
        'assets/blocks/Free-fall/6.png',
        'assets/blocks/Free-fall/7.png',
        'assets/blocks/sand.png',
        'assets/blocks/gravel.png'
      ],
      debris: [
        'assets/blocks/Free-fall/8.png',
        'assets/blocks/Free-fall/9.png',
        'assets/blocks/Free-fall/10.png',
        'assets/blocks/cobblestone.png'
      ],
      magic: [
        'assets/blocks/Free-fall/11.png',
        'assets/blocks/Free-fall/12.png',
        'assets/blocks/swirl-rune.png',
        'assets/blocks/emerald-block.png'
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
      return this.getFragmentTextures('assets/blocks/emerald-block.png', count);
    } else {
      // Fiery, negative textures for wrong answers
      return this.getFragmentTextures('assets/blocks/fire/fire_01.png', count);
    }
  }

  /**
   * Register custom texture variations
   */
  public registerTextureVariations(blockTexture: string, fragmentTextures: string[]): void {
    this._textureVariations[blockTexture] = fragmentTextures;
  }
}