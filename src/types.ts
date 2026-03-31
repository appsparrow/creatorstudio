// ============================================================================
// Core Types — CreatorStudio
// ============================================================================

// --- Persona ---

export interface Persona {
  id: string;
  identity: {
    fullName: string;
    age: number;
    gender: string;
    nationality: string;
    birthplace: string;
    profession: string;
    locations: string[];
  };
  appearance: {
    height: string;
    bodyType: string;
    faceShape: string;
    eyes: string;
    hair: string;
    distinctFeatures: string[];
  };
  psychographic: {
    coreTraits: string[];
    interests: string[];
    values: string[];
    fears: string[];
    motivations: string[];
    mission: string;
  };
  backstory: string;
  fashionStyle: {
    aesthetic: string;
    signatureItems: string[];
    photographyStyle: string;
  };
  lifestyle: {
    routine: string;
    diet: string;
    pet?: string;
    socialMediaPresence: string;
  };
  socialHandles?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    twitter?: string;
    x?: string;
  };
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  aiAnalysis?: string;
  targetAudiences?: TargetAudience[];
  contentThemes?: string[];
  friends?: PersonaFriend[];
  // Per-persona settings
  driveFolderUrl?: string;
  postingMode?: 'manual' | 'auto';
  postingTime?: string;
  postingEndTime?: string;
  postsPerDay?: number;
}

export interface PersonaFriend {
  id: string;
  name: string;
  imageUrl?: string;
  traits: string[];
  profession?: string;
  relationship?: string;
}

// --- Target Audience ---

export interface TargetAudience {
  id: string;
  personaId: string;
  segmentName: string;
  ageRange: string;
  genderSkew: string;
  locations: string[];
  coreAspiration: string;
  painPoints: string[];
  contentResonanceNotes: string;
}

// --- Product / Affiliate ---

export interface Product {
  id: string;
  personaId: string;
  name: string;
  brand: string;
  category: string;
  productUrl: string;
  affiliateUrl: string;
  imageUrl: string;
  visualDescription: string;
  usageContext: string[];
  notes: string;
  isPaidPartnership: boolean;
  disclosureTag: string;
  featuredCount: number;
  active: boolean;
}

// --- Content Day ---

export type StoryArc = 'Beautiful Day' | 'Real Moment' | 'Achievement' | 'Lesson' | 'Invitation';
export type CaptionTone = 'Aspirational' | 'Relatable' | 'Educational' | 'Vulnerable' | 'Playful';
export type ContentType = 'Photo' | 'Carousel' | 'Video';
export type ContentStatus = 'draft' | 'generating' | 'completed' | 'published';
export type Platform = 'Instagram' | 'TikTok' | 'YouTube';

export interface FeaturedProduct {
  productId: string;
  placementType: string;
  captionMention: 'subtle' | 'direct' | 'affiliate-link' | 'none';
  imagePromptInjection: string;
}

export interface CarouselSlide {
  id: string;
  sceneDescription: string;
  onScreenText: string;
  contentType: 'Photo' | 'Video';
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
}

export interface ContentDay {
  id: string;
  dayNumber: number;
  date: string;
  platforms: Platform[];
  theme: string;
  sceneDescription: string;
  onScreenText: string;
  caption: string;
  hook: string;
  hashtags: string;
  cta: string;
  location: string;
  musicSuggestion: string;
  notes: string;
  contentType: ContentType;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  customMediaUrl?: string;
  pendingVideoTaskId?: string;
  status: ContentStatus;
  personaId: string;
  styleOption?: string;
  isAIGenerated?: boolean;
  isGoodToPost?: boolean;
  postImageReferences?: { id: string; url: string; tag: 'Location' | 'Style' | 'FaceSwap' | 'None' }[];
  slides?: CarouselSlide[];
  hairstyle?: string;
  textPosition?: 'top' | 'middle' | 'bottom';
  // MVP1 additions
  storyArc?: StoryArc;
  targetAudienceSegment?: string;
  captionTone?: CaptionTone;
  audienceMirrorHook?: string;
  featuredProducts?: FeaturedProduct[];
}

// --- User Settings ---

export interface UserSettings {
  blotatoApiKey?: string;
  klingApiKey?: string;
  klingApiSecret?: string;
  nanobananaApiKey?: string;
  driveFolderUrl?: string;
  postingMode?: 'manual' | 'auto';
  postingTime?: string;
  postingEndTime?: string;
  postsPerDay?: number;
  publicTunnelUrl?: string;
}

// --- Drive Asset ---

export interface DriveAsset {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveUrl: string;
  thumbnailUrl: string;
  contentType: ContentType;
  status: 'unused' | 'linked' | 'archived';
  linkedDayId?: string;
  syncedAt: string;
}
