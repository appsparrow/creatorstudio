import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Image as ImageIcon, 
  Send, 
  Layout, 
  Calendar, 
  Instagram, 
  Music, 
  MapPin, 
  Type, 
  Hash, 
  Sparkles,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Loader2,
  UserCircle2,
  Camera,
  Youtube,
  Smartphone,
  FileJson,
  Settings2,
  Globe,
  User,
  Heart,
  Shirt,
  Coffee,
  X,
  AlertCircle,
  Video
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { ContentDay, Persona } from './types';
import { getAiInstance, GENERATION_MODEL } from './services/ai';
import { generateImageNanoBanana } from './services/nanobanana';
import { generateVideoKling } from './services/kling';

const VIDEO_HOOK_ANGLES = [
  "Overhead/Top-Down Shot (Camera placed directly above looking down on Action focus)",
  "Push In / Zoom In (with slow motion, camera slowly moving closer to create tension)",
  "Walking Into Frame (starting with empty scene, subject steps into frame from side framing)",
  "Low-Angle/Floor Shot (places camera on ground and shoots upward)",
  "Action Close-Up (focus on hands doing actions lifting item into frame)"
];

const HAIRSTYLES = [
  "Sleek High Ponytail (polished, perfectly straight with a wrap-around hair tie, and zero flyaways)",
  "Textured Messy Topknot (high, loose, undone bun with voluminous texture and a few piecey tendrils framing the face)",
  "Romantic Side-Swept Updo (intricate, formal low updo with soft, defined curls swept to one side and a textured top)",
  "Glossy Center-Parted Straight (hair parted dead down the middle, styled with a glass-like shine, and perfectly pin-straight)",
  "Voluminous Red-Carpet Waves (long, dramatic, full-bodied glamorous waves with lots of bounce and a deep side part)",
  "Polished Halo Crown Braid (single, neat braid that wraps entirely around the head like a halo)",
  "Piecey Textured Bun (casual-chic high bun, textured with loose, styled face-framing pieces for a relaxed yet intentional look)",
  "Sunkissed Beachy Waves (undone, textured waves with a beachy feel with high definition and separation)",
  "French Braid Chignon (elaborate updo featuring a side-swept French braid into a textured low chignon at the nape)",
  "Classic Dutch Braid Pigtails (two tight, clean inside-out Dutch braids starting at the forehead and running down the back)",
  "Tousled Side-Braid Updo (low updo with a soft, messy side-braid integrated into a loose bun with romantic waves)"
];

const getRandomHairstyle = (defaultStyle: string) => {
  if (Math.random() < 0.4) return defaultStyle; 
  const idx = Math.floor(Math.random() * HAIRSTYLES.length);
  return HAIRSTYLES[idx];
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const compositeImageWithText = (base64: string, text: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width || 1024;
      canvas.height = img.height || 1024;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Removed text compositing to avoid superimposing text on the image

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64;
  });
};

const SOFIA_PERSONA: Persona = {
  id: 'persona_sofia_laurant_v1',
  identity: {
    fullName: "Sofia Laurant",
    age: 24,
    gender: "female",
    nationality: "Italian",
    birthplace: "Coastal town near Portofino, Italy",
    profession: "Lifestyle creator and design influencer",
    locations: ["Milan", "Paris", "Lisbon", "New York"]
  },
  appearance: {
    height: "5'8\"",
    bodyType: "slim toned feminine",
    faceShape: "oval",
    eyes: "green-hazel almond",
    hair: "dark blonde with golden highlights, chest length",
    distinctFeatures: ["high cheekbones", "soft jawline", "natural full lips", "warm confident smile"]
  },
  psychographic: {
    coreTraits: ["kind", "charismatic", "warm", "curious", "creative", "optimistic"],
    interests: ["travel", "design", "photography", "wellness"],
    values: ["authenticity", "creativity", "kindness", "beauty in everyday life"],
    fears: ["loss of authenticity", "stagnation"],
    motivations: ["inspiring others", "creative expression"],
    mission: "Inspire women to live elegantly while staying authentic and grounded."
  },
  backstory: "Raised in a coastal Mediterranean town surrounded by historic architecture, cafés, and seaside landscapes.",
  fashionStyle: {
    aesthetic: "modern European elegance with minimalism",
    signatureItems: ["tailored blazers", "silk dresses"],
    photographyStyle: "candid lifestyle photography"
  },
  lifestyle: {
    routine: "morning coffee on balcony",
    diet: "Mediterranean lifestyle diet",
    pet: "Milo (cockapoo)",
    socialMediaPresence: "Instagram, TikTok, YouTube"
  },
  referenceImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
  referenceImageUrls: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'
  ]
};

const DEFAULT_PERSONA = (): Persona => ({
  id: generateUUID(),
  identity: {
    fullName: "New Persona",
    age: 25,
    gender: "female",
    nationality: "Global",
    birthplace: "Unknown",
    profession: "Creator",
    locations: ["Remote"]
  },
  appearance: {
    height: "5'7\"",
    bodyType: "Average",
    faceShape: "Oval",
    eyes: "Brown",
    hair: "Brown",
    distinctFeatures: []
  },
  psychographic: {
    coreTraits: ["Creative"],
    interests: [],
    values: ["Authenticity"],
    fears: [],
    motivations: [],
    mission: "Create inspiring content."
  },
  backstory: "A new creator starting their journey.",
  fashionStyle: {
    aesthetic: "Casual",
    signatureItems: [],
    photographyStyle: "Natural"
  },
  lifestyle: {
    routine: "Daily creation",
    diet: "Healthy",
    socialMediaPresence: "Instagram"
  },
  referenceImageUrl: 'https://picsum.photos/seed/new-persona/400/400',
  referenceImageUrls: []
});

const INITIAL_DAY = (personaId: string): ContentDay => ({
  id: generateUUID(),
  dayNumber: 1,
  date: new Date().toISOString().split('T')[0],
  platforms: ['Instagram'],
  theme: 'Lifestyle - New Journey',
  sceneDescription: 'A young woman looking thoughtfully out of a window in a sunlit room, holding a coffee cup. Warm tones, soft focus background.',
  onScreenText: 'This page started with inspiration.\nNow it\'s becoming my story.',
  caption: 'For a long time I admired creators who turn everyday moments into something beautiful...',
  hook: 'The start of something new.',
  hashtags: '#NewJourney #LifestyleCreator #InspiredLiving',
  cta: 'Follow along & drop your city below 👇',
  location: 'Home / Cosy Café',
  musicSuggestion: 'Soft acoustic guitar',
  notes: 'Warm tones, soft bokeh background. Genuine, not posed.',
  contentType: 'Photo',
  status: 'draft',
  personaId
});

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([SOFIA_PERSONA]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(SOFIA_PERSONA.id);
  const [days, setDays] = useState<ContentDay[]>([INITIAL_DAY(SOFIA_PERSONA.id)]);
  const [selectedDayId, setSelectedDayId] = useState<string>(days[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [dayPrompt, setDayPrompt] = useState('');
  const [importJson, setImportJson] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [importStartDate, setImportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [avoidDuplicates, setAvoidDuplicates] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [videoStatus, setVideoStatus] = useState<Record<string, 'idle'|'submitted'|'processing'|'done'|'failed'>>({});
  const [previewSlideIndex, setPreviewSlideIndex] = useState<Record<string, number>>({});
  const [isAIGeneratingDay, setIsAIGeneratingDay] = useState(false);
  const [showGenerationChoice, setShowGenerationChoice] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>(localStorage.getItem('n8n_webhook_url') || '');
  const [publicTunnelUrl, setPublicTunnelUrl] = useState<string>(localStorage.getItem('public_tunnel_url') || '');
  const [klingApiKey, setKlingApiKey] = useState<string>(localStorage.getItem('kling_api_key') || '');
  const [klingApiSecret, setKlingApiSecret] = useState<string>(localStorage.getItem('kling_api_secret') || '');
  const [klingVariant, setKlingVariant] = useState<'kling-v1' | 'kling-v1-5' | 'kling-v1-pro' | 'kling-v2'>(
    (localStorage.getItem('kling_variant') as any) || 'kling-v1-5'
  );
  const [nanobananaApiKey, setNanobananaApiKey] = useState<string>(localStorage.getItem('nanobanana_api_key') || '');
  const [activeImageModel, setActiveImageModel] = useState<'gemini' | 'nanobanana'>(localStorage.getItem('active_image_model') as any || 'gemini');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'dashboard' | 'settings'>('dashboard');
  const [nanobananaVariant, setNanobananaVariant] = useState<'standard' | 'v2'>(localStorage.getItem('nanobanana_variant') as any || 'standard');





  useEffect(() => {
    const checkKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true); // Fallback for local dev if env var exists
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pre = await fetch('/api/personas');
        const pData = await pre.json();
        if (pData.length > 0) setPersonas(pData); else fetch('/api/personas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(SOFIA_PERSONA) });

        const dre = await fetch('/api/days');
        const dData = await dre.json();
        if (dData.length > 0) {
          setDays(dData);
          if (dData[0]) setSelectedDayId(dData[0].id);
          // Restore in-progress video statuses from persisted pendingVideoTaskId
          const pending: Record<string, 'idle'|'submitted'|'processing'|'done'|'failed'> = {};
          dData.forEach((d: any) => {
            if (d.pendingVideoTaskId && !d.generatedVideoUrl) {
              pending[d.id] = 'processing';
            }
          });
          if (Object.keys(pending).length > 0) setVideoStatus(pending);
        } else {
           const init = INITIAL_DAY(SOFIA_PERSONA.id);
           setDays([init]);
           setSelectedDayId(init.id);
           fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init) });
        }
      } catch (e) {
        console.error("DB Fetch Error:", e);
      }
    };
    fetchData();
  }, []);

  const selectedPersona = personas.find(p => p.id === selectedPersonaId) || personas[0];
  const personaDays = days
    .filter(d => d.personaId === selectedPersonaId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const selectedDay = days.find(d => d.id === selectedDayId) || personaDays[0] || days[0];


  const updateDay = (id: string, updates: Partial<ContentDay>) => {
    setDays(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, ...updates } : d);
      const current = updated.find(d => d.id === id);
      if (current) fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
      return updated;
    });
  };

  const fetchGoogleSheet = async () => {
    setIsAIGeneratingDay(true);
    try {
      const sheetId = '1hplAu2wnW1AliTBuZ8ScdHDKNQAxzgGC';
      const sheetName = '30-Day Content Calendar';
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
      
      const response = await fetch(url);
      const data = await response.text();
      const match = data.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      
      if (!match) throw new Error("Could not parse Google Sheet response");
      
      const json = JSON.parse(match[1]);
      const rows = json.table.rows;
      
      const newDays: ContentDay[] = [];
      rows.forEach((r: any, index: number) => {
        const c = r.c;
        const getValue = (idx: number) => {
          if (!c[idx]) return '';
          if (c[idx].v === null || c[idx].v === undefined) return '';
          return c[idx].v;
        };
        
        // Skip strictly empty rows
        const hasData = c.some((cell: any) => cell && cell.v !== null && cell.v !== undefined && cell.v !== '');
        if (!hasData) return;

        
        const dayNum = parseInt(getValue(0).toString());
        const rowTheme = getValue(4).toString();
        
        // Check Duplicate
        const isDuplicate = days.some(d => 
            d.personaId === selectedPersonaId && 
            (d.theme === rowTheme || d.dayNumber === dayNum)
        );
        if (avoidDuplicates && isDuplicate) return; 

        const dayOffset = Math.floor(index / postsPerDay);
        const calcDate = new Date(importStartDate);
        calcDate.setDate(calcDate.getDate() + dayOffset);
        const formattedDate = calcDate.toISOString().split('T')[0];

        newDays.push({
          id: generateUUID(),
          dayNumber: isNaN(dayNum) ? (index + 1) : dayNum,
          date: formattedDate,
          platforms: [getValue(2).toString() || 'Instagram'],
          contentType: getValue(3).toString() || 'Photo',
          theme: getValue(4).toString() || '',
          sceneDescription: getValue(5).toString() || '',
          hook: getValue(6).toString() || '',
          onScreenText: getValue(7).toString() || '',
          caption: getValue(8).toString() || '',
          hashtags: getValue(9).toString() || '',
          cta: getValue(10).toString() || '',
          location: getValue(11).toString() || '',
          musicSuggestion: getValue(12).toString() || '',
          notes: getValue(13).toString() || '',
          status: 'draft',
          personaId: selectedPersonaId
        });
      });

      if (newDays.length > 0) {
        try {
            // Save each day to backend database
            for (const day of newDays) {
                await fetch('/api/days', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(day)
                });
            }
        } catch (e) {
            console.error("Failed to save imported days to DB:", e);
        }

        setDays(prev => [...prev, ...newDays]);

        setSelectedDayId(newDays[0].id);
        setIsImportModalOpen(false);
        alert(`Successfully imported ${newDays.length} days from Google Sheet!`);
      } else {
        alert("No data found in sheet.");
      }
    } catch (error) {
      console.error("Sheet Import failed:", error);
      alert("Failed to import Google Sheet. Make sure it is Viewable and using correctly.");
    } finally {
      setIsAIGeneratingDay(false);
    }
  };

  const generateDayFromPrompt = async () => {

    if (!dayPrompt || !selectedPersona) return;
    setIsAIGeneratingDay(true);
    try {
      const ai = await getAiInstance();
      const prompt = `Build a social media content plan for one day based on this prompt: "${dayPrompt}".
      Persona: ${selectedPersona.identity.fullName}, ${selectedPersona.identity.profession}.
      Current Season: ${new Date().toLocaleDateString('en-US', { month: 'long' })}.
      Return a JSON object matching this structure:
      {
        "theme": "string",
        "sceneDescription": "string",
        "onScreenText": "string",
        "caption": "string",
        "hook": "string",
        "hashtags": "string",
        "cta": "string",
        "location": "string",
        "musicSuggestion": "string",
        "notes": "string",
        "contentType": "Photo" | "Carousel" | "Video",
        "slides": [
          { "sceneDescription": "string", "onScreenText": "string", "contentType": "Photo" }
        ]
      }
      Ensure:
      - If "Carousel" is chosen, "slides" MUST have 4 items with variations (e.g., close-up headshot, side profile, long-distance view standing) to fit a logical sequence story.
      - Ensure scenes describe unposed CANDID or action layout moments/angles (e.g. looking away, off-center framing, action closeups). The subject should NOT face the camera static all the time.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
      });

      let data = JSON.parse(response.text);

      if (data.contentType === 'Carousel' && (!data.slides || data.slides.length === 0)) {
         const desc = data.sceneDescription || '';
         const textOverlay = data.onScreenText || '';
         const matchSlides = desc.match(/Slide \d+ = ([^.]+)/g);
         const matchTexts = textOverlay.match(/Slide \d+: '([^']+)'/g);
         if (matchSlides && matchSlides.length > 0) {
             data.slides = matchSlides.map((m: string, idx: number) => {
                 const sceneText = m.split(' = ')[1];
                 const overlayText = matchTexts && matchTexts[idx] ? matchTexts[idx].match(/'([^']+)'/)?.[1] || '' : '';
                 return { sceneDescription: sceneText, onScreenText: overlayText, contentType: 'Photo' };
             });
         }
      }

      if (data.slides) {
         data.slides = data.slides.map((s: any) => ({ ...s, id: generateUUID() }));
      }
      const newDay: ContentDay = {
        ...INITIAL_DAY(selectedPersonaId),
        id: generateUUID(),
        dayNumber: personaDays.length + 1,
        date: new Date().toISOString().split('T')[0],
        ...data,
        hairstyle: getRandomHairstyle(selectedPersona.appearance.hair),
        isAIGenerated: true,
        status: 'draft'
      };
      // Save immediately to DB
      fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDay) });

      setDays([...days, newDay]);
      setSelectedDayId(newDay.id);
      setIsPromptModalOpen(false);
      setDayPrompt('');
    } catch (error) {
      console.error("Failed to generate day:", error);
      alert("Failed to generate content plan. Please try again.");
    } finally {
      setIsAIGeneratingDay(false);
    }
  };

  const addNewDay = () => {
    const newDay = INITIAL_DAY(selectedPersonaId);
    newDay.hairstyle = getRandomHairstyle(selectedPersona.appearance.hair);
    newDay.dayNumber = personaDays.length + 1;
    
    if (personaDays.length > 0) {
      const lastDay = personaDays[personaDays.length - 1];
      if (lastDay.date) {
        try {
          const nextDate = new Date(lastDay.date);
          nextDate.setDate(nextDate.getDate() + 1);
          newDay.date = nextDate.toISOString().split('T')[0];
        } catch (e) {}
      }
    }

    fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDay) });
    setDays([...days, newDay]);
    setSelectedDayId(newDay.id);
  };


  const deleteDay = (id: string) => {
    if (days.length === 1) return;
    fetch(`/api/days/${id}`, { method: 'DELETE' });
    const newDays = days.filter(d => d.id !== id);
    setDays(newDays);
    if (selectedDayId === id) {
      const remainingForPersona = newDays.filter(d => d.personaId === selectedPersonaId);
      setSelectedDayId(remainingForPersona.length > 0 ? remainingForPersona[0].id : newDays[0].id);
    }
  };

  const addNewPersona = () => {
    const newPersona = DEFAULT_PERSONA();
    setPersonas([...personas, newPersona]);
    setSelectedPersonaId(newPersona.id);
  };

  const deletePersona = (id: string) => {
    if (personas.length <= 1) {
      alert("You must have at least one persona.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this persona and all of its associated days?")) return;
    
    fetch(`/api/personas/${id}`, { method: 'DELETE' });
    const newPersonas = personas.filter(p => p.id !== id);
    setPersonas(newPersonas);
    const newDays = days.filter(d => d.personaId !== id);
    setDays(newDays);
    
    const nextPersonaId = newPersonas[0].id;
    setSelectedPersonaId(nextPersonaId);
    if (!newDays.some(d => d.personaId === nextPersonaId)) {
      const init = INITIAL_DAY(nextPersonaId);
      setDays([...newDays, init]);
      setSelectedDayId(init.id);
      fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init) });
    } else {
      setSelectedDayId(newDays.find(d => d.personaId === nextPersonaId)?.id || newDays[0].id);
    }
    setIsPersonaModalOpen(false);
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson);
      
      // If the JSON contains persona data, update or add the persona
      if (data.persona_id || data.identity) {
        const importedPersona: Persona = {
          id: data.persona_id || generateUUID(),
          identity: {
            fullName: data.identity?.full_name || data.identity?.fullName || "Imported Persona",
            age: data.identity?.age || 25,
            gender: data.identity?.gender || "female",
            nationality: data.identity?.nationality || "Unknown",
            birthplace: data.identity?.birthplace || "Unknown",
            profession: data.identity?.profession || "Creator",
            locations: data.identity?.current_locations || data.identity?.locations || []
          },
          appearance: {
            height: data.appearance?.height || "",
            bodyType: data.appearance?.body_type || data.appearance?.bodyType || "",
            faceShape: data.appearance?.face_shape || data.appearance?.faceShape || "",
            eyes: data.appearance?.eyes || "",
            hair: data.appearance?.hair || "",
            distinctFeatures: data.appearance?.distinct_features || data.appearance?.distinctFeatures || []
          },
          psychographic: {
            coreTraits: data.psychographic?.core_traits || data.psychographic?.coreTraits || [],
            interests: data.psychographic?.interests || [],
            values: data.psychographic?.values || [],
            fears: data.psychographic?.fears || [],
            motivations: data.psychographic?.motivations || [],
            mission: data.psychographic?.mission || ""
          },
          backstory: data.backstory || "",
          fashionStyle: {
            aesthetic: data.fashion_style?.aesthetic || data.fashionStyle?.aesthetic || "",
            signatureItems: data.fashion_style?.signature_items || data.fashionStyle?.signatureItems || [],
            photographyStyle: data.fashion_style?.photography_style || data.fashionStyle?.photographyStyle || ""
          },
          lifestyle: {
            routine: data.lifestyle?.routine || "",
            diet: data.lifestyle?.diet || "",
            pet: data.lifestyle?.pet || "",
            socialMediaPresence: data.lifestyle?.social_media_presence || data.lifestyle?.socialMediaPresence || ""
          },
          referenceImageUrl: data.reference_image_url || data.referenceImageUrl || `https://picsum.photos/seed/${data.persona_id || 'imported'}/400/400`,
          referenceImageUrls: data.reference_image_urls || data.referenceImageUrls || (data.reference_image_url ? [data.reference_image_url] : [])
        };

        const existingIdx = personas.findIndex(p => p.id === importedPersona.id);
        if (existingIdx >= 0) {
          const newPersonas = [...personas];
          newPersonas[existingIdx] = importedPersona;
          setPersonas(newPersonas);
        } else {
          setPersonas([...personas, importedPersona]);
        }
        setSelectedPersonaId(importedPersona.id);
      }

      // If the JSON contains content plan data
      const contentPlan = data.content_plan || data;
      const currentPersona = personas.find(p => p.id === (data.persona_id || selectedPersonaId)) || selectedPersona;
      
      if (contentPlan.months) {
        const newDays: ContentDay[] = [];
        let dayCount = 1;
        contentPlan.months.forEach((month: any) => {
          month.weeks.forEach((week: any) => {
            week.scenes.forEach((scene: any) => {
              newDays.push({
                id: generateUUID(),
                dayNumber: dayCount++,
                date: new Date().toISOString().split('T')[0],
                platforms: ['Instagram'],
                theme: scene.title || scene.activity || 'New Post',
                sceneDescription: `${scene.activity || ''} in ${scene.location || ''}. ${currentPersona.appearance.hair} ${currentPersona.appearance.bodyType}`,
                onScreenText: scene.title || '',
                caption: scene.caption || '',
                hook: (scene.caption || '').split('.')[0],
                hashtags: (scene.tags || []).join(' '),
                cta: 'Follow for more!',
                location: scene.location || '',
                musicSuggestion: 'Trending lifestyle audio',
                notes: 'Authentic, candid style.',
                contentType: (scene.type as any) || 'Photo',
                status: 'draft',
                personaId: data.persona_id || selectedPersonaId
              });
            });
          });
        });
        
        if (newDays.length > 0) {
          setDays(prev => [...prev, ...newDays]);

          setSelectedDayId(newDays[0].id);
        }
      }
      
      setIsImportModalOpen(false);
      setImportJson('');
    } catch (e) {
      console.error("Import error:", e);
      alert('Invalid JSON format or structure');
    }
  };

  const generateSingleImage = async (ai: any, prompt: string, text: string, styleOption?: string, extraReferenceUrls?: string[], personaIdOverride?: string) => {
    const finalStyle = styleOption || selectedDay?.styleOption || 'luxury';
    let finalPrompt = `${prompt} Style: ${finalStyle}. STRICTLY WEAR exactly what is described (e.g., Saree if stated). DO NOT add default jackets, suits, or blazers unless specified in prompt.`;

    
    if (selectedDay?.postImageReferences) {
        selectedDay.postImageReferences.forEach(ref => {
            if (ref.tag !== 'None') {
                finalPrompt += ` [Reference ${ref.tag} Image provided]`;
            }
        });
    }


    let imageUrl = '';

    if (activeImageModel === 'nanobanana' && nanobananaApiKey) {
      try {
        console.log("Using NanoBanana API...");
        const responseUrl = await generateImageNanoBanana({
          prompt: finalPrompt,
          type: (selectedPersona.referenceImageUrls?.length || selectedDay?.postImageReferences?.length) ? 'IMAGETOIAMGE' : 'TEXTTOIAMGE',
          imageUrls: [
            ...(selectedPersona.referenceImageUrls?.filter(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || []),
            ...(selectedDay?.postImageReferences?.filter(ref => ref.url && ref.url.startsWith('http')).map(ref => ref.url) || [])
          ],
          image_size: '4:5'
        }, nanobananaApiKey);


        if (responseUrl) imageUrl = responseUrl;
      } catch (e) {
        console.error("NanoBanana failed, falling back to Gemini:", e);
      }
    }

    if (!imageUrl) {
      console.log("Using Gemini API...");
      const parts: any[] = [{ text: finalPrompt }];
      const combinedUrls = [
          ...(selectedPersona.referenceImageUrls || []),
          ...(extraReferenceUrls || [])
      ].filter(Boolean);

      if (combinedUrls.length > 0) {
        for (const url of combinedUrls) {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
            });
            parts.push({ inlineData: { mimeType: blob.type, data: base64 } });
          } catch (e) {}
        }
      }

      const response = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: { parts },
        config: { imageConfig: { aspectRatio: "9:16", imageSize: "1K" } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) throw new Error("No image generated");

    // Composite with Canvas
    const compositedBase64 = await compositeImageWithText(imageUrl, text);

    // Save to Server
    const filename = `${generateUUID()}.png`;
    const savedResp = await fetch('/api/images/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: compositedBase64, filename, personaId: personaIdOverride || selectedPersona.id })
    });
    const savedData = await savedResp.json();
    return savedData.url;
  };


  const generateCarouselDetails = async (dayId: string) => {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    setIsGenerating(true);
    try {
      const ai = await getAiInstance();
      const prompt = `Based on this content plan for a day: Theme "${day.theme}", Scene "${day.sceneDescription}".
      Generate 4 individual slide descriptions and onScreenText for a Carousel Post for ${selectedPersona.identity.fullName}.
      Ensureclothing details/options are highly consistent.
      Return a JSON array resembling:
      [
         { "sceneDescription": "Detailed visual description of slide 1", "onScreenText": "Headline/Overlay text 1" }
      ]`;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
      });
      const slides = JSON.parse(response.text).map((s: any) => ({ ...s, id: generateUUID(), contentType: 'Photo' }));
      updateDay(dayId, { slides });
    } catch (e) {
      console.error("Failed to generate slides:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateContent = async () => {
    if (!selectedDay) return;
    if (hasApiKey === false) { await (window as any).aistudio.openSelectKey(); setHasApiKey(true); return; }

    setIsGenerating(true);
    setShowGenerationChoice(false);
    updateDay(selectedDay.id, { status: 'generating' });

    try {
      const ai = await getAiInstance();
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });

      if (selectedDay.contentType === 'Carousel' && selectedDay.slides && selectedDay.slides.length > 0) {
        const updatedSlides = [...selectedDay.slides];
        for (let i = 0; i < updatedSlides.length; i++) {
          const slide = updatedSlides[i];
          const slidePrompt = `Generate a high-quality social media image for ${selectedPersona.identity.fullName}. 
          Scene: ${slide.sceneDescription}. Month: ${currentMonth}. Location: ${selectedDay.location}.
          Persona Reference details: Appearance: ${selectedPersona.appearance.height}, ${selectedPersona.appearance.bodyType}.
          Hairstyle: ${selectedDay.hairstyle || selectedPersona.appearance.hair}.
          IMPORTANT: Maintain ABSOLUTE CONSISTENT clothing, outfit, accessories, and HAIRSTYLE across all slides - as if taken in a single photoshoot session. No outfit or hair changes.
          DO NOT ALTER THE FACE OR BASE FEATURES OF THE CHARACTER. STRICTLY USE REFERENCE IMAGE FOR IDENTITY.
          STYLE INSTRUCTION: Generate a CANDID, unposed shot. The subject should NOT look directly at the camera. Use diverse angles (mid-action, side-profile, over-the-shoulder, cinematic depth-of-field) to look natural and authentic like dynamic influencer photography.`;


          let extraRefs: string[] = [];
          if (i > 0 && updatedSlides[0].generatedImageUrl) {
              extraRefs.push(updatedSlides[0].generatedImageUrl);
          }
          const localUrl = await generateSingleImage(ai, slidePrompt, slide.onScreenText, undefined, extraRefs);
          updatedSlides[i] = { ...slide, generatedImageUrl: localUrl };
        }
        updateDay(selectedDay.id, { slides: updatedSlides, status: 'completed' });
      } else {
        const basePrompt = `Generate a high-quality social media ${selectedDay.contentType.toLowerCase()} image for ${selectedPersona.identity.fullName}.
        Theme: ${selectedDay.theme}. Scene: ${selectedDay.sceneDescription}. Location: ${selectedDay.location}.
        Persona Reference details: Appearance: ${selectedPersona.appearance.height}, ${selectedPersona.appearance.bodyType}.
        Hairstyle: ${selectedDay.hairstyle || selectedPersona.appearance.hair}.
        DO NOT ALTER THE FACE OR BASE FEATURES OF THE CHARACTER. STRICTLY USE REFERENCE IMAGE FOR IDENTITY.
        STYLE INSTRUCTION: Generate a CANDID, mid-action, or unposed shot. The subject must NOT be looking static at the camera. Use unique angles (side profiles, off-center framing, action closeups) to make it highly authentic and dynamic.`;


        const localUrl = await generateSingleImage(ai, basePrompt, selectedDay.onScreenText);
        
        let finalVideoUrl = '';
        if (selectedDay.contentType === 'Video' && klingApiKey && klingApiSecret) {
           try {
              const base = publicTunnelUrl || window.location.origin;
              const publicImageUrl = localUrl.startsWith('http') ? localUrl : `${base.endsWith('/') ? base.slice(0, -1) : base}${localUrl}`; 
              
              const randomAngle = VIDEO_HOOK_ANGLES[Math.floor(Math.random() * VIDEO_HOOK_ANGLES.length)];
              console.log("[App] Requesting Kling Video via Proxy for angle:", randomAngle);
              
              const resp = await fetch('/api/videos/generate', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    prompt: `Animate this scene naturally for 5 seconds. Camera Frame Angle: ${randomAngle}. Scene: ${selectedDay.sceneDescription}`,
                    image_url: publicImageUrl,
                    apiKey: klingApiKey,
                    apiSecret: klingApiSecret,
                    model_name: klingVariant,
                    publicTunnelUrl: publicTunnelUrl
                 })
              });
              const respText = await resp.text();
              console.log("[Kling Proxy Raw]:", respText);
              
              try {
                  const vData = JSON.parse(respText);
                  if (vData.url) {
                      finalVideoUrl = vData.url;
                  } else if (vData.error) {
                      throw new Error(vData.error);
                  }
              } catch (parseErr) {
                  throw new Error(`Kling Proxy Failed: ${respText.slice(0, 500)}... Check server logs for details.`);
              }
           } catch (e: any) {
              console.error("Kling Video Failed:", e);
              alert(`Kling Video Generation Failed: ${e.message}.`);
           }
        }

        updateDay(selectedDay.id, { 
            generatedImageUrl: localUrl, 
            status: 'completed'
        });
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      updateDay(selectedDay.id, { status: 'draft' });
    } finally {
      setIsGenerating(false);
      setShowGenerationChoice(false);
    }
  };

  const generateVideoOnly = async (dayId: string) => {
    const day = days.find(d => d.id === dayId);
    if (!day || !day.generatedImageUrl) return alert("Image must be generated first!");
    
    setVideoStatus(s => ({ ...s, [dayId]: 'submitted' }));
    updateDay(dayId, { pendingVideoTaskId: '__pending__' }); // mark as pending for status restore on refresh
    setIsGenerating(true);
    try {
        const base = publicTunnelUrl || window.location.origin;
        const publicImageUrl = day.generatedImageUrl.startsWith('http') ? day.generatedImageUrl : `${base.endsWith('/') ? base.slice(0, -1) : base}${day.generatedImageUrl}`; 
        const randomAngle = VIDEO_HOOK_ANGLES[Math.floor(Math.random() * VIDEO_HOOK_ANGLES.length)];
        
        console.log("[App] Requesting Kling Video Only via Proxy for angle:", randomAngle);
        
        const resp = await fetch('/api/videos/generate', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              prompt: `Animate this scene naturally for 5 seconds. ${day.sceneDescription ? `Scene: ${day.sceneDescription}.` : ''} ${day.caption ? `Context: ${day.caption.slice(0, 200)}.` : ''} Camera angle: ${randomAngle}. Keep the subject's expression and mood consistent with the image.`,
              image_url: publicImageUrl,
              apiKey: klingApiKey,
              apiSecret: klingApiSecret,
              model_name: klingVariant,
              publicTunnelUrl: publicTunnelUrl,
              dayId: dayId
           })
        });
        const respText = await resp.text();
        console.log("[Kling Proxy Only Raw]:", respText);
        
        try {
            const vData = JSON.parse(respText);
            if (vData.taskId) {
                console.log("[App] Task ID Submitted successfully:", vData.taskId);
                
                let attempts = 0;
                const maxAttempts = 100;
                while (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 10000)); // wait 10s
                    attempts++;
                    
                    console.log(`[App] Polling Task ${vData.taskId} ... Attempt ${attempts}/${maxAttempts}`);
                    // Update day to store actual taskId for status restoration
                    if (attempts === 1) updateDay(dayId, { pendingVideoTaskId: vData.taskId });
                    
                    const statusResp = await fetch(`/api/videos/status/${vData.taskId}`, {
                         headers: { 
                             'x-api-key': klingApiKey, 
                             'x-api-secret': klingApiSecret 
                         }
                    });
                    const statusData = await statusResp.json();
                    console.log("[App] Polling status reply:", JSON.stringify(statusData));
                    const status = statusData.task_status;
                    const videoUrl = statusData.video_url;

                     if (status === 'processing') {
                         setVideoStatus(s => ({ ...s, [dayId]: 'processing' }));
                     }
                    if (status === 'succeed') {
                         console.log("[App] Success! Saving video to local downloads folder...");
                         if (!videoUrl) throw new Error("Video success but no URL returned from Kling.");

                         const saveResp = await fetch('/api/videos/save', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ videoUrl, personaId: day.personaId })
                         });
                         const saveResult = await saveResp.json();
                         if (saveResult.url) {
                             setVideoStatus(s => ({ ...s, [dayId]: 'done' }));
                             updateDay(dayId, { generatedVideoUrl: saveResult.url, pendingVideoTaskId: undefined });
                             return;
                         } else {
                             throw new Error("Failed to save final file locally.");
                         }
                    } else if (status === 'failed') {
                         setVideoStatus(s => ({ ...s, [dayId]: 'failed' }));
                         throw new Error(`Kling Task Failed. Check Kling dashboard.`);
                    }
                    // status is 'submitted' or 'processing' - keep polling
                }
                throw new Error("Task timed out after 16 minutes. The video may still be processing in Kling dashboard.");
            } else if (vData.error) {
                throw new Error(vData.error);
            } else {
                throw new Error(`Kling starting failed: ${respText.slice(0,200)}`);
            }
        } catch (parseErr: any) {
            throw new Error(`Kling Proxy Failed: ${parseErr.message || respText.slice(0, 500)}`);
        }
    } catch (e: any) {
        console.error("Kling Video Only Failed:", e);
        alert(`Kling Video Generation Failed: ${e.message}`);
    } finally {
        setIsGenerating(false);
    }
  };

  if (hasApiKey === null) return <div className="h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans overflow-hidden">
      {/* Persona Modal */}
      <AnimatePresence>
        {isPersonaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-[#F3F4F6] flex justify-between items-center bg-white sticky top-0 z-10 w-full relative">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold">Persona: {selectedPersona.identity.fullName}</h3>
                </div>
                <button onClick={() => setIsPersonaModalOpen(false)} className="text-zinc-400 hover:text-black">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8">
                {/* Identity Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <User className="w-4 h-4" /> Identity
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Full Name</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.identity.fullName}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].identity.fullName = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Profession</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.identity.profession}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].identity.profession = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Age</label>
                      <input 
                        type="number"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.identity.age}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].identity.age = parseInt(e.target.value);
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Gender</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.identity.gender}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].identity.gender = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nationality</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.identity.nationality}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].identity.nationality = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Birthplace</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.identity.birthplace}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].identity.birthplace = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Appearance Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <Camera className="w-4 h-4" /> Appearance
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Height</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.appearance.height}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].appearance.height = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Face Shape</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.appearance.faceShape}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].appearance.faceShape = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Hair</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.appearance.hair}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].appearance.hair = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Eyes</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.appearance.eyes}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].appearance.eyes = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Body Type</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.appearance.bodyType}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].appearance.bodyType = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Psychographic Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <Sparkles className="w-4 h-4" /> Psychographics
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Core Traits (comma separated)</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.psychographic.coreTraits.join(', ')}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].psychographic.coreTraits = e.target.value.split(',').map(s => s.trim());
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Interests (comma separated)</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.psychographic.interests.join(', ')}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].psychographic.interests = e.target.value.split(',').map(s => s.trim());
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Style Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <Shirt className="w-4 h-4" /> Fashion & Style
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Aesthetic</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.fashionStyle.aesthetic}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].fashionStyle.aesthetic = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Photography Style</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.fashionStyle.photographyStyle}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].fashionStyle.photographyStyle = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Lifestyle Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <Coffee className="w-4 h-4" /> Lifestyle
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Routine</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.lifestyle.routine}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].lifestyle.routine = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Social Media Presence</label>
                      <input 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                        value={selectedPersona.lifestyle.socialMediaPresence}
                        onChange={e => {
                          const newPersonas = [...personas];
                          const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                          newPersonas[idx].lifestyle.socialMediaPresence = e.target.value;
                          setPersonas(newPersonas);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Social Handles Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <Globe className="w-4 h-4" /> Social Handles
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {['instagram', 'tiktok', 'youtube', 'twitter', 'x'].map(handle => (
                      <div key={handle} className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">{handle}</label>
                        <input 
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                          value={selectedPersona.socialHandles?.[handle as keyof typeof selectedPersona.socialHandles] || ''}
                          onChange={e => {
                            const newPersonas = [...personas];
                            const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                            if (!newPersonas[idx].socialHandles) newPersonas[idx].socialHandles = {};
                            (newPersonas[idx].socialHandles as any)[handle] = e.target.value;
                            setPersonas(newPersonas);
                          }}
                          placeholder={`@username`}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                {/* Reference Images Section */}

                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <ImageIcon className="w-4 h-4" /> Reference Images (Max 4)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Image URL {i + 1}</label>
                        <div className="flex gap-2 items-center">
                          <input 
                            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://..."
                            value={selectedPersona.referenceImageUrls?.[i] || ''}
                            onChange={e => {
                               const newPersonas = [...personas];
                               const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                               const urls = [...(newPersonas[idx].referenceImageUrls || [])];
                               urls[i] = e.target.value;
                               newPersonas[idx].referenceImageUrls = urls;
                               if (i === 0) newPersonas[idx].referenceImageUrl = e.target.value;
                               setPersonas(newPersonas);
                            }}
                          />
                          <label className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer flex items-center justify-center transition-colors">
                              <Camera className="w-4 h-4 text-zinc-600" />
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={async (e) => {
                                   const file = e.target.files?.[0];
                                   if (!file) return;
                                   const reader = new FileReader();
                                   reader.onloadend = async () => {
                                      const base64 = reader.result as string;
                                      const resp = await fetch('/api/images/save', {
                                         method: 'POST',
                                         headers: { 'Content-Type': 'application/json' },
                                         body: JSON.stringify({ 
                                           base64, 
                                           filename: `persona_${selectedPersonaId}_${i}_${Date.now()}.png`,
                                           personaId: selectedPersonaId
                                         })
                                      });
                                      const data = await resp.json();
                                      const newPersonas = [...personas];
                                      const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                                      const urls = [...(newPersonas[idx].referenceImageUrls || [])];
                                      urls[i] = data.url;
                                      newPersonas[idx].referenceImageUrls = urls;
                                      if (i === 0) newPersonas[idx].referenceImageUrl = data.url;
                                      setPersonas(newPersonas);
                                   };
                                   reader.readAsDataURL(file);
                                }}
                              />
                          </label>
                          {selectedPersona.referenceImageUrls?.[i] && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 flex-shrink-0">
                              <img src={selectedPersona.referenceImageUrls[i]} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Mission Section */}
                <section>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    <Heart className="w-4 h-4" /> Mission & Values
                  </h4>
                  <textarea 
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none"
                    rows={3}
                    value={selectedPersona.psychographic.mission}
                    onChange={e => {
                      const newPersonas = [...personas];
                      const idx = newPersonas.findIndex(p => p.id === selectedPersonaId);
                      newPersonas[idx].psychographic.mission = e.target.value;
                      setPersonas(newPersonas);
                    }}
                  />
                </section>

                {/* Danger Zone */}
                <section className="pt-8 mt-8 border-t border-red-100">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-500 mb-2">
                    Danger Zone
                  </h4>
                  <p className="text-sm text-zinc-500 mb-4">
                    Deleting this persona will completely remove their profile, settings, and all associated posts, images, and videos from the timeline. This action cannot be undone.
                  </p>
                  <button 
                    onClick={() => deletePersona(selectedPersona.id)}
                    className="w-full py-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 font-bold flex items-center justify-center gap-2 transition-colors border border-red-200"
                  >
                    Delete Persona
                  </button>
                </section>
              </div>
              
              <div className="p-6 bg-zinc-50 border-t border-[#F3F4F6] flex justify-end">
                <button 
                  onClick={async () => {
                    try {
                      await fetch('/api/personas', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(selectedPersona) 
                      });
                      setIsPersonaModalOpen(false);
                    } catch (e) {
                      console.error("Failed to save persona:", e);
                    }
                  }}
                  className="bg-black text-white px-8 py-2.5 rounded-xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Save Persona
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-[#F3F4F6] flex justify-between items-center">
                <h3 className="text-lg font-bold">Import Content Plan</h3>
                <button onClick={() => setIsImportModalOpen(false)} className="text-zinc-400 hover:text-black">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                    <strong>Tip:</strong> Export your Google Sheet as JSON. Ensure it follows the structure with <code>persona_id</code>, <code>identity</code>, and <code>content_plan</code>.
                  </p>
                </div>
                <textarea 
                  className="w-full h-64 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black/5"
                  placeholder='{ "persona_id": "...", "identity": { ... }, "content_plan": { ... } }'
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100">
                   <div>
                     <label className="block text-[10px] font-bold text-zinc-500 mb-1">STARTING DATE (Assign calendars from)</label>
                     <input 
                       type="date"
                       value={importStartDate}
                       onChange={e => setImportStartDate(e.target.value)}
                       className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer"
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-zinc-500 mb-1">POSTS PER DAY FREQUENCY</label>
                     <input 
                       type="number"
                       min={1}
                       max={10}
                       value={postsPerDay}
                       onChange={e => setPostsPerDay(parseInt(e.target.value) || 1)}
                       className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-medium"
                     />
                   </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                   <input 
                     type="checkbox"
                     id="avoidDup"
                     checked={avoidDuplicates}
                     onChange={e => setAvoidDuplicates(e.target.checked)}
                     className="rounded border-zinc-300 text-black focus:ring-black cursor-pointer"
                   />
                   <label htmlFor="avoidDup" className="text-xs font-bold text-zinc-600 cursor-pointer">Avoid Importing Duplicates (By Day # or Theme)</label>
                </div>
              </div>
              <div className="p-6 bg-zinc-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-6 py-2 rounded-xl font-semibold text-zinc-500 hover:bg-zinc-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={fetchGoogleSheet}
                  disabled={isAIGeneratingDay}
                  className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  {isAIGeneratingDay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />}
                  Fetch Google Sheet
                </button>
                <button 
                  onClick={handleImport}
                  className="bg-black text-white px-6 py-2 rounded-xl font-semibold hover:bg-zinc-800 transition-all"
                >
                  Import Plan
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generation Choice Modal */}
      <AnimatePresence>
        {showGenerationChoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 border-b border-[#F3F4F6] flex justify-between items-center">
                <h3 className="text-lg font-bold">Create Visual</h3>
                <button onClick={() => setShowGenerationChoice(false)} className="text-zinc-400 hover:text-black">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <button 
                  onClick={generateContent}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-zinc-50 hover:bg-zinc-100 hover:border-black transition-all group"
                >
                  <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">AI Generation</div>
                    <div className="text-[10px] text-zinc-500">Generate a new image using AI and persona references</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => {
                    // Mock Drive Selection
                    const mockDriveImages = [
                      'https://picsum.photos/seed/drive1/800/1200',
                      'https://picsum.photos/seed/drive2/800/1200',
                      'https://picsum.photos/seed/drive3/800/1200'
                    ];
                    const randomDriveImage = mockDriveImages[Math.floor(Math.random() * mockDriveImages.length)];
                    updateDay(selectedDay.id, { generatedImageUrl: randomDriveImage, status: 'completed' });
                    setShowGenerationChoice(false);
                    alert("Asset selected from Google Drive!");
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-zinc-50 hover:bg-zinc-100 hover:border-black transition-all group"
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center text-white shrink-0">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">Google Drive</div>
                    <div className="text-[10px] text-zinc-500">Pick an existing asset from your Google Drive</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Prompt Modal */}
      <AnimatePresence>
        {isPromptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-[#F3F4F6] flex justify-between items-center">
                <h3 className="text-lg font-bold">Add Day via AI Prompt</h3>
                <button onClick={() => setIsPromptModalOpen(false)} className="text-zinc-400 hover:text-black">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-zinc-500">
                  Describe what happens on this day. The AI will build the content details (theme, scene, caption, etc.) for you.
                </p>
                <textarea 
                  className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                  placeholder="e.g., Luna is traveling to Paris today. She visits a small café in Montmartre and enjoys a croissant while sketching."
                  value={dayPrompt}
                  onChange={e => setDayPrompt(e.target.value)}
                />
              </div>
              <div className="p-6 bg-zinc-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsPromptModalOpen(false)}
                  className="px-6 py-2 rounded-xl font-semibold text-zinc-500 hover:bg-zinc-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={generateDayFromPrompt}
                  disabled={isAIGeneratingDay || !dayPrompt}
                  className="bg-black text-white px-6 py-2 rounded-xl font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isAIGeneratingDay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persona Rail */}
      <aside className="w-20 border-r border-[#E5E7EB] bg-white flex flex-col items-center py-6 gap-4">
        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center mb-2">
          <Sparkles className="text-white w-6 h-6" />
        </div>
        
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide px-2">
          {personas.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPersonaId(p.id);
                const pDays = days.filter(d => d.personaId === p.id);
                if (pDays.length > 0) setSelectedDayId(pDays[0].id);
              }}
              className={cn(
                "w-12 h-12 rounded-2xl border-2 transition-all p-0.5 relative group",
                selectedPersonaId === p.id ? "border-black" : "border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
              )}
            >
              <img src={p.referenceImageUrl} className="w-full h-full rounded-[14px] object-cover" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-[10px] rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none uppercase tracking-widest">
                {p.identity.fullName}
              </div>
            </button>
          ))}
          <button 
            onClick={addNewPersona}
            className="w-12 h-12 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={() => setActivePage(activePage === 'dashboard' ? 'settings' : 'dashboard')}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
            activePage === 'settings' ? "bg-black text-white shadow-md" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          )}
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </aside>


      {/* Content Sidebar */}
      <aside className="w-64 border-r border-[#E5E7EB] bg-white flex flex-col">
        <div className="p-6 border-b border-[#F3F4F6]">
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Current Persona</h2>
            <h1 className="font-bold text-lg tracking-tight truncate">{selectedPersona.identity.fullName}</h1>
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-tighter truncate">{selectedPersona.identity.profession}</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button 
              onClick={() => setIsPersonaModalOpen(true)}
              className="flex-1 text-xs bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm"
            >
              <User className="w-3.5 h-3.5" /> Edit Persona
            </button>
            <button 
              onClick={addNewPersona}
              className="text-xs bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 font-bold px-3 py-1.5 rounded-lg flex items-center justify-center"
              title="Add New Persona"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="space-y-1.5">
            {/* Row 1: New Day & AI Prompt */}
            <div className="flex gap-1.5">
              <button 
                onClick={addNewDay}
                className="flex-1 flex items-center justify-center gap-1 bg-black text-white py-2 rounded-xl text-[11px] font-bold hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Day
              </button>
              <button 
                onClick={() => setIsPromptModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1 bg-zinc-100 text-zinc-600 py-2 rounded-xl text-[11px] font-bold hover:bg-zinc-100/80 border border-zinc-200 hover:border-zinc-300 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                AI Prompt
              </button>
            </div>

            {/* Row 2: Import & Calendar Toggle */}
            <div className="flex gap-1.5">
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1 bg-zinc-100 text-zinc-600 py-2 rounded-xl text-[11px] font-bold hover:bg-zinc-100/80 border border-zinc-200 hover:border-zinc-300 transition-colors"
                title="Import from Sheets/JSON"
              >
                <FileJson className="w-3.5 h-3.5" />
                Import
              </button>
              <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all border",
                  viewMode === 'calendar' 
                    ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm" 
                    : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-100/80"
                )}
                title="Toggle Calendar Grid View"
              >
                <Calendar className="w-3.5 h-3.5" />
                {viewMode === 'calendar' ? "Dashboard" : "Calendar"}
              </button>
            </div>
          </div>
        </div>

        {personaDays.length > 0 && !personaDays.some(d => {
             const dDate = new Date(d.date);
             const nextWeek = new Date();
             nextWeek.setDate(nextWeek.getDate() + 7);
             const today = new Date();
             today.setHours(0,0,0,0);
             return dDate >= today && dDate <= nextWeek;
        }) && (
             <div className="mx-4 mt-1 p-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-[11px] flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Next week's schedule is empty!</span>
             </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">

          {personaDays.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-zinc-400">No content planned for this persona yet.</p>
            </div>
          ) : (
            personaDays.map((day) => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all group flex items-center justify-between",
                  selectedDayId === day.id 
                    ? "bg-[#F3F4F6] border border-[#E5E7EB]" 
                    : "hover:bg-[#F9FAFB]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500">
                    D{day.dayNumber}
                  </div>
                  <div>
                    <div className="font-semibold text-sm truncate max-w-[100px]">{day.theme}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90 -translate-x-0.5",
                        day.isGoodToPost ? "bg-green-100 text-green-700" : 
                        day.status === 'completed' ? "bg-blue-100 text-blue-700" :
                        day.status === 'generating' ? "bg-amber-100 text-amber-700 animate-pulse" : 
                        "bg-zinc-100 text-zinc-500"
                      )}>
                        {day.isGoodToPost ? "Scheduled" : 
                         day.status === 'completed' ? "Generated" :
                         day.status === 'generating' ? "Generating" : "New"}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {day.platforms.map(p => (
                        <span key={p} className="text-[8px] px-1 bg-zinc-100 rounded text-zinc-500 font-bold uppercase">{p[0]}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <ChevronRight className={cn(
                  "w-4 h-4 text-zinc-300 transition-transform",
                  selectedDayId === day.id && "translate-x-1 text-zinc-500"
                )} />
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        {activePage === 'settings' ? (
             <div className="max-w-xl mx-auto p-8 space-y-6 bg-white rounded-3xl border border-zinc-100 shadow-xl mt-12">
                  <h2 className="text-2xl font-bold tracking-tight">Global Settings</h2>
                  <p className="text-xs text-zinc-400">Configure your model and API keys here without breaking overlay dashboard.</p>
                  
                  <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-2 bg-zinc-50/70 p-4 rounded-xl border border-zinc-100 shadow-sm">
                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide">NanoBanana API</label>
                        
                        <div>
                          <input 
                            type="password"
                            value={nanobananaApiKey}
                            onChange={(e) => {
                               setNanobananaApiKey(e.target.value);
                               if (e.target.value) setActiveImageModel('nanobanana');
                            }}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono shadow-sm"
                            placeholder="Enter your NanoBanana API Key"
                          />
                          {nanobananaApiKey && nanobananaApiKey.length > 6 && (
                            <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                               <span>Active Key ending with:</span>
                               <span className="font-mono bg-zinc-100 px-1 rounded text-zinc-600 font-bold">...{nanobananaApiKey.slice(-6)}</span>
                            </p>
                          )}
                        </div>

                        <div>
                           <label className="block text-[10px] font-bold text-zinc-400 mb-0.5">Sub-Model (Associated Model)</label>
                           <select 
                             value={nanobananaVariant}
                             onChange={(e) => setNanobananaVariant(e.target.value as any)}
                             className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer shadow-sm"
                           >
                             <option value="standard">Google Nano Banana (Pro / Standard)</option>
                             <option value="v2">Google Nano Banana 2</option>
                             <option value="ultra">Google Nano Banana Flash</option>
                           </select>
                        </div>
                      </div>

                      <div className="space-y-2 bg-zinc-50/70 p-4 rounded-xl border border-zinc-100 shadow-sm">
                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide">Kling Video API</label>
                        
                        <div className="space-y-2">
                           <div>
                             <label className="block text-[10px] font-bold text-zinc-400 mb-0.5">API Key</label>
                             <input 
                               type="password"
                               value={klingApiKey}
                               onChange={(e) => setKlingApiKey(e.target.value)}
                               className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono shadow-sm"
                               placeholder="Enter Kling API Key"
                             />
                           </div>
                           <div>
                             <label className="block text-[10px] font-bold text-zinc-400 mb-0.5">API Secret</label>
                             <input 
                               type="password"
                               value={klingApiSecret}
                               onChange={(e) => setKlingApiSecret(e.target.value)}
                               className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono shadow-sm"
                               placeholder="Enter Kling API Secret"
                             />
                           </div>
                           <div>
                             <label className="block text-[10px] font-bold text-zinc-400 mb-0.5">Sub-Model (Associated Model)</label>
                             <select 
                               value={klingVariant}
                               onChange={(e) => setKlingVariant(e.target.value as any)}
                               className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer shadow-sm"
                             >
                               <option value="kling-v1">Kling v1 (Standard)</option>
                               <option value="kling-v1-pro">Kling v1 Pro (High Quality)</option>
                             </select>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-1 opacity-60">
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Blotato API Key</label>
                        <input 
                          type="password"
                          className="w-full bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="To be wired..."
                          disabled
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Public Tunnel URL (Ngrok)</label>
                        <input 
                          type="text"
                          value={publicTunnelUrl}
                          onChange={(e) => setPublicTunnelUrl(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="https://xxxx.ngrok-free.dev"
                        />
                      </div>
                      
                      <button 
                        onClick={() => { 
                           localStorage.setItem('active_image_model', activeImageModel); 
                           localStorage.setItem('nanobanana_api_key', nanobananaApiKey); 
                           localStorage.setItem('nanobanana_variant', nanobananaVariant); 
                           localStorage.setItem('kling_api_key', klingApiKey); 
                           localStorage.setItem('kling_api_secret', klingApiSecret); 
                           localStorage.setItem('kling_variant', klingVariant); 
                           localStorage.setItem('n8n_webhook_url', n8nWebhookUrl); 
                           localStorage.setItem('public_tunnel_url', publicTunnelUrl); 
                           alert('Settings Saved!'); 
                           setActivePage('dashboard'); 
                        }}

                        className="w-full bg-black text-white py-2 rounded-xl text-sm font-bold shadow-sm"
                      >Save & Close</button>
                  </div>
             </div>
        ) : (
        <div className="max-w-6xl mx-auto p-8">

          {viewMode === 'calendar' ? (
             <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-xl max-h-[85vh] overflow-y-auto">
                 <h2 className="text-xl font-bold mb-4 tracking-tight flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-zinc-600" />
                    Content Schedule Month View
                 </h2>
                 <p className="text-xs text-zinc-400 mb-6 font-medium">Click on any Scheduled meeting post card node to instantly load its dashboard configurations setup list flawlessly index Node triggers flawless!</p>

                 {(() => {
                    const uniqueDates = [...new Set(personaDays.map(d => d.date))].sort();
                    if (uniqueDates.length === 0) return <div className="p-8 text-center text-zinc-400 text-xs">No posts scheduled yet! Import or Add days to get started.</div>;

                    return (
                      <div className="space-y-4">
                         {uniqueDates.map((dateStr: any) => {
                             const dayItems = personaDays.filter(d => d.date === dateStr);
                             return (
                                <div 
                                   key={dateStr} 
                                   className="p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl transition-colors hover:bg-zinc-100/30"
                                   onDragOver={(e) => e.preventDefault()}
                                   onDrop={(e) => {
                                       const dayId = e.dataTransfer.getData('text/plain');
                                       if (dayId) updateDay(dayId, { date: dateStr });
                                   }}
                                >
                                    <div className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase mb-2">
                                        {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {dayItems.map(dp => (
                                            <button 
                                                key={dp.id} 
                                                onClick={() => { setSelectedDayId(dp.id); setViewMode('list'); }}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', dp.id);
                                                }}
                                                className={cn(
                                                    "p-3 rounded-xl border text-left flex flex-col justify-between h-24 bg-white shadow-sm hover:shadow-md hover:border-zinc-300 transition-all cursor-pointer",
                                                    selectedDayId === dp.id ? "border-black ring-1 ring-black" : "border-zinc-200"
                                                )}
                                            >
                                                 <div className="flex gap-1.5 items-start">
                                                      {dp.generatedImageUrl && (
                                                          <img 
                                                              src={dp.generatedImageUrl} 
                                                              className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-zinc-100 shadow-sm"
                                                              referrerPolicy="no-referrer"
                                                          />
                                                      )}
                                                      <div className="text-xs font-bold text-zinc-800 line-clamp-2 leading-snug">{dp.theme}</div>
                                                 </div>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[7.5px] font-bold uppercase text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">{dp.contentType}</span>
                                                    <div className="flex gap-1 items-center">
                                                        {dp.status === 'completed' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" title="Completed" />}
                                                        {dp.isGoodToPost && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm" title="Scheduled" />}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                             )
                         })}
                      </div>
                    );
                 })()}
             </div>
          ) : selectedDay ? (
            <>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(selectedDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">{selectedDay.theme}</h2>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => {

                      if (selectedDay.generatedImageUrl) {
                        generateContent();
                      } else {
                        setShowGenerationChoice(true);
                      }
                    }}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-md disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        {selectedDay.generatedImageUrl ? 'Regenerate Visual' : 'Create Visual'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Section */}
                <div className="space-y-6">
                  <section className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                      <Layout className="w-4 h-4" />
                      Journey Details
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Platforms</label>
                        <div className="flex gap-2">
                          {['Instagram', 'TikTok', 'YouTube'].map(p => (
                            <button
                              key={p}
                              onClick={() => {
                                const newPlatforms = selectedDay.platforms.includes(p as any)
                                  ? selectedDay.platforms.filter(x => x !== p)
                                  : [...selectedDay.platforms, p as any];
                                if (newPlatforms.length > 0) updateDay(selectedDay.id, { platforms: newPlatforms });
                              }}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all",
                                selectedDay.platforms.includes(p as any) 
                                  ? "bg-black border-black text-white" 
                                  : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300"
                              )}
                            >
                              {p === 'Instagram' && <Instagram className="w-3 h-3" />}
                              {p === 'TikTok' && <Smartphone className="w-3 h-3" />}
                              {p === 'YouTube' && <Youtube className="w-3 h-3" />}
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Date</label>
                          <input 
                            type="date"
                            value={selectedDay.date}
                            onChange={(e) => updateDay(selectedDay.id, { date: e.target.value })}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Content Type</label>
                          <select 
                            value={selectedDay.contentType}
                            onChange={(e) => {
                              const type = e.target.value as 'Photo' | 'Carousel' | 'Video';
                              const updates: any = { contentType: type };
                              if (type === 'Carousel' && (!selectedDay.slides || selectedDay.slides.length === 0)) {
                                updates.slides = [
                                  { id: generateUUID(), sceneDescription: 'Slide 1 - Scene details/instructions', onScreenText: 'Add overlay text', contentType: 'Photo' },
                                  { id: generateUUID(), sceneDescription: 'Slide 2 - Scene details/instructions', onScreenText: 'Add overlay text', contentType: 'Photo' },
                                  { id: generateUUID(), sceneDescription: 'Slide 3 - Scene details/instructions', onScreenText: 'Add overlay text', contentType: 'Photo' },
                                  { id: generateUUID(), sceneDescription: 'Slide 4 - Scene details/instructions', onScreenText: 'Add overlay text', contentType: 'Photo' }
                                ];
                              }
                              updateDay(selectedDay.id, updates);
                            }}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="Photo">Photo Post</option>
                            <option value="Carousel">Carousel</option>
                            <option value="Video">Short Video / Reel</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Location</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <input 
                            type="text"
                            value={selectedDay.location}
                            onChange={(e) => updateDay(selectedDay.id, { location: e.target.value })}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Style / Accessories (e.g., luxury)</label>
                        <select 
                          value={selectedDay.styleOption || 'luxury'}
                          onChange={(e) => updateDay(selectedDay.id, { styleOption: e.target.value })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-medium"
                        >
                          <option value="luxury">Luxury / High-end</option>
                          <option value="casual">Casual / Street style</option>
                          <option value="morning">Morning in Bed / Cozy</option>
                          <option value="elegant">Elegant Evening</option>
                          <option value="formal">Formal / Corporate</option>
                        </select>
                      </div>

                      <div className="border-t border-zinc-100 pt-3">
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Post-Level Image References (Location / Style / FaceSwap)</label>
                        <div className="flex gap-2 mb-3">
                          <input 
                            type="text" 
                            id="post_ref_imageUrl"
                            placeholder="https://image-url..." 
                            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs"
                          />
                          <select id="post_ref_tag" className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs">
                            <option value="None">No Tag</option>
                            <option value="Location">Location</option>
                            <option value="Style">Style</option>
                            <option value="FaceSwap">FaceSwap</option>
                          </select>
                          <button 
                            onClick={() => {
                              const urlInput = document.getElementById('post_ref_imageUrl') as HTMLInputElement;
                              const tagInput = document.getElementById('post_ref_tag') as HTMLSelectElement;
                              if (urlInput.value) {
                                const currentRefs = selectedDay.postImageReferences || [];
                                updateDay(selectedDay.id, { 
                                  postImageReferences: [...currentRefs, { id: generateUUID(), url: urlInput.value, tag: tagInput.value as any }] 
                                });
                                urlInput.value = '';
                              }
                            }}
                            className="bg-black text-white px-3 py-1 rounded-lg text-xs"
                          >Add</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedDay.postImageReferences?.map((ref, rIdx) => (
                            <div key={ref.id || rIdx} className="relative flex items-center gap-2 bg-zinc-50 p-2 rounded-xl border border-zinc-200 group">
                              <img src={ref.url} className="w-10 h-10 object-cover rounded-md" />
                              <div>
                                <span className={cn(
                                  "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full",
                                  ref.tag === 'Location' ? "bg-blue-100 text-blue-700" :
                                  ref.tag === 'Style' ? "bg-purple-100 text-purple-700" :
                                  ref.tag === 'FaceSwap' ? "bg-orange-100 text-orange-700" : "bg-zinc-100 text-zinc-500"
                                )}>{ref.tag}</span>
                              </div>
                              <button 
                                onClick={() => {
                                   const currentRefs = selectedDay.postImageReferences?.filter(r => r.id !== ref.id) || [];
                                   updateDay(selectedDay.id, { postImageReferences: currentRefs });
                                }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 p-1"
                              ><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Scene Description (AI Prompt)</label>

                        <textarea 
                          value={selectedDay.sceneDescription}
                          onChange={(e) => updateDay(selectedDay.id, { sceneDescription: e.target.value })}
                          rows={3}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none"
                        />
                      </div>
                    </div>

                    {selectedDay.contentType === 'Carousel' && selectedDay.slides && (
                      <div className="mt-4 border-t border-zinc-100 pt-4">
                        <div className="flex justify-between items-center mb-2">
                           <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide">Carousel Slides Details</label>
                           <button 
                             onClick={() => generateCarouselDetails(selectedDay.id)} 
                             disabled={isGenerating}
                             className="text-[10px] bg-black text-white px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-zinc-800 disabled:opacity-50 transition-all font-bold"
                           >
                               <Sparkles className="w-3 h-3" /> Gen Prompts
                           </button>
                        </div>
                        <div className="space-y-3">
                          {selectedDay.slides.map((slide, sIdx) => (
                            <div key={slide.id || sIdx} className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-[11px] text-zinc-800 uppercase">Slide {sIdx + 1}</span>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 mb-0.5 block">On-Screen Text</label>
                                <input 
                                  type="text"
                                  value={slide.onScreenText}
                                  onChange={(e) => {
                                     const updatedSlides = [...selectedDay.slides!];
                                     updatedSlides[sIdx] = { ...slide, onScreenText: e.target.value };
                                     updateDay(selectedDay.id, { slides: updatedSlides });
                                  }}
                                  className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-sm font-medium"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 mb-0.5 block">Scene Instructions</label>
                                <textarea 
                                  value={slide.sceneDescription}
                                  onChange={(e) => {
                                     const updatedSlides = [...selectedDay.slides!];
                                     updatedSlides[sIdx] = { ...slide, sceneDescription: e.target.value };
                                     updateDay(selectedDay.id, { slides: updatedSlides });
                                  }}
                                  rows={2}
                                  className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs text-zinc-600 resize-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      Copy & Text
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">On-Screen Text</label>
                        <input 
                          type="text"
                          value={selectedDay.onScreenText}
                          onChange={(e) => updateDay(selectedDay.id, { onScreenText: e.target.value })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Caption</label>
                        <textarea 
                          value={selectedDay.caption}
                          onChange={(e) => updateDay(selectedDay.id, { caption: e.target.value })}
                          rows={4}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Hook</label>
                          <input 
                            type="text"
                            value={selectedDay.hook}
                            onChange={(e) => updateDay(selectedDay.id, { hook: e.target.value })}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Hashtags</label>
                          <input 
                            type="text"
                            value={selectedDay.hashtags}
                            onChange={(e) => updateDay(selectedDay.id, { hashtags: e.target.value })}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-zinc-100 flex justify-end">
                        <button 
                          onClick={() => deleteDay(selectedDay.id)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-red-100 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-all"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Post Details
                        </button>
                      </div>
                    </div>
                  </section>
                </div>


                {/* Preview Section */}
                <div className="space-y-6">
                  <div className="sticky top-8">
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-lg overflow-hidden">
                      <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between bg-zinc-50/50">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-zinc-400" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Multi-Platform Preview</span>
                        </div>
                        <div className="flex gap-2">
                          {selectedDay.platforms.map(p => (
                            <div key={p} className="p-1.5 bg-zinc-100 rounded-lg">
                              {p === 'Instagram' && <Instagram className="w-3 h-3" />}
                              {p === 'TikTok' && <Smartphone className="w-3 h-3" />}
                              {p === 'YouTube' && <Youtube className="w-3 h-3" />}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={cn(
                        "relative bg-zinc-100 overflow-hidden transition-all duration-500",
                        selectedDay.platforms.includes('TikTok') || selectedDay.platforms.includes('YouTube') ? "aspect-[9/16] max-h-[500px]" : "aspect-[4/5]"
                      )}>
                        {selectedDay.contentType === 'Carousel' && selectedDay.slides && selectedDay.slides.length > 0 ? (
                          <div className="p-4 grid grid-cols-2 gap-2 overflow-y-auto max-h-[500px]">
                            {selectedDay.slides.map((slide, sIdx) => (
                              <div key={slide.id || sIdx} className="relative aspect-[4/5] bg-zinc-200 rounded-xl overflow-hidden shadow-md group">
                                {slide.generatedImageUrl ? (
                                  <img src={slide.generatedImageUrl} alt={`Slide ${sIdx+1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 text-xs text-center p-4">
                                    <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
                                    <p>Slide {sIdx + 1}</p>
                                  </div>
                                )}
                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] font-bold text-white uppercase backdrop-blur-sm">
                                  Slide {sIdx+1}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : selectedDay.generatedImageUrl ? (
                          (() => {
                            const slides: { type: 'image' | 'video', url: string }[] = [];
                            if (selectedDay.generatedImageUrl) slides.push({ type: 'image', url: selectedDay.generatedImageUrl });
                            if (selectedDay.generatedVideoUrl) slides.push({ type: 'video', url: selectedDay.generatedVideoUrl });
                            const curIdx = previewSlideIndex[selectedDay.id] || 0;
                            const cur = slides[curIdx];
                            const vStatus = videoStatus[selectedDay.id];

                            return (
                              <div className="relative w-full h-full group">
                                {/* Main preview */}
                                {cur.type === 'image' ? (
                                  <img 
                                    src={cur.url}
                                    alt="Generated"
                                    onClick={() => setLightboxImage(cur.url)}
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <video
                                    src={cur.url}
                                    className="w-full h-full object-cover"
                                    controls
                                    autoPlay
                                    loop
                                    muted
                                  />
                                )}

                                {/* Text overlay (image only) */}
                                {cur.type === 'image' && (
                                  <div className="absolute inset-x-4 bottom-12 flex justify-center pointer-events-none">
                                    <p className="bg-black/40 backdrop-blur-md text-white text-center text-xs font-bold px-3 py-2 rounded-xl max-w-[75%] shadow-md">
                                      {selectedDay.onScreenText || selectedDay.theme}
                                    </p>
                                  </div>
                                )}

                                {/* Video processing badge */}
                                {(vStatus === 'submitted' || vStatus === 'processing') && (
                                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-2 shadow-lg">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {vStatus === 'submitted' ? 'Video submitted to Kling...' : 'Video rendering (5–7 min)...'}
                                  </div>
                                )}

                                {/* Dot navigation */}
                                {slides.length > 1 && (
                                  <>
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                                      {slides.map((_, i) => (
                                        <div key={i} className={cn('w-1.5 h-1.5 rounded-full transition-all', i === curIdx ? 'bg-white scale-125' : 'bg-white/50')} />
                                      ))}
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setPreviewSlideIndex(s => ({ ...s, [selectedDay.id]: Math.max(0, curIdx - 1) })); }}
                                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                    >‹</button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setPreviewSlideIndex(s => ({ ...s, [selectedDay.id]: Math.min(slides.length - 1, curIdx + 1) })); }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                    >›</button>
                                  </>
                                )}


                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              {selectedDay.contentType === 'Video' && selectedDay.generatedImageUrl && !selectedDay.generatedVideoUrl && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); generateVideoOnly(selectedDay.id); }}
                                  className="p-2 rounded-full shadow-lg backdrop-blur-md bg-white/80 text-zinc-700 hover:bg-black hover:text-white transition-all"
                                  title="Generate Video from this Image"
                                >
                                  <Video className="w-5 h-5 flex-shrink-0" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateDay(selectedDay.id, { isGoodToPost: !selectedDay.isGoodToPost }); }}
                                className={cn(
                                  "p-2 rounded-full shadow-lg backdrop-blur-md transition-all",
                                  selectedDay.isGoodToPost ? "bg-green-500 text-white" : "bg-white/80 text-zinc-700 hover:bg-white"
                                )}
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={async () => {
                                   if (!n8nWebhookUrl) return alert("Configure N8N Webhook in Settings!");
                                   try {
                                      await fetch(n8nWebhookUrl, {
                                         method: 'POST',
                                         headers: { 'Content-Type': 'application/json' },
                                         body: JSON.stringify({
                                            image: selectedDay.generatedImageUrl,
                                            video: selectedDay.generatedVideoUrl,
                                            caption: selectedDay.caption,
                                            hashtags: selectedDay.hashtags,
                                            contentType: selectedDay.contentType
                                         })
                                      });
                                      alert("Trigger sent to N8N!");
                                   } catch (e) { alert("Failed to trigger N8N"); }
                                }}
                                className="p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all"
                                title="Publish to N8N"
                              >
                                <Send className="w-5 h-5" />
                              </button>
                            </div>
                            {selectedDay.isGoodToPost && (
                              <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approved / Good to Post
                              </div>
                            )}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 p-12 text-center">
                            {isGenerating ? (
                              <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 animate-spin text-black" />
                                <p className="text-sm font-medium text-zinc-600">AI is crafting your visual story...</p>
                              </div>
                            ) : (
                              <>
                                <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-sm font-medium">No image generated yet.</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden border border-zinc-100">
                            {selectedPersona.referenceImageUrl && <img src={selectedPersona.referenceImageUrl} alt={selectedPersona.identity.fullName} className="w-full h-full object-cover" />}
                          </div>
                          <span className="text-sm font-bold">{selectedPersona.identity.fullName}</span>
                        </div>
                        <p className="text-sm leading-relaxed line-clamp-3">
                          <span className="font-bold mr-2">{selectedPersona.identity.fullName}</span>
                          {selectedDay.caption}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-400">
              <Sparkles className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg font-medium">Select a day or import a plan to get started.</p>
            </div>
          )}
        </div>
        )}
      </main>


      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setLightboxImage(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-4xl max-h-[95vh] rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <img src={lightboxImage} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain" />
            <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm">
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        </div>
      )}

      {isSettingsOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Global Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Active Image Model</label>
                <select 
                  value={activeImageModel}
                  onChange={(e) => {
                    setActiveImageModel(e.target.value as any);
                    localStorage.setItem('active_image_model', e.target.value);
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-sm"
                >
                   <option value="gemini">gemini-3.1-flash-image-preview</option>
                   <option value="nanobanana">NanoBanana API</option>
                   <option>Imagen 3 / Nano v2 (Future Support)</option>
                </select>
              </div>
              {activeImageModel === 'nanobanana' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">NanoBanana API Key</label>
                  <input 
                    type="password"
                    value={nanobananaApiKey}
                    onChange={(e) => {
                      setNanobananaApiKey(e.target.value);
                      localStorage.setItem('nanobanana_api_key', e.target.value);
                    }}
                    placeholder="Enter NanoBanana Api Key"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Billing & Product Status</label>
                <button className="w-full text-center bg-zinc-100 hover:bg-zinc-200 text-sm font-bold py-2 rounded-lg">View Subscription info</button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
