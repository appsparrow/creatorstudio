// ============================================================================
// UGC Pipeline Types
// ============================================================================

export type UGCPipelineMode = 'auto' | 'hitl';
export type UGCStepStatus = 'pending' | 'running' | 'complete' | 'paused' | 'error' | 'edited';
export type UGCStepName = 'product_intel' | 'strategy' | 'script' | 'visuals' | 'audio' | 'metadata';

export const UGC_STEP_LABELS: Record<UGCStepName, string> = {
  product_intel: 'Product Intel',
  strategy: 'Strategy',
  script: 'Script',
  visuals: 'Visual Prompts',
  audio: 'Audio Direction',
  metadata: 'Metadata',
};

export const UGC_STEP_ORDER: UGCStepName[] = [
  'product_intel', 'strategy', 'script', 'visuals', 'audio', 'metadata',
];

export interface UGCPipelineRun {
  id: string;
  personaId: string;
  productUrl: string;
  mode: UGCPipelineMode;
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  steps: UGCPipelineStep[];
  productIntel?: ProductIntel;
  strategy?: ContentStrategy;
  script?: VideoScript;
  visuals?: VisualPackage;
  audio?: AudioPackage;
  metadata?: MetadataPackage;
  contentDayId?: string;
}

export interface UGCPipelineStep {
  name: UGCStepName;
  status: UGCStepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  output?: unknown;
  userEdits?: unknown;
  error?: string;
}

// --- Step 1: Product Intel ---

export interface ProductIntel {
  productName: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  currency: string;
  size?: string;
  keyFeatures: string[];
  primaryBenefit: string;
  painPointsSolved: string[];
  reviewSentiment: {
    positive: string[];
    negative: string[];
  };
  competitorProducts: { name: string; price: number }[];
  targetAudience: string;
  trendingStatus: boolean;
  sourceUrl: string;
}

// --- Step 2: Strategy ---

export interface ContentStrategy {
  hookFormat: 'price_reveal' | 'pov' | 'discovery' | 'social_proof' | 'comparison' | 'opinion';
  hookRationale: string;
  contentFormat: string;
  contentRationale: string;
  videoLength: string;
  setting: string;
  characterOutfit: string;
  optimalPostingTime: string;
  postingRationale: string;
  hashtagStrategy: {
    primary: string;
    conversion: string;
    product: string;
    brand: string;
    modifier: string;
  };
}

// --- Step 3: Script ---

export interface HookVariation {
  hook: string;
  score: number;
  rationale: string;
}

export interface ScriptSection {
  timing: string;
  wordCount: number;
  textOverlay: string;
  voiceover: string;
  visualCue: string;
}

export interface VideoScript {
  hookVariants: HookVariation[];
  selectedHook: string;
  fullScript: {
    hookSection: ScriptSection;
    productSection: ScriptSection;
    trustSection: ScriptSection;
    ctaSection: ScriptSection;
  };
  totalWordCount: number;
  estimatedDuration: string;
  elevenlabsFullScript: string;
  elevenlabsSettings: {
    voiceStability: number;
    voiceClarity: number;
    style: string;
    speed?: number;
  };
}

// --- Step 4: Visuals ---

export interface ShotPrompt {
  shotId: string;
  timing: string;
  purpose: string;
  fullPrompt: string;
  compositionNotes: string;
  lighting: string;
  props: string[];
  generatedImageUrl?: string;
  visualCue?: string;
  voiceover?: string;
}

export interface VisualPackage {
  baseCharacterPrompt: string;
  shotPrompts: ShotPrompt[];
  consistencyChecklist: string[];
  fullAudioScript?: string;
  imageGenerationSettings: {
    platform: string;
    resolution: string;
    aspectRatio: string;
    quality: string;
    style: string;
  };
}

// --- Step 5: Audio ---

export interface AudioPackage {
  elevenlabsPayload: {
    voiceId: string;
    text: string;
    voiceSettings: {
      stability: number;
      similarityBoost: number;
      style: number;
      useSpeakerBoost: boolean;
    };
    outputFormat: string;
    speed?: number;
    recommendedStockVoice?: {
      name: string;
      voiceId: string;
    };
  };
  trendingSoundOptions: {
    soundName: string;
    categoryFit: string;
    recommended: boolean;
    notes: string;
  }[];
  audioMixingInstructions: {
    voiceoverVolume: string;
    backgroundSoundVolume: string;
    fadeInDuration: string;
    fadeOutDuration: string;
    voiceoverPriority: boolean;
    duckingEnabled?: boolean;
    duckAmountDb?: number;
  };
  finalAudioSpecs?: {
    totalDuration: string;
    format: string;
    sampleRate: string;
    bitrate: string;
    channels: string;
    loudnessTarget: string;
  };
}

// --- Step 6: Metadata ---

export interface MetadataPackage {
  tiktok: {
    title: string;
    titleCharCount: number;
    caption: string;
    captionCharCount?: number;
    hashtags: { tag: string; type: string; rationale: string }[];
    productTags?: { productName: string; variant: string; price: string; tagPlacement: string; tagTiming: string }[];
    postingSchedule: { optimalTime: string; dayOfWeek: string; rationale: string; backupTimes: string[] };
    engagementStrategy: {
      pinComment: string;
      autoReplyTriggers: { keyword: string; response: string }[];
    };
  };
  instagram: {
    caption: string;
    hashtagsCount: number;
    brandMentions: string[];
  };
}
