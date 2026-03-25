export interface CarouselSlide {
  id: string;
  sceneDescription: string;
  onScreenText: string;
  contentType: 'Photo' | 'Video'; // A slide can be an image or a short video clip
  generatedImageUrl?: string;
  generatedVideoUrl?: string; // fallback in case video is created
}

export interface ContentDay {
  id: string;
  dayNumber: number;
  date: string;
  platforms: ('Instagram' | 'TikTok' | 'YouTube')[];
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
  contentType: 'Photo' | 'Carousel' | 'Video';
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  pendingVideoTaskId?: string; // set while Kling is rendering; cleared when video lands
  status: 'draft' | 'generating' | 'completed';
  personaId: string;
  styleOption?: string;
  isAIGenerated?: boolean;
  isGoodToPost?: boolean;
  postImageReferences?: { id: string; url: string; tag: 'Location' | 'Style' | 'FaceSwap' | 'None' }[];
  slides?: CarouselSlide[];
  hairstyle?: string;
}



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
}

