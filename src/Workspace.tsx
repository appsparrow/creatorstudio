import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Plus, Settings, Loader2, Pencil, Calendar, List, Image,
  Video, Upload, Trash2, X, Check, ChevronLeft, ChevronRight, Eye,
  Send, ToggleLeft, ToggleRight, MapPin, Music, FileText, Hash,
  MessageSquare, Palette, Scissors, BookOpen, UserCircle, Globe,
  Save, AlertCircle, Clock, Copy, ExternalLink, FolderOpen, Key,
  Zap, MousePointerClick, Camera, Shirt, Type, LayoutGrid, Users, Target, AtSign, UserPlus,
  Lock, User, RefreshCw, GripVertical, Pin, PinOff, Moon, Sun,
} from 'lucide-react';
import { cn } from './lib/utils';
import { useAuth } from './contexts/AuthContext';
import {
  fetchPersonas, savePersona, deletePersona,
  fetchDays, saveDay, deleteDay,
  fetchUserSettings, saveUserSettings,
  saveImage, generateVideo, checkVideoStatus, saveVideo,
  publishToBlotato,
  publishToMeta, discoverMetaAccounts,
  syncDriveFiles, fetchDriveAssets,
} from './services/api';
import { getAiInstance, GENERATION_MODEL, TEXT_MODEL } from './services/ai';
import { generateImageNanoBanana } from './services/nanobanana';
import { burnTextOverlayBase64 } from './utils/textOverlay';
import {
  HAIRSTYLES, STYLE_OPTIONS, PLATFORMS, CONTENT_TYPES,
  STORY_ARCS, CAPTION_TONES, generateId, VIDEO_CAMERA_ANGLES, getRandomHairstyle,
} from './constants';
import type {
  Persona, ContentDay, UserSettings, Platform, ContentType,
  ContentStatus, StoryArc, CaptionTone, CarouselSlide, TargetAudience, PersonaFriend,
} from './types';
import UGCPostCard from './components/ugc/UGCPostCard';
import PromptsManager from './components/ugc/PromptsManager';
import ProductionLibrary, { ProductionLibrarySidebar, ProductionLibraryCanvas } from './components/ugc/ProductionLibrary';
import ugcMockData from '../ugc/sample-data/bbl-serum-package.json';

// ============================================================================
// Helpers
// ============================================================================

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft: 'bg-gray-600 text-gray-200',
  generating: 'bg-amber-500/80 text-amber-100 animate-pulse',
  completed: 'bg-blue-500/80 text-blue-100',
  published: 'bg-brand-500/80 text-rose-100',
};

const PLATFORM_LETTERS: Record<Platform, string> = {
  Instagram: 'I',
  TikTok: 'T',
  YouTube: 'Y',
};

function formatDate(dateStr: string) {
  if (!dateStr) return { month: '---', day: '--' };
  const d = new Date(dateStr + 'T00:00:00');
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Convert Google Drive download URLs to embeddable thumbnail URLs */
function driveDisplayUrl(url: string | undefined): string {
  if (!url) return '';
  // Already a non-drive URL — use as-is
  if (!url.includes('drive.google.com')) return url;
  // Extract file ID from various Drive URL formats
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  return url;
}

const emptyPersona = (): Persona => ({
  id: generateId(),
  identity: { fullName: '', age: 25, gender: '', nationality: '', birthplace: '', profession: '', locations: [] },
  appearance: { height: '', bodyType: '', faceShape: '', eyes: '', hair: '', distinctFeatures: [] },
  psychographic: { coreTraits: [], interests: [], values: [], fears: [], motivations: [], mission: '' },
  backstory: '',
  fashionStyle: { aesthetic: '', signatureItems: [], photographyStyle: '' },
  lifestyle: { routine: '', diet: '', socialMediaPresence: '' },
  socialHandles: { instagram: '', tiktok: '', youtube: '', twitter: '', x: '' },
  friends: [],
});

const emptyDay = (personaId: string, source: 'studio' | 'ugc' = 'studio'): ContentDay => ({
  id: generateId(),
  dayNumber: 0,
  date: new Date().toISOString().split('T')[0],
  platforms: ['Instagram'],
  theme: '',
  sceneDescription: '',
  onScreenText: '',
  caption: '',
  hook: '',
  hashtags: '',
  cta: '',
  location: '',
  musicSuggestion: '',
  notes: '',
  contentType: 'Photo',
  status: 'draft',
  personaId,
  source,
  storyArc: 'Beautiful Day',
  captionTone: 'Aspirational',
});

// ============================================================================
// Workspace Component
// ============================================================================

export default function Workspace() {
  const { signOut, user } = useAuth();

  // ---------- Apply saved theme + mode on mount ----------
  useEffect(() => {
    const savedTheme = localStorage.getItem('cs_theme') || 'default';
    const savedMode = localStorage.getItem('cs_mode') || 'dark';
    if (savedTheme !== 'default') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    if (savedMode === 'light') {
      document.documentElement.setAttribute('data-mode', 'light');
    } else {
      document.documentElement.removeAttribute('data-mode');
    }
  }, []);

  // ---------- Core state ----------
  const [workspaceMode, setWorkspaceMode] = useState<'studio' | 'ugc'>(() => {
    return (localStorage.getItem('cs_workspace_mode') as 'studio' | 'ugc') || 'studio';
  });
  const [showModeSwitcher, setShowModeSwitcher] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [days, setDays] = useState<ContentDay[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [rightPanel, setRightPanel] = useState<'none' | 'persona-editor' | 'settings'>('none');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------- Generation state ----------
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [videoStatus, setVideoStatus] = useState<Record<string, 'idle' | 'submitted' | 'processing' | 'done' | 'failed'>>({});

  // ---------- Lightbox ----------
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ---------- New Post Prompt state ----------
  const [showNewPostPrompt, setShowNewPostPrompt] = useState(false);
  const [newPostPromptText, setNewPostPromptText] = useState('');
  const [selectedAudienceSegment, setSelectedAudienceSegment] = useState('Aspiring Achiever');
  const [selectedContentFocus, setSelectedContentFocus] = useState<string[]>([]);

  // ---------- UGC New Package state ----------
  const [showNewUGCPrompt, setShowNewUGCPrompt] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySection, setLibrarySection] = useState<string | null>(null);
  const [pinnedPersonaIds, setPinnedPersonaIds] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem('cs_pinned_personas') || '[]'))
  );
  const [ugcProductUrl, setUgcProductUrl] = useState('');
  const [ugcAffiliateUrl, setUgcAffiliateUrl] = useState('');
  const [ugcMode, setUgcMode] = useState<'auto' | 'hitl'>('hitl');
  const [isUGCGenerating, setIsUGCGenerating] = useState(false);

  // ---------- Modal state ----------
  const [showAIPromptModal, setShowAIPromptModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSheetId, setImportSheetId] = useState('');
  const [importSheetName, setImportSheetName] = useState('30-Day Content Calendar');
  const [importStartDate, setImportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [importPostsPerDay, setImportPostsPerDay] = useState(1);
  const [importAvoidDuplicates, setImportAvoidDuplicates] = useState(true);
  const [aiPersonaDescription, setAiPersonaDescription] = useState('');
  const [isAIPersonaGenerating, setIsAIPersonaGenerating] = useState(false);

  // ---------- Confirm modal state ----------
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  // ---------- Drive picker state ----------
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [drivePickerMode, setDrivePickerMode] = useState<'single' | 'multi'>('single');
  const [driveLoading, setDriveLoading] = useState(false);

  // ---------- Calendar state ----------
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // ---------- Edited copies for auto-save ----------
  const [editedDay, setEditedDay] = useState<ContentDay | null>(null);
  const [editedPersona, setEditedPersona] = useState<Persona | null>(null);
  const [editedSettings, setEditedSettings] = useState<UserSettings>({});

  // ---------- Debounce timers ----------
  const daySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personaSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- Derived ----------
  const selectedPersona = personas.find(p => p.id === selectedPersonaId) ?? null;
  const personaDays = useMemo(
    () => days
      .filter(d => d.personaId === selectedPersonaId)
      .filter(d => {
        const daySource = d.source || 'studio';
        return workspaceMode === 'studio' ? daySource === 'studio' : daySource === 'ugc';
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
    [days, selectedPersonaId, workspaceMode]
  );
  const selectedDay = editedDay?.id === selectedDayId ? editedDay : days.find(d => d.id === selectedDayId) ?? null;

  // ============================================================================
  // Data Loading
  // ============================================================================

  useEffect(() => {
    (async () => {
      try {
        const [p, d] = await Promise.all([fetchPersonas(), fetchDays()]);
        setPersonas(p);
        setDays(d);
        if (p.length > 0) {
          setSelectedPersonaId(p[0].id);
          const firstDay = d.filter((day: ContentDay) => day.personaId === p[0].id).sort((a: ContentDay, b: ContentDay) => a.date.localeCompare(b.date))[0];
          if (firstDay) {
            setSelectedDayId(firstDay.id);
            setEditedDay(firstDay);
          }
        }
        // Settings fetch is non-fatal — old Express server may not have this route
        try {
          const s = await fetchUserSettings();
          console.log('[Settings] Loaded:', JSON.stringify(s).slice(0, 300));
          if (s && typeof s === 'object') { setSettings(s as UserSettings); setEditedSettings(s as UserSettings); }
        } catch (e) { console.warn('[Settings] Load failed:', e); }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ============================================================================
  // Auto-save logic
  // ============================================================================

  const autoSaveDay = useCallback((day: ContentDay) => {
    if (daySaveTimer.current) clearTimeout(daySaveTimer.current);
    daySaveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await saveDay(day);
        setDays(prev => prev.map(d => d.id === day.id ? day : d));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, []);

  const autoSavePersona = useCallback((persona: Persona) => {
    if (personaSaveTimer.current) clearTimeout(personaSaveTimer.current);
    personaSaveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await savePersona(persona);
        setPersonas(prev => prev.map(p => p.id === persona.id ? persona : p));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, []);

  const autoSaveSettings = useCallback((s: UserSettings) => {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await saveUserSettings(s);
        setSettings(s);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, []);

  // ============================================================================
  // Day field updater
  // ============================================================================

  const updateDayField = useCallback(<K extends keyof ContentDay>(field: K, value: ContentDay[K]) => {
    setEditedDay(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      autoSaveDay(updated);
      return updated;
    });
  }, [autoSaveDay]);

  // ============================================================================
  // Persona field updater (nested)
  // ============================================================================

  const updatePersonaField = useCallback((path: string, value: any) => {
    setEditedPersona(prev => {
      if (!prev) return prev;
      const parts = path.split('.');
      const updated = JSON.parse(JSON.stringify(prev));
      let obj = updated;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      autoSavePersona(updated);
      return updated;
    });
  }, [autoSavePersona]);

  // ============================================================================
  // Settings field updater
  // ============================================================================

  const updateSettingsField = useCallback((field: keyof UserSettings, value: any) => {
    setEditedSettings(prev => {
      const updated = { ...prev, [field]: value };
      autoSaveSettings(updated);
      return updated;
    });
  }, [autoSaveSettings]);

  // ============================================================================
  // Actions
  // ============================================================================

  const switchWorkspaceMode = useCallback((mode: 'studio' | 'ugc') => {
    setWorkspaceMode(mode);
    localStorage.setItem('cs_workspace_mode', mode);
    setShowModeSwitcher(false);
    // Reset to list view when switching modes
    setViewMode('list');
    // Reset selected day when switching modes (it may belong to the other source)
    setSelectedDayId(null);
    setEditedDay(null);
  }, [viewMode]);

  const selectPersona = useCallback((id: string) => {
    setSelectedPersonaId(id);
    setRightPanel('none');
    const source = workspaceMode;
    const firstDay = days
      .filter(d => d.personaId === id && (d.source || 'studio') === source)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (firstDay) {
      setSelectedDayId(firstDay.id);
      setEditedDay(firstDay);
    } else {
      setSelectedDayId(null);
      setEditedDay(null);
    }
  }, [days, workspaceMode]);

  const selectDay = useCallback((id: string) => {
    setSelectedDayId(id);
    const day = days.find(d => d.id === id);
    if (day) setEditedDay(day);
    setViewMode('list');
    setMobileSidebar(false);
  }, [days]);

  const handleNewPersona = useCallback(() => {
    setConfirmModal({
      title: 'Create New Persona',
      message: 'Do you want to create a new persona?',
      confirmLabel: 'Create',
      confirmVariant: 'default',
      onConfirm: async () => {
        const np = emptyPersona();
        np.identity.fullName = 'New Persona';
        try {
          await savePersona(np);
          setPersonas(prev => [...prev, np]);
          setSelectedPersonaId(np.id);
          setSelectedDayId(null);
          setEditedDay(null);
          setEditedPersona(np);
          setRightPanel('persona-editor');
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }, []);

  const handleDeletePersona = useCallback((id: string) => {
    setConfirmModal({
      title: 'Delete Persona',
      message: 'Delete this persona and ALL its content, generated images, and videos? This cannot be undone.',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deletePersona(id);
          setPersonas(prev => prev.filter(p => p.id !== id));
          setDays(prev => prev.filter(d => d.personaId !== id));
          if (selectedPersonaId === id) {
            setSelectedPersonaId(personas.filter(p => p.id !== id)[0]?.id ?? null);
            setRightPanel('none');
          }
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }, [selectedPersonaId, personas]);

  const handleNewDay = useCallback(async () => {
    if (!selectedPersonaId) return;
    const nd = emptyDay(selectedPersonaId);
    nd.dayNumber = personaDays.length + 1;
    try {
      await saveDay(nd);
      setDays(prev => [...prev, nd]);
      setSelectedDayId(nd.id);
      setEditedDay(nd);
    } catch (e: any) {
      setError(e.message);
    }
  }, [selectedPersonaId, personaDays]);

  const handleDeleteDay = useCallback((id: string) => {
    setConfirmModal({
      title: 'Delete Post',
      message: 'Any generated images and videos will be lost. Regeneration costs credits.',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDay(id);
          setDays(prev => prev.filter(d => d.id !== id));
          if (selectedDayId === id) {
            setSelectedDayId(null);
            setEditedDay(null);
          }
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }, [selectedDayId]);

  const handleUpdateDayDate = useCallback(async (dayId: string, newDate: string) => {
    setDays(prev => prev.map(d => {
      if (d.id !== dayId) return d;
      const updated = { ...d, date: newDate };
      autoSaveDay(updated);
      return updated;
    }));
    setEditedDay(prev => {
      if (!prev || prev.id !== dayId) return prev;
      return { ...prev, date: newDate };
    });
  }, [autoSaveDay]);

  const handleDuplicateDay = useCallback((dayId: string) => {
    const source = days.find(d => d.id === dayId);
    if (!source) return;
    setConfirmModal({
      title: 'Duplicate Post',
      message: 'A new draft copy will be created.',
      confirmLabel: 'Duplicate',
      confirmVariant: 'default',
      onConfirm: async () => {
        const today = new Date();
        const dupDay: ContentDay = {
          ...JSON.parse(JSON.stringify(source)),
          id: generateId(),
          status: 'draft' as ContentStatus,
          date: today.toISOString().split('T')[0],
          generatedImageUrl: undefined,
          generatedVideoUrl: undefined,
          pendingVideoTaskId: undefined,
          isGoodToPost: false,
          dayNumber: personaDays.length + 1,
          theme: source.theme ? `${source.theme} (Copy)` : 'Copy',
        };
        try {
          await saveDay(dupDay);
          setDays(prev => [...prev, dupDay]);
          setSelectedDayId(dupDay.id);
          setEditedDay(dupDay);
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }, [days, personaDays, autoSaveDay]);

  const openPersonaEditor = useCallback(() => {
    if (selectedPersona) {
      setEditedPersona(JSON.parse(JSON.stringify(selectedPersona)));
      setRightPanel('persona-editor');
    }
  }, [selectedPersona]);

  const togglePinPersona = useCallback((id: string) => {
    setPinnedPersonaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem('cs_pinned_personas', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const openSettings = useCallback(() => {
    setEditedSettings({ ...settings });
    setRightPanel('settings');
  }, [settings]);

  // ============================================================================
  // Drive Sync
  // ============================================================================

  const handleSyncDrive = useCallback(async () => {
    // Check all possible sources for Drive URL
    const url = editedPersona?.driveFolderUrl || selectedPersona?.driveFolderUrl || editedSettings.driveFolderUrl;
    console.log('[Drive Sync] Starting sync...');
    console.log('[Drive Sync] editedPersona URL:', editedPersona?.driveFolderUrl);
    console.log('[Drive Sync] selectedPersona URL:', selectedPersona?.driveFolderUrl);
    console.log('[Drive Sync] global settings URL:', editedSettings.driveFolderUrl);
    console.log('[Drive Sync] Resolved URL:', url);
    if (!url) {
      console.warn('[Drive Sync] No Drive folder URL configured. Set it in persona Settings tab or global Settings.');
      return;
    }
    setDriveLoading(true);
    try {
      console.log('[Drive Sync] Calling syncDriveFiles with URL:', url);
      const result = await syncDriveFiles(url);
      console.log('[Drive Sync] Response:', JSON.stringify(result).slice(0, 500));
      console.log('[Drive Sync] Files count:', result.files?.length || 0);
      setDriveFiles(result.files || []);
    } catch (e: any) {
      console.error('[Drive Sync] Error:', e.message || e);
    }
    setDriveLoading(false);
  }, [editedPersona, selectedPersona, editedSettings.driveFolderUrl]);

  const handleOpenDrivePicker = useCallback((mode: 'single' | 'multi') => {
    setDrivePickerMode(mode);
    setShowDrivePicker(true);
    // Auto-sync if we have no files yet but have a folder URL
    const url = selectedPersona?.driveFolderUrl || editedSettings.driveFolderUrl;
    if (driveFiles.length === 0 && url) {
      handleSyncDrive();
    }
  }, [driveFiles.length, selectedPersona, editedSettings.driveFolderUrl, handleSyncDrive]);

  const handleDriveSelect = useCallback((selectedFiles: any[]) => {
    if (!editedDay) return;
    const day = editedDay;

    const getUrl = (f: any) => f.driveUrl || `https://drive.google.com/uc?export=download&id=${f.id}`;

    if (day.contentType === 'Photo' && selectedFiles.length > 0) {
      updateDayField('customMediaUrl', getUrl(selectedFiles[0]));
      updateDayField('status', 'completed' as any);
    } else if (day.contentType === 'Video' && selectedFiles.length > 0) {
      updateDayField('generatedVideoUrl', getUrl(selectedFiles[0]));
      updateDayField('customMediaUrl', getUrl(selectedFiles[0]));
      updateDayField('status', 'completed' as any);
    } else if (day.contentType === 'Carousel' && day.slides) {
      const updatedSlides = [...day.slides];
      selectedFiles.forEach((file, i) => {
        if (i < updatedSlides.length) {
          updatedSlides[i] = { ...updatedSlides[i], generatedImageUrl: getUrl(file) };
        }
      });
      updateDayField('slides', updatedSlides);
      updateDayField('status', 'completed' as any);
    }

    setShowDrivePicker(false);
  }, [editedDay, updateDayField]);

  // ============================================================================
  // Image Generation
  // ============================================================================

  const generateSingleImage = useCallback(async (
    ai: any,
    prompt: string,
    text: string,
    persona: Persona,
    day: ContentDay,
    extraReferenceUrls?: string[],
  ): Promise<string> => {
    const finalStyle = day.styleOption || 'luxury';
    const p = persona;
    let finalPrompt = `The PRIMARY subject of this image is ${p.identity.fullName}, a ${p.identity.age}-year-old ${p.identity.nationality} ${p.identity.gender}. Appearance: ${p.appearance.height}, ${p.appearance.bodyType} build, ${p.appearance.faceShape} face, ${p.appearance.eyes} eyes, ${p.appearance.hair} hair. Distinct features: ${(p.appearance.distinctFeatures || []).join(', ') || 'none'}. ${p.identity.fullName} must be the FOCAL POINT of the image and clearly stand out.

${prompt} Style: ${finalStyle}. STRICTLY WEAR exactly what is described. DO NOT add default jackets, suits, or blazers unless specified in prompt.

If other people appear in the scene, they must be of DIFFERENT races and ethnicities from the primary subject. The primary subject must always be the most prominent person in the frame.`;

    // Include friend descriptions if friends exist and scene might reference them
    if (p.friends && p.friends.length > 0) {
      const friendDescs = p.friends.filter(f => f.name).map(f =>
        `Supporting character: ${f.name} - ${(f.traits || []).join(', ')}, ${f.profession || 'friend'}. Appearance differs from primary subject.`
      ).join('\n');
      if (friendDescs) finalPrompt += `\n${friendDescs}`;
    }

    if (persona.aiAnalysis) {
      finalPrompt += `\nCRITICAL IDENTITY ENFORCEMENT RULES:\n${persona.aiAnalysis}\nThe generated character MUST exactly map to these details.`;
    }

    if (day.postImageReferences) {
      day.postImageReferences.forEach(ref => {
        if (ref.tag !== 'None') {
          finalPrompt += ` [Reference ${ref.tag} Image provided]`;
        }
      });
    }

    let imageUrl = '';
    const nbKey = editedSettings.nanobananaApiKey;

    // Try NanoBanana first
    if (nbKey) {
      try {
        console.log("Using NanoBanana API...");
        const responseUrl = await generateImageNanoBanana({
          prompt: finalPrompt,
          type: (persona.referenceImageUrls?.length || day.postImageReferences?.length) ? 'IMAGETOIAMGE' : 'TEXTTOIAMGE',
          imageUrls: [
            ...(persona.referenceImageUrls?.filter(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || []),
            ...(day.postImageReferences?.filter(ref => ref.url && ref.url.startsWith('http')).map(ref => ref.url) || [])
          ],
          image_size: '4:5'
        }, nbKey);
        if (responseUrl) imageUrl = responseUrl;
      } catch (e) {
        console.error("NanoBanana failed, falling back to Gemini:", e);
      }
    }

    // Fallback to Gemini
    if (!imageUrl) {
      console.log("Using Gemini API...");
      const parts: any[] = [{ text: finalPrompt }];
      const combinedUrls = [
        ...(persona.referenceImageUrls || []),
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
          } catch (e) {
            console.warn("Failed to fetch reference image:", url, e);
          }
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

    // Apply text overlay with position
    let finalBase64 = imageUrl;
    if (text && text.trim()) {
      try {
        finalBase64 = await burnTextOverlayBase64(imageUrl, text, day.textPosition || 'bottom');
      } catch (e) {
        console.warn("Text overlay failed, using original image:", e);
      }
    }

    // Save to server
    const filename = `${generateId()}.png`;
    const savedData = await saveImage(finalBase64, filename, persona.id);
    return savedData.url;
  }, [editedSettings.nanobananaApiKey]);

  const handleGenerateImage = useCallback(async () => {
    if (!selectedDay || !selectedPersona) return;
    setIsGenerating(true);
    setGeneratingStatus('Preparing...');
    setError('');

    // Immediately update day status
    const dayId = selectedDay.id;
    updateDayField('status', 'generating');

    try {
      const ai = await getAiInstance();
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });

      if (selectedDay.contentType === 'Carousel' && selectedDay.slides && selectedDay.slides.length > 0) {
        const updatedSlides = [...selectedDay.slides];
        for (let i = 0; i < updatedSlides.length; i++) {
          setGeneratingStatus(`Generating image ${i + 1} of ${updatedSlides.length}...`);
          const slide = updatedSlides[i];
          const slidePrompt = `Generate a high-quality social media image for ${selectedPersona.identity.fullName}.
          Scene: ${slide.sceneDescription}. Month: ${currentMonth}. Location: ${selectedDay.location}.
          Persona Reference details: Appearance: ${selectedPersona.appearance.height}, ${selectedPersona.appearance.bodyType}.
          Hairstyle: ${selectedDay.hairstyle || selectedPersona.appearance.hair}.
          IMPORTANT: Maintain ABSOLUTE CONSISTENT clothing, outfit, accessories, and HAIRSTYLE across all slides - as if taken in a single photoshoot session.
          DO NOT ALTER THE FACE OR BASE FEATURES OF THE CHARACTER. STRICTLY USE REFERENCE IMAGE FOR IDENTITY.
          STYLE INSTRUCTION: Generate a CANDID, unposed shot. The subject should NOT look directly at the camera.`;

          let extraRefs: string[] = [];
          if (i > 0 && updatedSlides[0].generatedImageUrl) {
            extraRefs.push(updatedSlides[0].generatedImageUrl);
          }
          const localUrl = await generateSingleImage(ai, slidePrompt, slide.onScreenText, selectedPersona, selectedDay, extraRefs);
          updatedSlides[i] = { ...slide, generatedImageUrl: localUrl };
        }
        updateDayField('slides', updatedSlides);
        updateDayField('status', 'completed');
      } else {
        setGeneratingStatus('Generating image...');
        const basePrompt = `Generate a high-quality social media ${selectedDay.contentType.toLowerCase()} image for ${selectedPersona.identity.fullName}.
        Theme: ${selectedDay.theme}. Scene: ${selectedDay.sceneDescription}. Location: ${selectedDay.location}.
        Persona Reference details: Appearance: ${selectedPersona.appearance.height}, ${selectedPersona.appearance.bodyType}.
        Hairstyle: ${selectedDay.hairstyle || selectedPersona.appearance.hair}.
        DO NOT ALTER THE FACE OR BASE FEATURES OF THE CHARACTER. STRICTLY USE REFERENCE IMAGE FOR IDENTITY.
        STYLE INSTRUCTION: Generate a CANDID, mid-action, or unposed shot. The subject must NOT be looking static at the camera.`;

        const localUrl = await generateSingleImage(ai, basePrompt, selectedDay.onScreenText, selectedPersona, selectedDay);
        updateDayField('generatedImageUrl', localUrl);
        updateDayField('status', 'completed');
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      setError(`Image generation failed: ${error.message}`);
      updateDayField('status', 'draft');
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  }, [selectedDay, selectedPersona, generateSingleImage, updateDayField, editedSettings]);

  // ============================================================================
  // Video Generation
  // ============================================================================

  const handleGenerateVideo = useCallback(async () => {
    if (!selectedDay || !selectedDay.generatedImageUrl) {
      setError('Image must be generated first before creating a video.');
      return;
    }
    const dayId = selectedDay.id;
    const klingApiKey = editedSettings.klingApiKey;
    const klingApiSecret = editedSettings.klingApiSecret;
    if (!klingApiKey || !klingApiSecret) {
      setError('Kling API Key and Secret are required. Add them in Settings.');
      return;
    }

    setIsGenerating(true);
    setGeneratingStatus('Submitting video generation...');
    setVideoStatus(s => ({ ...s, [dayId]: 'submitted' }));
    updateDayField('pendingVideoTaskId', '__pending__');

    try {
      const base = editedSettings.publicTunnelUrl || window.location.origin;
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const publicImageUrl = selectedDay.generatedImageUrl.startsWith('http')
        ? selectedDay.generatedImageUrl
        : `${cleanBase}${selectedDay.generatedImageUrl}`;

      const randomAngle = VIDEO_CAMERA_ANGLES[Math.floor(Math.random() * VIDEO_CAMERA_ANGLES.length)];

      const vData = await generateVideo({
        prompt: `Animate this scene naturally for 5 seconds. ${selectedDay.sceneDescription ? `Scene: ${selectedDay.sceneDescription}.` : ''} Camera angle: ${randomAngle.value}. Keep the subject's expression and mood consistent with the image.`,
        image_url: publicImageUrl,
        apiKey: klingApiKey,
        apiSecret: klingApiSecret,
        model_name: 'kling-v1-5',
        publicTunnelUrl: editedSettings.publicTunnelUrl,
        dayId,
      });

      if (vData.taskId) {
        console.log("[Workspace] Kling task submitted:", vData.taskId);
        updateDayField('pendingVideoTaskId', vData.taskId);

        let attempts = 0;
        const maxAttempts = 100;
        while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 10000));
          attempts++;
          setGeneratingStatus(`Processing video... (${attempts * 10}s)`);
          setVideoStatus(s => ({ ...s, [dayId]: 'processing' }));

          const statusData = await checkVideoStatus(vData.taskId, klingApiKey, klingApiSecret);
          const status = (statusData as any).task_status;
          const videoUrl = (statusData as any).video_url;

          if (status === 'succeed') {
            if (!videoUrl) throw new Error("Video success but no URL returned.");
            const saveResult = await saveVideo(videoUrl, selectedDay.personaId);
            if (saveResult.url) {
              setVideoStatus(s => ({ ...s, [dayId]: 'done' }));
              updateDayField('generatedVideoUrl', saveResult.url);
              updateDayField('pendingVideoTaskId', undefined as any);
              return;
            }
            throw new Error("Failed to save video locally.");
          } else if (status === 'failed') {
            setVideoStatus(s => ({ ...s, [dayId]: 'failed' }));
            throw new Error("Kling task failed. Check Kling dashboard.");
          }
        }
        throw new Error("Video generation timed out after ~16 minutes.");
      } else {
        throw new Error(`Kling submission failed: ${JSON.stringify(vData).slice(0, 200)}`);
      }
    } catch (e: any) {
      console.error("Video generation failed:", e);
      setError(`Video generation failed: ${e.message}`);
      setVideoStatus(s => ({ ...s, [dayId]: 'failed' }));
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  }, [selectedDay, editedSettings, updateDayField]);

  // ============================================================================
  // Thumbnail Generation
  // ============================================================================

  const handleGenerateThumbnail = useCallback(async () => {
    if (!selectedDay || !selectedPersona) return;
    setIsGenerating(true);
    setGeneratingStatus('Generating thumbnail...');
    try {
      const ai = await getAiInstance();

      const thumbnailConcept = selectedDay.notes?.match(/\[THUMBNAIL\] (.+?)(?:\n|$)/)?.[1] || selectedDay.theme;

      const prompt = `Generate a THUMBNAIL image for a social media video/reel.
This is ${selectedPersona.identity.fullName}, ${selectedPersona.identity.profession}.

THUMBNAIL CONCEPT: ${thumbnailConcept}
VIDEO THEME: ${selectedDay.theme}

THUMBNAIL STYLE RULES:
- Close-up or medium shot of the persona
- Expressive face (surprised, confident, playful, or dramatic expression)
- Eye-catching composition that makes people want to click
- Portrait orientation (9:16)
- The persona should be the ONLY person in the thumbnail
- Bold, attention-grabbing framing
- Professional influencer quality

Persona appearance: ${selectedPersona.appearance.height}, ${selectedPersona.appearance.bodyType},
${selectedPersona.appearance.faceShape} face, ${selectedPersona.appearance.eyes} eyes,
${selectedPersona.appearance.hair} hair.
${selectedPersona.aiAnalysis ? `\nIDENTITY RULES: ${selectedPersona.aiAnalysis}` : ''}`;

      const refImages = selectedPersona.thumbnailReferenceUrls?.length
        ? selectedPersona.thumbnailReferenceUrls
        : selectedPersona.referenceImageUrls || [];

      const url = await generateSingleImage(ai, prompt, '', selectedPersona, selectedDay, refImages);

      updateDayField('thumbnailUrl', url);
    } catch (e) {
      console.error('Thumbnail generation failed:', e);
    }
    setIsGenerating(false);
    setGeneratingStatus('');
  }, [selectedDay, selectedPersona, generateSingleImage, updateDayField]);

  // ============================================================================
  // AI Content Plan Generation
  // ============================================================================

  const handleAIContentPlan = useCallback(async (promptOverride?: string, audienceOverride?: string, contentFocusOverride?: string[]) => {
    const promptText = promptOverride || aiPrompt;
    const audienceText = audienceOverride || selectedAudienceSegment;
    const contentFocusTags = contentFocusOverride || selectedContentFocus;
    if (!promptText.trim() || !selectedPersona) return;
    setIsAIGenerating(true);
    setError('');

    try {
      const ai = await getAiInstance();
      const p = selectedPersona;
      // Find matching audience object for richer context
      const matchedAudience = (p.targetAudiences || []).find(a => a.segmentName === audienceText);
      const audienceBlock = matchedAudience
        ? `TARGET AUDIENCE SEGMENT: ${matchedAudience.segmentName}
      - Age Range: ${matchedAudience.ageRange}
      - Gender Skew: ${matchedAudience.genderSkew}
      - Core Aspiration: ${matchedAudience.coreAspiration}
      - Pain Points: ${(matchedAudience.painPoints || []).join(', ')}
      - Content Resonance Notes: ${matchedAudience.contentResonanceNotes || 'N/A'}
      Write the caption so it speaks directly to this audience — address their pain points ("${(matchedAudience.painPoints || []).join('", "')}"), their aspiration ("${matchedAudience.coreAspiration}"), and desires — then transition naturally into the persona's story.`
        : `TARGET AUDIENCE SEGMENT: ${audienceText}
      Write the caption so it speaks to this audience segment first — address their pain points, aspirations, and desires — then transition naturally into the persona's story.`;

      const prompt = `Build a social media content plan for one day based on this prompt: "${promptText}".

      ${audienceBlock}

      CONTENT FOCUS THEMES: ${contentFocusTags.length > 0 ? contentFocusTags.join(', ') : 'General lifestyle'}
      Ensure the post aligns with these content themes. Choose an appropriate storyArc and captionTone that match the content focus.

      PERSONA FULL CONTEXT:
      - Name: ${p.identity.fullName}, ${p.identity.age}yo ${p.identity.gender}, ${p.identity.nationality}
      - Profession: ${p.identity.profession}
      - Locations: ${p.identity.locations?.join(', ') || 'N/A'}
      - Core Traits: ${p.psychographic?.coreTraits?.join(', ') || 'N/A'}
      - Interests: ${p.psychographic?.interests?.join(', ') || 'N/A'}
      - Values: ${p.psychographic?.values?.join(', ') || 'N/A'}
      - Motivations: ${p.psychographic?.motivations?.join(', ') || 'N/A'}
      - Mission: ${p.psychographic?.mission || 'N/A'}
      - Fashion Aesthetic: ${p.fashionStyle?.aesthetic || 'N/A'}
      - Signature Items: ${p.fashionStyle?.signatureItems?.join(', ') || 'N/A'}
      - Photography Style: ${p.fashionStyle?.photographyStyle || 'N/A'}
      - Lifestyle Routine: ${p.lifestyle?.routine || 'N/A'}
      - Social Media Presence: ${p.lifestyle?.socialMediaPresence || 'N/A'}
      - Backstory: ${p.backstory || 'N/A'}
      - Friends/Companions: ${(p.friends || []).filter(f => f.name).map(f => `${f.name} (${(f.traits || []).join(', ')}${f.profession ? ', ' + f.profession : ''})`).join('; ') || 'None'}

      GROUP SCENE RULES:
      - The primary persona (${p.identity.fullName}) must ALWAYS be the star and focal point of every scene.
      - If suggesting scenes with other people, reference the persona's friends by name when appropriate: ${(p.friends || []).filter(f => f.name).map(f => f.name).join(', ') || 'no friends defined'}.
      - Group scenes must feature visual diversity — people of different races and ethnicities from the primary subject.

      Current Season: ${new Date().toLocaleDateString('en-US', { month: 'long' })}.
      Return a JSON object with content for ALL THREE content types (Photo, Carousel, Video) in one response.
      The default contentType should be "Photo" but include carousel and video fields regardless.
      {
        "theme": "string",
        "sceneDescription": "string — for photo",
        "onScreenText": "string — for photo overlay",
        "caption": "string",
        "hook": "string",
        "hashtags": "string (5 tags max)",
        "cta": "string",
        "location": "string",
        "musicSuggestion": "string",
        "notes": "string",
        "storyArc": "Beautiful Day" | "Real Moment" | "Achievement" | "Lesson" | "Invitation",
        "captionTone": "Aspirational" | "Relatable" | "Educational" | "Vulnerable" | "Playful",
        "carousel": {
          "slides": [
            { "sceneDescription": "string", "onScreenText": "one sentence overlay" },
            { "sceneDescription": "string", "onScreenText": "one sentence overlay" },
            { "sceneDescription": "string", "onScreenText": "one sentence overlay" },
            { "sceneDescription": "string", "onScreenText": "one sentence overlay" }
          ]
        },
        "video": {
          "hookText": "string — first 1-3 seconds hook to grab attention",
          "thumbnailConcept": "string — description of an attractive thumbnail that makes people click",
          "audioSuggestion": "string — specific audio/music for the video",
          "cameraAngle": "string — suggested camera movement"
        }
      }
      Ensure:
      - Limit 'hashtags' to exactly 5 carefully selected hashtags.
      - Limit 'onScreenText' to a short, punchy max 3 lines.
      - "carousel.slides" MUST have exactly 4 items with scene variations.
      - Ensure scenes describe unposed CANDID or action layout moments.
      - The caption must feel authentic to the persona's voice and directly resonate with the target audience.
      - video.hookText should be a powerful 1-3 second attention grabber.
      - video.thumbnailConcept should describe an eye-catching thumbnail.`;

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
      });

      let data = JSON.parse(response.text || '{}');

      // Extract carousel slides from nested structure
      let slides: CarouselSlide[] | undefined;
      if (data.carousel?.slides) {
        slides = data.carousel.slides.map((s: any) => ({
          ...s,
          id: generateId(),
          contentType: 'Photo' as const,
        }));
      } else if (data.slides) {
        slides = data.slides.map((s: any) => ({ ...s, id: generateId(), contentType: 'Photo' as const }));
      }

      // Extract video fields
      const videoData = data.video || {};
      const videoHook = videoData.hookText || data.hook || '';
      const thumbnailConcept = videoData.thumbnailConcept || '';
      const videoAudio = videoData.audioSuggestion || data.musicSuggestion || '';
      const cameraAngle = videoData.cameraAngle || '';

      // Remove nested objects before spreading
      delete data.carousel;
      delete data.video;
      delete data.slides;

      const newDay: ContentDay = {
        ...emptyDay(selectedPersona.id),
        id: generateId(),
        dayNumber: personaDays.length + 1,
        date: new Date().toISOString().split('T')[0],
        ...data,
        contentType: 'Photo' as ContentType,
        hook: videoHook || data.hook || '',
        notes: thumbnailConcept ? `[THUMBNAIL] ${thumbnailConcept}\n${data.notes || ''}` : (data.notes || ''),
        musicSuggestion: videoAudio || data.musicSuggestion || '',
        styleOption: cameraAngle || data.styleOption || '',
        slides,
        hairstyle: getRandomHairstyle(),
        isAIGenerated: true,
        status: 'draft',
      };

      await saveDay(newDay);
      setDays(prev => [...prev, newDay]);
      setSelectedDayId(newDay.id);
      setEditedDay(newDay);
      setShowAIPromptModal(false);
      setShowNewPostPrompt(false);
      setAiPrompt('');
      setNewPostPromptText('');
    } catch (error: any) {
      console.error("Failed to generate content plan:", error);
      setError(`AI content plan failed: ${error.message}`);
    } finally {
      setIsAIGenerating(false);
    }
  }, [aiPrompt, selectedAudienceSegment, selectedContentFocus, selectedPersona, personaDays]);

  // ============================================================================
  // AI Persona from Description
  // ============================================================================

  const handleAIPersona = useCallback(async () => {
    if (!aiPersonaDescription.trim() || !editedPersona) return;
    setIsAIPersonaGenerating(true);
    setError('');

    try {
      const ai = await getAiInstance();
      const prompt = `Generate a complete social media persona based on this description: "${aiPersonaDescription}".
      Return a JSON object matching this exact structure:
      {
        "identity": { "fullName": "string", "age": number, "gender": "string", "nationality": "string", "birthplace": "string", "profession": "string", "locations": ["string"] },
        "appearance": { "height": "string", "bodyType": "string", "faceShape": "string", "eyes": "string", "hair": "string", "distinctFeatures": ["string"] },
        "psychographic": { "coreTraits": ["string"], "interests": ["string"], "values": ["string"], "fears": ["string"], "motivations": ["string"], "mission": "string" },
        "backstory": "string",
        "fashionStyle": { "aesthetic": "string", "signatureItems": ["string"], "photographyStyle": "string" },
        "lifestyle": { "routine": "string", "diet": "string", "socialMediaPresence": "string" }
      }
      Make it detailed, creative, and realistic.`;

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');

      // Apply all generated fields to the current persona
      if (data.identity) {
        Object.entries(data.identity).forEach(([key, value]) => {
          updatePersonaField(`identity.${key}`, value);
        });
      }
      if (data.appearance) {
        Object.entries(data.appearance).forEach(([key, value]) => {
          updatePersonaField(`appearance.${key}`, value);
        });
      }
      if (data.psychographic) {
        Object.entries(data.psychographic).forEach(([key, value]) => {
          updatePersonaField(`psychographic.${key}`, value);
        });
      }
      if (data.backstory) updatePersonaField('backstory', data.backstory);
      if (data.fashionStyle) {
        Object.entries(data.fashionStyle).forEach(([key, value]) => {
          updatePersonaField(`fashionStyle.${key}`, value);
        });
      }
      if (data.lifestyle) {
        Object.entries(data.lifestyle).forEach(([key, value]) => {
          updatePersonaField(`lifestyle.${key}`, value);
        });
      }
      setAiPersonaDescription('');
    } catch (error: any) {
      console.error("Failed to generate persona:", error);
      setError(`AI persona generation failed: ${error.message}`);
    } finally {
      setIsAIPersonaGenerating(false);
    }
  }, [aiPersonaDescription, editedPersona, updatePersonaField]);

  // ============================================================================
  // Publishing
  // ============================================================================

  const useMetaApi = !!(selectedPersona?.instagramAccountId && editedSettings.metaAccessToken);

  const handlePublish = useCallback(async () => {
    if (!selectedDay) return;

    const persona = selectedPersona;
    const metaToken = editedSettings.metaAccessToken;
    const igAccountId = persona?.instagramAccountId;

    // Determine publish method
    const useMeta = !!(igAccountId && metaToken);

    if (!useMeta) {
      const blotatoKey = editedSettings.blotatoApiKey;
      if (!blotatoKey) {
        setError('No publishing method configured. Add Meta API credentials or Blotato API key in Settings.');
        return;
      }
    }

    setIsGenerating(true);
    setGeneratingStatus('Publishing...');
    setError('');

    try {
      if (useMeta) {
        // --- Meta Graph API ---
        const caption = selectedDay.hashtags
          ? `${selectedDay.caption}\n\n${selectedDay.hashtags}`
          : selectedDay.caption;

        const contentType = selectedDay.contentType;

        if (contentType === 'Photo') {
          await publishToMeta({
            imageUrl: selectedDay.customMediaUrl || selectedDay.generatedImageUrl,
            caption,
            contentType: 'Photo',
            instagramAccountId: igAccountId!,
            metaAccessToken: metaToken!,
          });
        } else if (contentType === 'Carousel') {
          const slideUrls = (selectedDay.slides as any[])
            ?.map((s: any) => s.generatedImageUrl)
            .filter(Boolean) || [];
          await publishToMeta({
            caption,
            contentType: 'Carousel',
            slideImageUrls: slideUrls,
            instagramAccountId: igAccountId!,
            metaAccessToken: metaToken!,
          });
        } else if (contentType === 'Video') {
          await publishToMeta({
            videoUrl: selectedDay.generatedVideoUrl,
            caption,
            contentType: 'Video',
            instagramAccountId: igAccountId!,
            metaAccessToken: metaToken!,
          });
        }
      } else {
        // --- Fallback: Blotato ---
        const blotatoKey = editedSettings.blotatoApiKey!;
        const base = editedSettings.publicTunnelUrl || window.location.origin;
        const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
        const mapUrl = (u?: string) => u?.startsWith('/') ? `${cleanBase}${u}` : u;

        const isVideo = !!(selectedDay.generatedVideoUrl || selectedDay.customMediaUrl);
        const finalVideo = isVideo ? mapUrl(selectedDay.generatedVideoUrl || selectedDay.customMediaUrl) : undefined;
        const finalImage = !isVideo ? mapUrl(selectedDay.generatedImageUrl) : undefined;

        await publishToBlotato({
          image: finalImage,
          video: finalVideo,
          caption: selectedDay.caption,
          hashtags: selectedDay.hashtags,
          contentType: isVideo ? 'Video' : selectedDay.contentType,
          blotatoApiKey: blotatoKey,
          dayId: selectedDay.id,
        });
      }

      updateDayField('status', 'published');
    } catch (error: any) {
      console.error("Publishing failed:", error);
      setError(`Publishing failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  }, [selectedDay, selectedPersona, editedSettings, updateDayField]);

  // ============================================================================
  // Google Sheets Import
  // ============================================================================

  const handleImportSheet = useCallback(async () => {
    if (!importSheetId.trim() || !selectedPersonaId) return;
    setIsAIGenerating(true);
    setError('');

    try {
      const url = `https://docs.google.com/spreadsheets/d/${importSheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(importSheetName)}`;
      const response = await fetch(url);
      const data = await response.text();
      const match = data.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);

      if (!match) throw new Error("Could not parse Google Sheet response. Make sure it is shared publicly.");

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

        const hasData = c.some((cell: any) => cell && cell.v !== null && cell.v !== undefined && cell.v !== '');
        if (!hasData) return;

        const dayNum = parseInt(getValue(0).toString());
        const rowTheme = getValue(4).toString();

        if (importAvoidDuplicates) {
          const isDuplicate = days.some(d =>
            d.personaId === selectedPersonaId &&
            (d.theme === rowTheme || d.dayNumber === dayNum)
          );
          if (isDuplicate) return;
        }

        const dayOffset = Math.floor(index / importPostsPerDay);
        const calcDate = new Date(importStartDate);
        calcDate.setDate(calcDate.getDate() + dayOffset);
        const formattedDate = calcDate.toISOString().split('T')[0];

        newDays.push({
          ...emptyDay(selectedPersonaId),
          id: generateId(),
          dayNumber: isNaN(dayNum) ? (index + 1) : dayNum,
          date: formattedDate,
          platforms: [getValue(2).toString() || 'Instagram'] as Platform[],
          contentType: (getValue(3).toString() || 'Photo') as ContentType,
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
        });
      });

      if (newDays.length > 0) {
        for (const day of newDays) {
          await saveDay(day);
        }
        setDays(prev => [...prev, ...newDays]);
        setSelectedDayId(newDays[0].id);
        setEditedDay(newDays[0]);
        setShowImportModal(false);
        setImportSheetId('');
      } else {
        setError("No data found in sheet (or all rows were duplicates).");
      }
    } catch (error: any) {
      console.error("Sheet import failed:", error);
      setError(`Import failed: ${error.message}`);
    } finally {
      setIsAIGenerating(false);
    }
  }, [importSheetId, importSheetName, importStartDate, importPostsPerDay, importAvoidDuplicates, selectedPersonaId, days]);

  // ============================================================================
  // Loading state
  // ============================================================================

  if (loading) {
    return (
      <div className="h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-text-secondary animate-spin" />
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-screen flex bg-surface-0 text-text-primary overflow-hidden relative">

      {/* ================================================================== */}
      {/* WORKSPACE MODE SWITCHER (slide panel)                              */}
      {/* ================================================================== */}
      <AnimatePresence>
        {showModeSwitcher && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mode-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModeSwitcher(false)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            {/* Panel */}
            <motion.div
              key="mode-panel"
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[260px] bg-surface-50 border-r border-border flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Workspace</h3>
              </div>
              <div className="flex-1 p-3 space-y-2">
                <button
                  onClick={() => switchWorkspaceMode('studio')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-4 rounded-xl border transition-all text-left',
                    workspaceMode === 'studio'
                      ? 'border-brand-500/40 bg-brand-500/10 ring-1 ring-brand-500/20'
                      : 'border-border bg-surface-50/60 hover:border-border-light hover:bg-surface-200/60'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    workspaceMode === 'studio' ? 'bg-brand-500/20' : 'bg-surface-200'
                  )}>
                    <Sparkles className={cn('w-5 h-5', workspaceMode === 'studio' ? 'text-brand-400' : 'text-text-muted')} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', workspaceMode === 'studio' ? 'text-text-primary' : 'text-text-secondary')}>Studio</p>
                    <p className="text-[11px] text-text-muted">Content creation & calendar</p>
                  </div>
                  {workspaceMode === 'studio' && <Check className="w-4 h-4 text-brand-400 ml-auto" />}
                </button>
                <button
                  onClick={() => switchWorkspaceMode('ugc')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-4 rounded-xl border transition-all text-left',
                    workspaceMode === 'ugc'
                      ? 'border-accent-500/40 bg-accent-500/10 ring-1 ring-accent-500/20'
                      : 'border-border bg-surface-50/60 hover:border-border-light hover:bg-surface-200/60'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    workspaceMode === 'ugc' ? 'bg-accent-500/20' : 'bg-surface-200'
                  )}>
                    <Zap className={cn('w-5 h-5', workspaceMode === 'ugc' ? 'text-accent-400' : 'text-text-muted')} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', workspaceMode === 'ugc' ? 'text-text-primary' : 'text-text-secondary')}>UGC</p>
                    <p className="text-[11px] text-text-muted">Product-to-video pipeline</p>
                  </div>
                  {workspaceMode === 'ugc' && <Check className="w-4 h-4 text-accent-400 ml-auto" />}
                </button>
              </div>
              <div className="p-4 border-t border-border text-center">
                <p className="text-[10px] text-text-dim">Personas & settings are shared</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* MOBILE TOP BAR (visible only on small screens)                     */}
      {/* ================================================================== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-50 border-b border-border px-3 py-2 flex items-center justify-between">
        <button onClick={() => setMobileSidebar(true)} className="p-2 rounded-lg hover:bg-surface-200">
          <List className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex items-center gap-2">
          {workspaceMode === 'studio' ? <Sparkles className="w-4 h-4 text-brand-400" /> : <Zap className="w-4 h-4 text-accent-400" />}
          <span className="text-sm font-semibold">{selectedPersona?.identity.fullName || (workspaceMode === 'studio' ? 'Creator Studio' : 'UGC Factory')}</span>
        </div>
        <button onClick={openSettings} className="p-2 rounded-lg hover:bg-surface-200">
          <Settings className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* ================================================================== */}
      {/* MOBILE SIDEBAR OVERLAY                                             */}
      {/* ================================================================== */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setMobileSidebar(false)}
            />
            <motion.div
              key="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[320px] z-50 flex"
            >
              {/* Persona rail inside mobile sidebar */}
              <div className="w-[60px] flex-shrink-0 bg-surface-50 border-r border-border flex flex-col items-center py-3 gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2">
                  <img src="/logo.png" alt="CS" className="w-8 h-8" />
                </div>
                <button onClick={handleNewPersona} className="w-9 h-9 rounded-full bg-surface-200 hover:bg-surface-300 flex items-center justify-center flex-shrink-0 mb-1">
                  <Plus className="w-4 h-4 text-text-muted" />
                </button>
                <div className="flex-1 overflow-y-auto space-y-2 w-full flex flex-col items-center scrollbar-hide">
                  {personas.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { selectPersona(p.id); }}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all flex-shrink-0 bg-surface-200',
                        p.id === selectedPersonaId && 'ring-2 ring-white ring-offset-1 ring-offset-surface-50'
                      )}
                    >
                      {p.referenceImageUrl ? (
                        <img src={p.referenceImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-text-secondary">{getInitials(p.identity.fullName)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {/* Content sidebar inside mobile */}
              <div className="flex-1 bg-surface-0 flex flex-col overflow-hidden">
                {selectedPersona && (
                  <div className="p-3 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-text-primary truncate">{selectedPersona.identity.fullName}</h2>
                        <p className="text-xs text-text-muted truncate">{selectedPersona.identity.profession}</p>
                      </div>
                      <button onClick={() => { openPersonaEditor(); setMobileSidebar(false); }} className="p-1.5 rounded-lg hover:bg-surface-200 text-text-muted">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="p-2 space-y-1.5 border-b border-border">
                  <div className="flex gap-1.5">
                    <button onClick={() => { setShowNewPostPrompt(true); setMobileSidebar(false); }} disabled={!selectedPersonaId} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-accent-600 text-white rounded-lg text-xs font-medium">
                      <Plus className="w-3.5 h-3.5" /> New Post
                    </button>
                    <button onClick={() => { setShowImportModal(true); setMobileSidebar(false); }} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-surface-200 rounded-lg text-xs font-medium text-text-secondary">
                      <Upload className="w-3.5 h-3.5" /> Import
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {personaDays.map(day => {
                    const { month, day: dayNum } = formatDate(day.date);
                    const isPublished = day.status === 'published';
                    return (
                      <button key={day.id} onClick={() => selectDay(day.id)} className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-border/50',
                        day.id === selectedDayId ? 'bg-white/5 border-l-2 border-l-white' : ''
                      )}>
                        <div className="w-9 h-9 rounded-lg bg-surface-200 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-[8px] font-bold text-text-muted">{month}</span>
                          <span className="text-xs font-bold text-text-primary">{dayNum}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-text-primary truncate">{day.theme || 'Untitled'}</p>
                          <div className="flex items-center gap-1">
                            <span className={cn('text-[9px] px-1 py-0.5 rounded-full font-medium', STATUS_COLORS[day.status])}>{day.status}</span>
                            {isPublished && <Lock className="w-2.5 h-2.5 text-brand-400" />}
                          </div>
                        </div>
                        {day.generatedImageUrl && (
                          <img src={day.generatedImageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* COLUMN 1: Persona Rail (hidden on mobile)                          */}
      {/* ================================================================== */}
      <div className={cn("hidden md:flex w-[72px] flex-shrink-0 bg-surface-50 border-r border-border flex-col items-center py-3 gap-2 transition-all duration-300", rightPanel !== 'none' && "blur-sm opacity-50 pointer-events-none")}>
        {/* Logo — click to switch workspace */}
        <button
          onClick={() => setShowModeSwitcher(prev => !prev)}
          title="Switch workspace"
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 hover:ring-2 hover:ring-accent-500/50 transition-all relative"
        >
          <img src="/logo.png" alt="Creator Studio" className="w-9 h-9" />
          {/* Mode indicator dot */}
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-50',
            workspaceMode === 'studio' ? 'bg-brand-500 text-white' : 'bg-accent-500'
          )} />
        </button>

        {/* Add Persona */}
        <button
          onClick={handleNewPersona}
          title="Add new persona"
          className="w-10 h-10 rounded-full bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors mb-1"
        >
          <Plus className="w-5 h-5 text-text-muted" />
        </button>

        {/* Persona Avatars */}
        <div className="flex-1 overflow-y-auto space-y-2 w-full flex flex-col items-center py-1 scrollbar-hide">
          {(() => {
            const sortedPersonas = [...personas].sort((a, b) => {
              const aPinned = pinnedPersonaIds.has(a.id);
              const bPinned = pinnedPersonaIds.has(b.id);
              if (aPinned && !bPinned) return -1;
              if (!aPinned && bPinned) return 1;
              return 0;
            });
            const pinnedCount = sortedPersonas.filter(p => pinnedPersonaIds.has(p.id)).length;

            return sortedPersonas.map((p, idx) => (
              <React.Fragment key={p.id}>
                {pinnedCount > 0 && idx === pinnedCount && (
                  <div className="w-8 border-t border-border-light/60 my-0.5" />
                )}
                <button
                  onClick={() => selectPersona(p.id)}
                  title={p.identity.fullName}
                  className={cn(
                    'relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all flex-shrink-0',
                    'bg-surface-200 hover:bg-surface-300',
                    p.id === selectedPersonaId && 'ring-2 ring-white ring-offset-2 ring-offset-surface-50'
                  )}
                >
                  {p.referenceImageUrl ? (
                    <img src={p.referenceImageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <span className="text-text-secondary">{getInitials(p.identity.fullName)}</span>
                  )}
                  {pinnedPersonaIds.has(p.id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-accent-500 border-2 border-surface-50" />
                  )}
                </button>
              </React.Fragment>
            ));
          })()}
        </div>

        {/* Library — UGC mode only, above Settings */}
        {workspaceMode === 'ugc' && (
          <button
            onClick={() => setShowLibrary(prev => !prev)}
            title="Production Library"
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
              showLibrary ? 'bg-accent-500/20 text-accent-400 ring-1 ring-accent-500/30' : 'bg-surface-200 hover:bg-surface-300 text-text-muted'
            )}
          >
            <BookOpen className="w-5 h-5" />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={openSettings}
          title="Settings"
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            rightPanel === 'settings' ? 'bg-accent-600 text-white' : 'bg-surface-200 hover:bg-surface-300 text-text-muted'
          )}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* ================================================================== */}
      {/* COLUMN 2: Content Sidebar (hidden on mobile)                       */}
      {/* ================================================================== */}
      <div className={cn("hidden md:flex w-[280px] flex-shrink-0 bg-surface-50/60 border-r border-border flex-col transition-all duration-300", rightPanel !== 'none' && "blur-sm opacity-50 pointer-events-none")}>

        {/* Production Library sidebar — replaces nav when open */}
        {showLibrary ? (
          <ProductionLibrarySidebar
            onClose={() => { setShowLibrary(false); setLibrarySection(null); }}
            activeSection={librarySection as any}
            onSelectSection={(s) => setLibrarySection(s)}
          />
        ) : (
        <>
        {/* Persona Header */}
        {selectedPersona ? (
          <div className="p-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-text-primary truncate">
                  {selectedPersona.identity.fullName}
                </h2>
                <p className="text-sm text-text-muted truncate">{selectedPersona.identity.profession}</p>
              </div>
              <button
                onClick={openPersonaEditor}
                className="ml-2 p-1.5 rounded-lg hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                title="Edit persona"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-border">
            <p className="text-sm text-text-muted">No persona selected</p>
          </div>
        )}

        {/* Action Buttons — changes based on workspace mode */}
        {workspaceMode === 'studio' ? (
          <div className="p-3 space-y-2 border-b border-border">
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewPostPrompt(true)}
                disabled={!selectedPersonaId}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-600 text-white hover:bg-accent-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> New Post
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowImportModal(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-200 hover:bg-surface-300 rounded-lg text-sm font-medium text-text-secondary transition-colors">
                <Upload className="w-4 h-4" /> Import
              </button>
              <div className="flex bg-surface-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-2 text-sm transition-colors',
                    viewMode === 'list' ? 'bg-accent-600 text-white' : 'text-text-muted hover:text-text-primary'
                  )}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    'px-3 py-2 text-sm transition-colors',
                    viewMode === 'calendar' ? 'bg-accent-600 text-white' : 'text-text-muted hover:text-text-primary'
                  )}
                  title="Calendar view"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2 border-b border-border">
            <button
              onClick={() => { setShowNewUGCPrompt(true); setUgcProductUrl(''); setUgcAffiliateUrl(''); }}
              disabled={!selectedPersonaId}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <Plus className="w-4 h-4" /> New Video Package
            </button>
            <div className="flex bg-surface-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex-1 px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5',
                  viewMode === 'list' ? 'bg-accent-500 text-white' : 'text-text-muted hover:text-text-primary'
                )}
                title="List view"
              >
                <List className="w-4 h-4" /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex-1 px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5',
                  viewMode === 'calendar' ? 'bg-accent-600 text-white' : 'text-text-muted hover:text-text-primary'
                )}
                title="Calendar view"
              >
                <Calendar className="w-4 h-4" /> Calendar
              </button>
            </div>
          </div>
        )}

        {/* Day List */}
        <div className="flex-1 overflow-y-auto">
          {personaDays.length === 0 ? (
            <div className="p-4 text-center text-text-muted text-sm">
              No content days yet. Click "New Post" to start.
            </div>
          ) : (
            personaDays.map((day, idx) => {
              const { month, day: dayNum } = formatDate(day.date);
              const isPublished = day.status === 'published';
              return (
                <div
                  key={day.id}
                  draggable={!isPublished}
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', day.id);
                    e.dataTransfer.effectAllowed = 'move';
                    (e.currentTarget as HTMLElement).style.opacity = '0.4';
                  }}
                  onDragEnd={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onDragOver={e => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    (e.currentTarget as HTMLElement).style.borderTop = '2px solid #f43f5e';
                  }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderTop = ''; }}
                  onDrop={e => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).style.borderTop = '';
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (!draggedId || draggedId === day.id) return;
                    // Swap dates between dragged and drop target
                    const draggedDay = personaDays.find(d => d.id === draggedId);
                    if (draggedDay && draggedDay.status !== 'published') {
                      const tempDate = draggedDay.date;
                      handleUpdateDayDate(draggedId, day.date);
                      handleUpdateDayDate(day.id, tempDate);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/50 group/sidebar cursor-pointer',
                    day.id === selectedDayId ? 'bg-white/5 border-l-2 border-l-white' : 'hover:bg-surface-200/50'
                  )}
                  onClick={() => selectDay(day.id)}
                >
                  {/* Date box — acts as drag affordance */}
                  <div className={cn(
                    "w-10 h-10 rounded-lg bg-surface-200 flex flex-col items-center justify-center flex-shrink-0 transition-colors",
                    !isPublished && "group-hover/sidebar:bg-surface-300 cursor-grab active:cursor-grabbing"
                  )}>
                    <span className="text-[9px] font-bold text-text-muted leading-none">{month}</span>
                    <span className="text-sm font-bold text-text-primary leading-tight">{dayNum}</span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{day.theme || 'Untitled'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[day.status])}>
                        {day.status}
                      </span>
                      {isPublished && <Lock className="w-3 h-3 text-brand-400" />}
                      {day.isGoodToPost && !isPublished && <Check className="w-3 h-3 text-emerald-400" />}
                      {/* Content type icon */}
                      {day.contentType === 'Photo' && <Image className="w-3 h-3 text-text-muted" />}
                      {day.contentType === 'Video' && <Video className="w-3 h-3 text-text-muted" />}
                      {day.contentType === 'Carousel' && <LayoutGrid className="w-3 h-3 text-text-muted" />}
                      <span className="text-[10px] text-text-muted">
                        {day.platforms.map(p => PLATFORM_LETTERS[p]).join('/')}
                      </span>
                    </div>
                  </div>

                  {/* Delete button for error posts */}
                  {day.theme?.startsWith('Error:') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDay(day.id); }}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      title="Delete failed post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Image thumbnail */}
                  {!day.theme?.startsWith('Error:') && (day.generatedImageUrl || day.customMediaUrl || day.thumbnailUrl) && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={driveDisplayUrl(day.thumbnailUrl || day.customMediaUrl || day.generatedImageUrl)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="p-2 border-t border-border flex items-center justify-center gap-1.5 text-xs text-text-muted">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </div>
        )}
        </>
        )}
      </div>

      {/* ================================================================== */}
      {/* COLUMN 3: Main Canvas                                              */}
      {/* ================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 relative pt-12 md:pt-0">
        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="hover:text-text-primary"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* New Post Prompt Panel */}
        <AnimatePresence>
          {showNewPostPrompt && selectedPersona && (
            <motion.div
              key="new-post-prompt"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 z-10 overflow-y-auto bg-gradient-to-b from-gray-900/80 to-gray-950/60 backdrop-blur-sm px-4 md:px-6 py-5"
            >
              <div className="max-w-3xl mx-auto space-y-4 py-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-400" /> New Post
                  </h3>
                  <button onClick={() => setShowNewPostPrompt(false)} className="p-1.5 rounded-lg hover:bg-surface-200 text-text-muted">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Row 1: Prompt */}
                <textarea
                  value={newPostPromptText}
                  onChange={e => setNewPostPromptText(e.target.value)}
                  className="w-full bg-surface-200/60 border border-border-light rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm min-h-[100px] resize-y outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50"
                  placeholder={`Describe this post... e.g., "${selectedPersona.identity.fullName} is traveling to Atlanta, visiting City Market downtown, nice motivational quotes about how beautiful the place is"`}
                  disabled={isAIGenerating}
                />

                {/* Row 2: Target Audience (selectable cards) */}
                <div>
                  <label className="block text-xs text-text-muted font-medium mb-2">Target Audience</label>
                  {(selectedPersona.targetAudiences && selectedPersona.targetAudiences.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {selectedPersona.targetAudiences.map(seg => (
                        <button
                          key={seg.id}
                          onClick={() => setSelectedAudienceSegment(seg.segmentName)}
                          disabled={isAIGenerating}
                          className={cn(
                            'text-left px-3 py-2.5 rounded-xl border transition-all',
                            selectedAudienceSegment === seg.segmentName
                              ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                              : 'border-border-light bg-surface-200/40 hover:border-border-light'
                          )}
                        >
                          <p className={cn('text-sm font-medium', selectedAudienceSegment === seg.segmentName ? 'text-brand-300' : 'text-text-primary')}>{seg.segmentName}</p>
                          <p className="text-xs text-text-muted mt-0.5">{seg.coreAspiration}</p>
                          <p className="text-[10px] text-text-dim mt-0.5">{seg.ageRange}{seg.genderSkew ? ` · ${seg.genderSkew}` : ''}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted bg-surface-200/40 rounded-xl px-3 py-3 border border-border-light">
                      No target audiences defined.{' '}
                      <button onClick={() => setRightPanel('persona-editor')} className="text-brand-400 hover:text-brand-300 underline">Edit persona</button>
                      {' '}to set them up.
                    </div>
                  )}
                </div>

                {/* Row 3: Content Focus (tag pills) */}
                <div>
                  <label className="block text-xs text-text-muted font-medium mb-2">Content Focus</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const personaThemes = selectedPersona?.contentThemes || [];
                      const personaInterests = selectedPersona?.psychographic?.interests || [];
                      const fallback = ['Fashion', 'Travel', 'Motivational', 'Lifestyle', 'Beauty', 'Wellness', 'Relationship', 'Behind the Scenes'];
                      const merged = personaThemes.length > 0
                        ? [...new Set([...personaThemes, ...personaInterests])]
                        : [...new Set([...fallback, ...personaInterests])];
                      return merged.map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            setSelectedContentFocus(prev => {
                              if (prev.includes(tag)) return prev.filter(t => t !== tag);
                              if (prev.length >= 2) return [prev[1], tag];
                              return [...prev, tag];
                            });
                          }}
                          disabled={isAIGenerating}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            selectedContentFocus.includes(tag)
                              ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                              : 'border-border-light bg-surface-200/40 text-text-muted hover:text-text-primary hover:border-border-light'
                          )}
                        >
                          {tag}
                        </button>
                      ));
                    })()}
                  </div>
                  <p className="text-[10px] text-text-dim mt-1">Select 1-2 themes</p>
                </div>

                {/* Row 4: Generate button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAIContentPlan(newPostPromptText, selectedAudienceSegment, selectedContentFocus)}
                    disabled={!newPostPromptText.trim() || isAIGenerating}
                    className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center gap-2"
                  >
                    {isAIGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Post</>}
                  </button>
                  <button
                    onClick={() => { handleNewDay(); setShowNewPostPrompt(false); }}
                    className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    or create blank post
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New UGC Package Prompt Panel (mirrors New Post Prompt) */}
        <AnimatePresence>
          {showNewUGCPrompt && selectedPersona && (
            <motion.div
              key="new-ugc-prompt"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 z-10 overflow-y-auto bg-gradient-to-b from-gray-900/80 to-gray-950/60 backdrop-blur-sm px-4 md:px-6 py-5"
            >
              <div className="max-w-3xl mx-auto space-y-5 py-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent-400" /> New Video Package
                  </h3>
                  <button onClick={() => setShowNewUGCPrompt(false)} className="p-1.5 rounded-lg hover:bg-surface-200 text-text-muted">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Product URL / Description */}
                <div>
                  <label className="block text-xs text-text-muted font-medium mb-2">Product URL or Description</label>
                  <textarea
                    value={ugcProductUrl}
                    onChange={e => setUgcProductUrl(e.target.value)}
                    className="w-full bg-surface-200/60 border border-border-light rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm min-h-[80px] resize-y outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500/50"
                    placeholder="Paste an Amazon or TikTok Shop URL, or describe the product with details (name, price, features, reviews)..."
                    disabled={isUGCGenerating}
                  />
                </div>

                {/* Affiliate URL (optional) */}
                <div>
                  <label className="block text-xs text-text-muted font-medium mb-2">
                    Affiliate Link <span className="text-text-dim">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={ugcAffiliateUrl}
                    onChange={e => setUgcAffiliateUrl(e.target.value)}
                    className="w-full bg-surface-200/60 border border-border-light rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                    placeholder="https://amazon.com/dp/...?tag=your-affiliate-tag"
                    disabled={isUGCGenerating}
                  />
                  <p className="text-[10px] text-text-dim mt-1">Will be included in TikTok & Instagram captions with disclosure</p>
                </div>

                {/* Mode Toggle */}
                <div>
                  <label className="block text-xs text-text-muted font-medium mb-2">Pipeline Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUgcMode('auto')}
                      disabled={isUGCGenerating}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl border text-left transition-all',
                        ugcMode === 'auto'
                          ? 'border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30'
                          : 'border-border-light bg-surface-200/40 hover:border-border-light'
                      )}
                    >
                      <p className={cn('text-sm font-medium', ugcMode === 'auto' ? 'text-accent-300' : 'text-text-primary')}>Auto</p>
                      <p className="text-xs text-text-muted mt-0.5">Run all 6 steps automatically</p>
                    </button>
                    <button
                      onClick={() => setUgcMode('hitl')}
                      disabled={isUGCGenerating}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl border text-left transition-all',
                        ugcMode === 'hitl'
                          ? 'border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30'
                          : 'border-border-light bg-surface-200/40 hover:border-border-light'
                      )}
                    >
                      <p className={cn('text-sm font-medium', ugcMode === 'hitl' ? 'text-accent-300' : 'text-text-primary')}>Human-in-the-Loop</p>
                      <p className="text-xs text-text-muted mt-0.5">Review & edit each step [Coming Soon]</p>
                    </button>
                  </div>
                </div>

                {/* Pipeline steps preview */}
                <div>
                  <label className="block text-xs text-text-muted font-medium mb-2">Pipeline Steps</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: '1', label: 'Product Intel', desc: 'Features, pricing, reviews' },
                      { icon: '2', label: 'Strategy', desc: 'Hook format, setting, timing' },
                      { icon: '3', label: 'Script', desc: '10 hooks + timed script' },
                      { icon: '4', label: 'Visual Prompts', desc: '5 shots with character lock' },
                      { icon: '5', label: 'Audio', desc: 'ElevenLabs + trending sounds' },
                      { icon: '6', label: 'Metadata', desc: 'Captions, hashtags, schedule' },
                    ].map(step => (
                      <div key={step.icon} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border bg-surface-200/30">
                        <span className="w-5 h-5 rounded-full bg-accent-500/15 text-accent-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{step.icon}</span>
                        <div>
                          <p className="text-xs font-medium text-text-secondary">{step.label}</p>
                          <p className="text-[10px] text-text-dim">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Persona info */}
                <div className="flex items-center gap-3 bg-surface-200/40 rounded-xl px-4 py-3 border border-border-light">
                  {selectedPersona.referenceImageUrl && (
                    <img src={selectedPersona.referenceImageUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-border-light" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{selectedPersona.identity.fullName}</p>
                    <p className="text-xs text-text-muted">Character lock will be built from this persona's appearance</p>
                  </div>
                </div>

                {/* Generate button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (!selectedPersonaId || !ugcProductUrl.trim()) return;
                      setIsUGCGenerating(true);
                      // Create the UGC post in sidebar immediately
                      const nd = emptyDay(selectedPersonaId, 'ugc');
                      nd.contentType = 'Video';
                      nd.platforms = ['TikTok', 'Instagram'];
                      nd.dayNumber = personaDays.length + 1;
                      nd.productUrl = ugcProductUrl;
                      nd.cta = ugcAffiliateUrl || '';
                      nd.status = 'generating';
                      nd.theme = 'Generating...';
                      setDays(prev => [...prev, nd]);
                      setSelectedDayId(nd.id);
                      setEditedDay(nd);
                      saveDay(nd).catch(console.error);
                      setShowNewUGCPrompt(false);

                      try {
                        // Call real pipeline — Claude generates all 6 steps
                        const response = await fetch('/api/ugc/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            productUrl: ugcProductUrl,
                            productText: ugcProductUrl,
                            personaId: selectedPersonaId,
                            persona: selectedPersona,
                            mode: ugcMode,
                          }),
                        });

                        if (!response.ok) {
                          const err = await response.json();
                          throw new Error(err.error || 'Pipeline failed');
                        }

                        const result = await response.json();

                        // Update the post with real pipeline data
                        nd.theme = result.productIntel?.productName || 'UGC Package';
                        nd.hook = result.script?.selectedHook || '';
                        nd.caption = result.metadata?.tiktok?.caption || '';
                        nd.hashtags = result.metadata?.tiktok?.hashtags?.map((h: any) => h.tag).join(' ') || '';
                        nd.cta = result.script?.fullScript?.ctaSection?.voiceover || '';
                        nd.sceneDescription = result.visuals?.shotPrompts?.map((s: any) => s.fullPrompt).join('\n\n') || '';
                        nd.onScreenText = [
                          result.script?.fullScript?.hookSection?.textOverlay,
                          result.script?.fullScript?.productSection?.textOverlay,
                          result.script?.fullScript?.trustSection?.textOverlay,
                          result.script?.fullScript?.ctaSection?.textOverlay,
                        ].filter(Boolean).join(' | ');
                        nd.musicSuggestion = result.audio?.trendingSoundOptions?.find((s: any) => s.recommended)?.soundName || '';
                        nd.location = result.strategy?.setting || '';
                        nd.notes = JSON.stringify(result);
                        nd.status = 'completed';
                        nd.ugcRunId = result.id;

                        setEditedDay({ ...nd });
                        setDays(prev => prev.map(d => d.id === nd.id ? { ...nd } : d));
                        saveDay(nd).catch(console.error);
                      } catch (err: any) {
                        console.error('UGC Pipeline error:', err);
                        nd.theme = 'Error: ' + (err.message || 'Pipeline failed');
                        nd.status = 'draft';
                        setEditedDay({ ...nd });
                        setDays(prev => prev.map(d => d.id === nd.id ? { ...nd } : d));
                        setError(err.message || 'UGC pipeline failed');
                      } finally {
                        setIsUGCGenerating(false);
                      }
                    }}
                    disabled={!ugcProductUrl.trim() || isUGCGenerating}
                    className="px-6 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center gap-2"
                  >
                    {isUGCGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Video Package</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        {showLibrary ? (
          <ProductionLibraryCanvas
            activeSection={librarySection as any}
            onSelectSection={(s) => setLibrarySection(s)}
          />
        ) : viewMode === 'calendar' ? (
          <CalendarGrid
            days={personaDays}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDayId={selectedDayId}
            onSelectDay={selectDay}
            onUpdateDay={handleUpdateDayDate}
            onDuplicateDay={handleDuplicateDay}
          />
        ) : selectedDay ? (
          workspaceMode === 'ugc' ? (
            <UGCPostCard
              day={selectedDay}
              persona={selectedPersona}
              onUpdateField={updateDayField}
              onDelete={() => handleDeleteDay(selectedDay.id)}
            />
          ) : (
            <PostCard
              day={selectedDay}
              persona={selectedPersona}
              onUpdateField={updateDayField}
              onDelete={() => handleDeleteDay(selectedDay.id)}
              onDuplicate={() => handleDuplicateDay(selectedDay.id)}
              onGenerateImage={handleGenerateImage}
              onConfirmGenerate={() => {
                setConfirmModal({
                  title: 'Generate Image',
                  message: 'This will use AI credits to generate a new image. Existing image will be replaced.',
                  confirmLabel: 'Generate',
                  confirmVariant: 'default',
                  onConfirm: () => { handleGenerateImage(); setConfirmModal(null); },
                });
              }}
              onGenerateVideo={handleGenerateVideo}
              onGenerateThumbnail={handleGenerateThumbnail}
              onPublish={handlePublish}
              publishLabel={useMetaApi ? 'Publish to Instagram' : 'Publish via Blotato'}
              isGenerating={isGenerating}
              generatingStatus={generatingStatus}
              videoStatus={videoStatus[selectedDay.id]}
              onOpenLightbox={setLightboxUrl}
              onOpenDrivePicker={handleOpenDrivePicker}
              driveFiles={driveFiles}
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-text-dim" />
              <p className="text-lg">Select a post or create a new one</p>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* RIGHT PANEL OVERLAYS                                             */}
        {/* ================================================================ */}
        <AnimatePresence>
          {rightPanel === 'persona-editor' && editedPersona && (
            <motion.div
              key="persona-editor"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-0 z-30 bg-surface-0/95 backdrop-blur-sm overflow-y-auto"
            >
              <PersonaEditorPanel
                persona={editedPersona}
                onUpdateField={updatePersonaField}
                onClose={() => setRightPanel('none')}
                onDelete={() => {
                  handleDeletePersona(editedPersona.id);
                  setRightPanel('none');
                }}
                aiDescription={aiPersonaDescription}
                onAiDescriptionChange={setAiPersonaDescription}
                onGenerateAIPersona={handleAIPersona}
                isAIGenerating={isAIPersonaGenerating}
                onShowConfirm={setConfirmModal}
                onSyncDrive={handleSyncDrive}
                driveLoading={driveLoading}
                globalDriveFolderUrl={editedSettings.driveFolderUrl}
                globalPostingMode={editedSettings.postingMode}
                globalPostingTime={editedSettings.postingTime}
                globalPostingEndTime={editedSettings.postingEndTime}
                globalPostsPerDay={editedSettings.postsPerDay}
                globalMetaAccessToken={editedSettings.metaAccessToken}
                isPinned={pinnedPersonaIds.has(editedPersona.id)}
                onTogglePin={() => togglePinPersona(editedPersona.id)}
              />
            </motion.div>
          )}

          {rightPanel === 'settings' && (
            <motion.div
              key="settings"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-0 z-30 bg-surface-0/95 backdrop-blur-sm overflow-y-auto"
            >
              <SettingsPanel
                settings={editedSettings}
                onUpdateField={updateSettingsField}
                onClose={() => setRightPanel('none')}
                onSignOut={signOut}
                onSave={async () => {
                  setSaving(true);
                  try {
                    await saveUserSettings(editedSettings);
                    setSettings(editedSettings);
                  } catch { }
                  setSaving(false);
                }}
                saving={saving}
                userEmail={user?.email ?? ''}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================== */}
      {/* GLOBAL MODALS                                                      */}
      {/* ================================================================== */}
      <AnimatePresence>
        {/* AI Prompt Modal */}
        {showAIPromptModal && (
          <motion.div
            key="ai-prompt-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isAIGenerating && setShowAIPromptModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-50 border border-border-light rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-400" /> AI Content Plan
                </h3>
                <button onClick={() => setShowAIPromptModal(false)} disabled={isAIGenerating} className="p-1.5 rounded-lg hover:bg-surface-200 text-text-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-text-muted">
                Describe a content idea and AI will generate a full content day plan for {selectedPersona?.identity.fullName || 'your persona'}.
              </p>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="input-field min-h-[120px] resize-y"
                placeholder="e.g., Morning coffee ritual at a Parisian cafe, cozy autumn vibes..."
                disabled={isAIGenerating}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAIPromptModal(false)}
                  disabled={isAIGenerating}
                  className="px-4 py-2 rounded-lg text-sm text-text-muted hover:bg-surface-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIContentPlan}
                  disabled={!aiPrompt.trim() || isAIGenerating}
                  className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-sm font-medium text-white transition-colors flex items-center gap-2"
                >
                  {isAIGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <motion.div
            key="import-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isAIGenerating && setShowImportModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-50 border border-border-light rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Upload className="w-5 h-5 text-text-secondary" /> Import from Google Sheets
                </h3>
                <button onClick={() => setShowImportModal(false)} disabled={isAIGenerating} className="p-1.5 rounded-lg hover:bg-surface-200 text-text-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Field label="Google Sheet ID">
                <input
                  type="text"
                  value={importSheetId}
                  onChange={e => setImportSheetId(e.target.value)}
                  className="input-field"
                  placeholder="e.g., 1hplAu2wnW1AliTBuZ8ScdHDKNQAxzgGC"
                  disabled={isAIGenerating}
                />
              </Field>
              <Field label="Sheet Name">
                <input
                  type="text"
                  value={importSheetName}
                  onChange={e => setImportSheetName(e.target.value)}
                  className="input-field"
                  disabled={isAIGenerating}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date">
                  <input
                    type="date"
                    value={importStartDate}
                    onChange={e => setImportStartDate(e.target.value)}
                    className="input-field"
                    disabled={isAIGenerating}
                  />
                </Field>
                <Field label="Posts Per Day">
                  <input
                    type="number"
                    value={importPostsPerDay}
                    onChange={e => setImportPostsPerDay(parseInt(e.target.value) || 1)}
                    className="input-field"
                    min={1}
                    max={10}
                    disabled={isAIGenerating}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={importAvoidDuplicates}
                  onChange={e => setImportAvoidDuplicates(e.target.checked)}
                  className="rounded border-border-light bg-surface-200 text-brand-500 focus:ring-brand-500"
                  disabled={isAIGenerating}
                />
                Avoid duplicates
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  disabled={isAIGenerating}
                  className="px-4 py-2 rounded-lg text-sm text-text-muted hover:bg-surface-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSheet}
                  disabled={!importSheetId.trim() || isAIGenerating}
                  className="px-4 py-2 rounded-lg bg-accent-600 text-white hover:bg-accent-500 disabled:opacity-40 text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isAIGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4" /> Import</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* CONFIRM MODAL                                                      */}
      {/* ================================================================== */}
      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        confirmLabel={confirmModal?.confirmLabel}
        confirmVariant={confirmModal?.confirmVariant}
        onConfirm={() => { confirmModal?.onConfirm(); setConfirmModal(null); }}
        onCancel={() => setConfirmModal(null)}
      />

      {/* ================================================================== */}
      {/* DRIVE PICKER MODAL                                                 */}
      {/* ================================================================== */}
      <DrivePickerModal
        isOpen={showDrivePicker}
        files={driveFiles}
        mode={drivePickerMode}
        loading={driveLoading}
        onSync={handleSyncDrive}
        onSelect={handleDriveSelect}
        onClose={() => setShowDrivePicker(false)}
        contentType={editedDay?.contentType}
      />

      {/* ================================================================== */}
      {/* LIGHTBOX — full-screen image viewer                                */}
      {/* ================================================================== */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxUrl}
              alt="Full preview"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-text-primary transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Post Card (Visual, AI-first card layout)
// ============================================================================

function PostCard({
  day,
  persona,
  onUpdateField,
  onDelete,
  onDuplicate,
  onGenerateImage,
  onConfirmGenerate,
  onGenerateVideo,
  onGenerateThumbnail,
  onPublish,
  publishLabel,
  isGenerating,
  generatingStatus,
  videoStatus,
  onOpenLightbox,
  onOpenDrivePicker,
  driveFiles,
}: {
  day: ContentDay;
  persona: Persona | null;
  onUpdateField: <K extends keyof ContentDay>(field: K, value: ContentDay[K]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGenerateImage: () => void;
  onConfirmGenerate: () => void;
  onGenerateVideo: () => void;
  onGenerateThumbnail: () => void;
  onPublish: () => void;
  publishLabel?: string;
  isGenerating: boolean;
  generatingStatus: string;
  videoStatus?: 'idle' | 'submitted' | 'processing' | 'done' | 'failed';
  onOpenLightbox: (url: string) => void;
  onOpenDrivePicker: (mode: 'single' | 'multi') => void;
  driveFiles: any[];
}) {
  const dateDisplay = day.date ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const isPublished = day.status === 'published';

  // Parse thumbnail concept from notes if present
  const thumbnailConcept = day.notes?.match(/\[THUMBNAIL\] (.+?)(?:\n|$)/)?.[1] || '';
  const notesWithoutThumbnail = day.notes?.replace(/\[THUMBNAIL\] .+?(?:\n|$)/, '').trim() || '';

  const contentTypeIcons: Record<ContentType, React.ReactNode> = {
    Photo: <Image className="w-4 h-4" />,
    Carousel: <LayoutGrid className="w-4 h-4" />,
    Video: <Video className="w-4 h-4" />,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6 pb-20">
        {/* Published banner */}
        {isPublished && (
          <div className="flex items-center justify-between bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2 text-brand-300 text-sm">
              <Lock className="w-4 h-4" />
              <span className="font-medium">Published post — view only</span>
            </div>
            <button onClick={onDuplicate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-text-primary text-xs font-medium transition-colors">
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
          </div>
        )}

        {/* Date header row */}
        <div className="flex items-center gap-3 mb-4">
          {!isPublished ? (
            <label className="flex items-center gap-2 cursor-pointer group">
              <Calendar className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              <input
                type="date"
                value={day.date}
                onChange={e => onUpdateField('date', e.target.value)}
                className="bg-transparent text-sm text-text-secondary border-none outline-none cursor-pointer hover:text-text-primary transition-colors"
              />
            </label>
          ) : (
            <span className="text-sm text-text-muted flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> {dateDisplay}
            </span>
          )}
          <span className="text-xs text-text-dim bg-surface-200 px-2 py-0.5 rounded">#{day.dayNumber}</span>
        </div>

        {/* Two-column layout: stack on mobile (image first), side-by-side on desktop */}
        <div className="flex flex-col md:flex-row gap-6">

          {/* ============================================================ */}
          {/* RIGHT COLUMN: Media Preview (varies by content type)         */}
          {/* ============================================================ */}
          <div className="w-full md:w-[380px] md:order-2 flex-shrink-0">
            <div className="md:sticky md:top-0 space-y-4">

              {/* --- PHOTO media panel --- */}
              {day.contentType === 'Photo' && (() => {
                const photoUrl = day.customMediaUrl || day.generatedImageUrl;
                const displayUrl = driveDisplayUrl(photoUrl);
                const isFromDrive = !!day.customMediaUrl;
                return (
                  <>
                    <div className="bg-surface-200/30 rounded-xl overflow-hidden">
                      {photoUrl ? (
                        <div className="relative cursor-pointer" onClick={() => onOpenLightbox(displayUrl)}>
                          <img src={displayUrl} alt="Preview" className="w-full aspect-[4/5] object-cover" referrerPolicy="no-referrer" />
                          {/* Source badge */}
                          <span className={cn(
                            'absolute top-3 right-3 text-[10px] font-semibold px-2 py-1 rounded-lg',
                            isFromDrive ? 'bg-surface-50/80 text-text-secondary' : 'bg-brand-500/80 text-white'
                          )}>
                            {isFromDrive ? 'From Drive' : 'AI Generated'}
                          </span>
                          {/* On-screen text position indicator */}
                          {day.onScreenText && (
                            <div className={cn(
                              'absolute left-1/2 -translate-x-1/2 max-w-[75%] bg-black/70 text-text-primary text-[10px] font-medium px-3 py-1.5 rounded-lg text-center truncate pointer-events-none',
                              (day.textPosition || 'bottom') === 'top' && 'top-3',
                              (day.textPosition || 'bottom') === 'middle' && 'top-1/2 -translate-y-1/2',
                              (day.textPosition || 'bottom') === 'bottom' && 'bottom-3',
                            )}>
                              {day.onScreenText.slice(0, 60)}{day.onScreenText.length > 60 ? '...' : ''}
                            </div>
                          )}
                          {/* Clear Drive image button */}
                          {isFromDrive && (
                            <button
                              onClick={e => { e.stopPropagation(); onUpdateField('customMediaUrl', undefined as any); }}
                              className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-text-primary transition-colors"
                              title="Remove Drive image"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="w-full aspect-[4/5] flex flex-col items-center justify-center gap-3 bg-surface-200/20 border-2 border-dashed border-border-light rounded-xl px-4">
                          <p className="text-sm text-text-dim text-center leading-relaxed line-clamp-4">{day.sceneDescription || 'No scene described yet'}</p>
                        </div>
                      )}
                    </div>
                    {/* Generate + Drive in same row */}
                    <div className="flex gap-2">
                      <button onClick={onConfirmGenerate} disabled={isGenerating} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
                        {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> {generatingStatus}</> : <><Sparkles className="w-4 h-4" /> {(day.generatedImageUrl || day.customMediaUrl) ? 'Regenerate' : 'Generate'}</>}
                      </button>
                      <button
                        onClick={() => onOpenDrivePicker('single')}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-medium text-text-secondary transition-colors flex items-center justify-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4" /> From Drive
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* --- CAROUSEL media panel --- */}
              {day.contentType === 'Carousel' && (
                <>
                  {/* Horizontal slide thumbnails */}
                  {day.slides && day.slides.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {day.slides.map((slide, idx) => (
                        <button
                          key={slide.id}
                          onClick={() => setSelectedSlideIdx(idx)}
                          className={cn(
                            'flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all relative',
                            selectedSlideIdx === idx ? 'border-white ring-1 ring-white/30' : 'border-border-light hover:border-border-light'
                          )}
                        >
                          {slide.generatedImageUrl ? (
                            <img src={slide.generatedImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-surface-200 flex items-center justify-center">
                              <span className="text-lg font-bold text-text-dim">{idx + 1}</span>
                            </div>
                          )}
                          <span className="absolute top-1 left-1 bg-black/70 text-text-primary text-[9px] font-bold px-1.5 py-0.5 rounded">{idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Selected slide larger preview */}
                  <div className="bg-surface-200/30 rounded-xl overflow-hidden">
                    {day.slides && day.slides[selectedSlideIdx]?.generatedImageUrl ? (
                      <div className="relative cursor-pointer" onClick={() => onOpenLightbox(day.slides![selectedSlideIdx].generatedImageUrl!)}>
                        <img src={day.slides[selectedSlideIdx].generatedImageUrl} alt="" className="w-full aspect-[4/5] object-cover" />
                        <span className="absolute top-3 left-3 bg-black/70 text-text-primary text-xs font-bold px-2 py-1 rounded-lg">Slide {selectedSlideIdx + 1}</span>
                        {day.slides[selectedSlideIdx]?.onScreenText && (
                          <div className={cn(
                            'absolute left-1/2 -translate-x-1/2 max-w-[75%] bg-black/70 text-text-primary text-[10px] font-medium px-3 py-1.5 rounded-lg text-center truncate pointer-events-none',
                            (day.textPosition || 'bottom') === 'top' && 'top-10',
                            (day.textPosition || 'bottom') === 'middle' && 'top-1/2 -translate-y-1/2',
                            (day.textPosition || 'bottom') === 'bottom' && 'bottom-3',
                          )}>
                            {day.slides[selectedSlideIdx].onScreenText.slice(0, 60)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/5] flex flex-col items-center justify-center gap-3 bg-surface-200/20 border-2 border-dashed border-border-light rounded-xl px-4">
                        <LayoutGrid className="w-8 h-8 text-text-dim" />
                        <p className="text-sm text-text-dim text-center">Slide {selectedSlideIdx + 1} preview</p>
                      </div>
                    )}
                  </div>
                  {/* Generate + Drive in same row */}
                  <div className="flex gap-2">
                    <button onClick={onConfirmGenerate} disabled={isGenerating} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
                      {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> {generatingStatus}</> : <><LayoutGrid className="w-4 h-4" /> Generate Slides</>}
                    </button>
                    <button
                      onClick={() => onOpenDrivePicker('multi')}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-medium text-text-secondary transition-colors flex items-center justify-center gap-2"
                    >
                      <FolderOpen className="w-4 h-4" /> From Drive
                    </button>
                  </div>
                </>
              )}

              {/* --- VIDEO media panel --- */}
              {day.contentType === 'Video' && (
                <>
                  {/* Thumbnail section */}
                  <div className="bg-surface-200/20 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Thumbnail</p>
                    {day.thumbnailUrl ? (
                      <div className="relative cursor-pointer" onClick={() => onOpenLightbox(day.thumbnailUrl!)}>
                        <img src={driveDisplayUrl(day.thumbnailUrl)} alt="Thumbnail" className="w-full aspect-video object-cover rounded-lg border border-border-light" referrerPolicy="no-referrer" />
                        <button
                          onClick={e => { e.stopPropagation(); onUpdateField('thumbnailUrl', undefined as any); }}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-text-primary" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full aspect-video flex flex-col items-center justify-center gap-2 border border-dashed border-border-light rounded-lg">
                        <Image className="w-6 h-6 text-text-dim" />
                        <p className="text-[10px] text-text-dim">No thumbnail yet</p>
                      </div>
                    )}
                    <button
                      onClick={onGenerateThumbnail}
                      disabled={isGenerating}
                      className="w-full px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 disabled:opacity-50 text-xs font-medium text-text-secondary transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isGenerating && generatingStatus.includes('thumbnail') ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {generatingStatus}</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> Generate Thumbnail</>
                      )}
                    </button>
                  </div>

                  {/* Video Frame section */}
                  <div className="bg-surface-200/20 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Video Frame</p>
                    {day.generatedImageUrl ? (
                      <div className="relative cursor-pointer" onClick={() => onOpenLightbox(day.generatedImageUrl!)}>
                        <img src={driveDisplayUrl(day.generatedImageUrl)} alt="Video frame" className="w-full aspect-video object-cover rounded-lg border border-border-light" referrerPolicy="no-referrer" />
                        {day.styleOption && (
                          <span className="absolute bottom-2 right-2 bg-black/70 text-text-primary text-[10px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Camera className="w-3 h-3" /> {day.styleOption}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 bg-surface-200/20 border-2 border-dashed border-border-light rounded-lg px-4">
                        <Video className="w-8 h-8 text-text-dim" />
                        <p className="text-sm text-text-dim text-center">{day.sceneDescription || 'No scene described yet'}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={onConfirmGenerate} disabled={isGenerating} className="flex-1 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5">
                        {isGenerating && generatingStatus.includes('image') ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {generatingStatus}</> : <><Image className="w-3.5 h-3.5" /> {day.generatedImageUrl ? 'Regen' : 'Generate'}</>}
                      </button>
                      <button
                        onClick={() => onOpenDrivePicker('single')}
                        className="flex-1 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs font-medium text-text-secondary transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> From Drive
                      </button>
                    </div>
                  </div>

                  {/* Generate Video button */}
                  {day.generatedImageUrl && !day.generatedVideoUrl && (
                    <button onClick={onGenerateVideo} disabled={isGenerating} className="w-full px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 disabled:opacity-50 text-sm font-medium text-text-secondary transition-colors flex items-center justify-center gap-2">
                      <Video className="w-4 h-4" /> Generate Video
                    </button>
                  )}

                  {/* Video player */}
                  {day.generatedVideoUrl && (
                    <div className="rounded-xl overflow-hidden border border-border-light">
                      <video src={day.generatedVideoUrl} controls className="w-full" />
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
                        {videoStatus === 'submitted' || videoStatus === 'processing' ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {generatingStatus || 'Processing video...'}</>
                        ) : videoStatus === 'done' ? (
                          <><Check className="w-3.5 h-3.5 text-green-400" /> Video ready</>
                        ) : videoStatus === 'failed' ? (
                          <><AlertCircle className="w-3.5 h-3.5 text-red-400" /> Video generation failed</>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Video generation status */}
                  {!day.generatedVideoUrl && (videoStatus === 'submitted' || videoStatus === 'processing') && (
                    <div className="flex items-center gap-2 text-sm text-text-muted bg-surface-200/40 rounded-xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {generatingStatus || 'Processing video...'}
                    </div>
                  )}
                </>
              )}

              {/* Status & Actions (shared across all types) */}
              <div className="bg-surface-200/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Status</span>
                  <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide', STATUS_COLORS[day.status])}>
                    {day.status}
                  </span>
                </div>
                {isPublished ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-brand-400 justify-center py-1">
                      <Lock className="w-4 h-4" /> Published
                    </div>
                    <button onClick={onDuplicate} className="w-full px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-medium text-text-primary transition-colors flex items-center justify-center gap-2">
                      <Copy className="w-4 h-4" /> Duplicate Post
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Good to Post</span>
                      <button
                        onClick={() => onUpdateField('isGoodToPost', !day.isGoodToPost)}
                        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', day.isGoodToPost ? 'bg-emerald-500' : 'bg-surface-300')}
                      >
                        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', day.isGoodToPost ? 'translate-x-6' : 'translate-x-1')} />
                      </button>
                    </div>
                    {day.status === 'completed' && day.isGoodToPost && (
                      <button onClick={onPublish} disabled={isGenerating} className="w-full px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
                        {isGenerating && generatingStatus === 'Publishing...' ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Send className="w-4 h-4" /> {publishLabel || 'Publish to Instagram'}</>}
                      </button>
                    )}
                    <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors mx-auto pt-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Post
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* LEFT COLUMN: Content (scrollable)                            */}
          {/* ============================================================ */}
          <div className={cn("flex-1 md:order-1 space-y-4 min-w-0", isPublished && "pointer-events-none opacity-80")}>

            {/* Section: Theme */}
            <div className="bg-surface-200/30 rounded-xl p-4 space-y-3">
              <InlineEdit
                value={day.theme}
                onSave={v => onUpdateField('theme', v)}
                className="text-2xl font-bold text-text-primary leading-tight"
                placeholder="Post theme..."
              />

              {/* Content Type Selector — prominent tabs */}
              <div className="flex gap-2">
                {CONTENT_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => onUpdateField('contentType', t as ContentType)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                      day.contentType === t
                        ? 'bg-accent-600 text-white shadow-sm'
                        : 'bg-surface-200 text-text-muted hover:text-text-primary hover:bg-surface-300'
                    )}
                  >
                    {contentTypeIcons[t as ContentType]}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- PHOTO-specific content ---- */}
            {day.contentType === 'Photo' && (
              <div className="bg-surface-200/30 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Scene</p>
                <InlineEdit
                  value={day.sceneDescription}
                  onSave={v => onUpdateField('sceneDescription', v)}
                  className="text-sm text-text-muted leading-relaxed"
                  placeholder="Describe the visual scene..."
                  multiline
                />
                <DetailRowIcon icon={<Type className="w-3.5 h-3.5 text-text-muted" />} label="On-Screen" value={day.onScreenText} onSave={v => onUpdateField('onScreenText', v)} multiline />
                {day.onScreenText && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-[10px] text-text-muted w-16 flex-shrink-0">Position</span>
                    <div className="flex gap-1">
                      {(['top', 'middle', 'bottom'] as const).map(pos => (
                        <button
                          key={pos}
                          onClick={() => onUpdateField('textPosition', pos)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize',
                            (day.textPosition || 'bottom') === pos ? 'bg-accent-600 text-white' : 'bg-surface-200 text-text-muted hover:text-text-primary'
                          )}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- CAROUSEL-specific content ---- */}
            {day.contentType === 'Carousel' && (
              <div className="bg-surface-200/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Slides</p>
                  <button
                    onClick={() => {
                      const slides = [...(day.slides || []), { id: generateId(), sceneDescription: '', onScreenText: '', contentType: 'Photo' as const }];
                      onUpdateField('slides', slides);
                    }}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add slide
                  </button>
                </div>
                {(!day.slides || day.slides.length === 0) ? (
                  <button
                    onClick={() => {
                      const slides: CarouselSlide[] = Array.from({ length: 4 }, () => ({
                        id: generateId(),
                        sceneDescription: '',
                        onScreenText: '',
                        contentType: 'Photo' as const,
                      }));
                      onUpdateField('slides', slides);
                    }}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-border-light text-text-muted hover:text-text-primary hover:border-border-light transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <LayoutGrid className="w-4 h-4" /> Generate carousel slides (4 slots)
                  </button>
                ) : (
                  <div className="space-y-2">
                    {day.slides.map((slide, idx) => (
                      <div
                        key={slide.id}
                        onClick={() => setSelectedSlideIdx(idx)}
                        className={cn(
                          'flex gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                          selectedSlideIdx === idx ? 'border-white/30 bg-surface-200/50' : 'border-border-light/50 hover:border-border-light'
                        )}
                      >
                        {/* Slide thumbnail or number badge */}
                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-surface-200 flex items-center justify-center">
                          {slide.generatedImageUrl ? (
                            <img src={slide.generatedImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-text-dim">{idx + 1}</span>
                          )}
                        </div>
                        {/* Slide text fields */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-text-muted bg-surface-200 px-1.5 py-0.5 rounded">S{idx + 1}</span>
                            <span className="text-[10px] text-text-dim">Scene</span>
                          </div>
                          <InlineEdit
                            value={slide.sceneDescription}
                            onSave={v => {
                              const slides = [...(day.slides || [])];
                              slides[idx] = { ...slides[idx], sceneDescription: v };
                              onUpdateField('slides', slides);
                            }}
                            className="text-xs text-text-secondary"
                            placeholder="Slide scene description..."
                          />
                          <InlineEdit
                            value={slide.onScreenText}
                            onSave={v => {
                              const slides = [...(day.slides || [])];
                              slides[idx] = { ...slides[idx], onScreenText: v };
                              onUpdateField('slides', slides);
                            }}
                            className="text-xs text-text-muted italic"
                            placeholder="Overlay text..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- VIDEO-specific content ---- */}
            {day.contentType === 'Video' && (
              <div className="space-y-4">
                {/* Scene description */}
                <div className="bg-surface-200/30 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Scene</p>
                  <InlineEdit
                    value={day.sceneDescription}
                    onSave={v => onUpdateField('sceneDescription', v)}
                    className="text-sm text-text-muted leading-relaxed"
                    placeholder="Describe the visual scene..."
                    multiline
                  />
                </div>

                {/* Hook — prominent for video */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Video Hook (first 1-3s)</p>
                  </div>
                  <InlineEdit
                    value={day.hook}
                    onSave={v => onUpdateField('hook', v)}
                    className="text-base text-text-primary font-medium leading-relaxed"
                    placeholder="What grabs attention in the first 1-3 seconds?"
                    multiline
                  />
                </div>

                {/* Thumbnail Concept */}
                <div className="bg-surface-200/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Image className="w-3.5 h-3.5 text-text-muted" />
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Thumbnail Concept</p>
                  </div>
                  <InlineEdit
                    value={thumbnailConcept}
                    onSave={v => {
                      const cleanNotes = day.notes?.replace(/\[THUMBNAIL\] .+?(?:\n|$)/, '').trim() || '';
                      const newNotes = v ? `[THUMBNAIL] ${v}\n${cleanNotes}` : cleanNotes;
                      onUpdateField('notes', newNotes);
                    }}
                    className="text-sm text-text-secondary"
                    placeholder="Describe what the thumbnail should look like..."
                    multiline
                  />
                </div>

                {/* Camera Angle selector */}
                <div className="bg-surface-200/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-text-muted" />
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Camera Angle</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {VIDEO_CAMERA_ANGLES.map(angle => (
                      <button
                        key={angle.value}
                        onClick={() => onUpdateField('styleOption', angle.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          day.styleOption === angle.value
                            ? 'bg-accent-600 text-white shadow-sm'
                            : 'bg-surface-300/50 text-text-muted hover:text-text-primary hover:bg-surface-300'
                        )}
                      >
                        {angle.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio / Music — prominent for video */}
                <div className="bg-surface-200/30 rounded-xl p-4">
                  <DetailRowIcon icon={<Music className="w-3.5 h-3.5 text-purple-400" />} label="Audio" value={day.musicSuggestion} onSave={v => onUpdateField('musicSuggestion', v)} />
                </div>
              </div>
            )}

            {/* Section: Caption & Copy (shared) */}
            <div className="bg-surface-200/30 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Caption & Copy</p>
              <InlineEdit
                value={day.caption}
                onSave={v => onUpdateField('caption', v)}
                className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap"
                placeholder="Write your caption..."
                multiline
              />
              {day.contentType !== 'Video' && (
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-text-muted w-10 flex-shrink-0">Hook</span>
                  <InlineEdit
                    value={day.hook}
                    onSave={v => onUpdateField('hook', v)}
                    className="text-sm text-text-secondary italic flex-1"
                    placeholder="Attention-grabbing opening line..."
                  />
                </div>
              )}
              <div className="flex items-start gap-2">
                <MousePointerClick className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-text-muted w-10 flex-shrink-0">CTA</span>
                <InlineEdit
                  value={day.cta}
                  onSave={v => onUpdateField('cta', v)}
                  className="text-sm text-text-secondary flex-1"
                  placeholder="Call to action..."
                />
              </div>
              <div className="flex items-start gap-2">
                <Hash className="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5" />
                <InlineEdit
                  value={day.hashtags}
                  onSave={v => onUpdateField('hashtags', v)}
                  className="text-sm text-brand-400/80 flex-1"
                  placeholder="#hashtag #hashtag #hashtag"
                />
              </div>
            </div>

            {/* Section: Details (shared) */}
            <div className="bg-surface-200/30 rounded-xl p-4 space-y-2.5">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Details</p>
              <DetailRowIcon icon={<MapPin className="w-3.5 h-3.5 text-text-muted" />} label="Location" value={day.location} onSave={v => onUpdateField('location', v)} />
              {day.contentType !== 'Video' && (
                <DetailRowIcon icon={<Music className="w-3.5 h-3.5 text-text-muted" />} label="Music" value={day.musicSuggestion} onSave={v => onUpdateField('musicSuggestion', v)} />
              )}
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-muted w-20 flex-shrink-0">Story Arc</span>
                <div className="flex gap-1 flex-wrap">
                  {STORY_ARCS.map(arc => (
                    <button
                      key={arc}
                      onClick={() => onUpdateField('storyArc', arc as StoryArc)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        day.storyArc === arc ? 'bg-accent-600 text-white' : 'bg-surface-300/50 text-text-muted hover:text-text-secondary'
                      )}
                    >
                      {arc}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-muted w-20 flex-shrink-0">Tone</span>
                <div className="flex gap-1 flex-wrap">
                  {CAPTION_TONES.map(tone => (
                    <button
                      key={tone}
                      onClick={() => onUpdateField('captionTone', tone as CaptionTone)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        day.captionTone === tone ? 'bg-accent-600 text-white' : 'bg-surface-300/50 text-text-muted hover:text-text-secondary'
                      )}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
              <DetailRowIcon icon={<FileText className="w-3.5 h-3.5 text-text-muted" />} label="Notes" value={notesWithoutThumbnail} onSave={v => {
                const thumb = day.notes?.match(/\[THUMBNAIL\] .+?(?:\n|$)/)?.[0] || '';
                onUpdateField('notes', thumb ? `${thumb}${v}` : v);
              }} multiline />
            </div>

            {/* Section: Production (shared) */}
            <div className="bg-surface-200/30 rounded-xl p-4 space-y-2.5">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Production</p>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-muted w-20 flex-shrink-0">Platforms</span>
                <div className="flex gap-1">
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        const current = day.platforms;
                        const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
                        onUpdateField('platforms', next as Platform[]);
                      }}
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors',
                        day.platforms.includes(p) ? 'bg-accent-600 text-white' : 'bg-surface-300/50 text-text-muted hover:text-text-secondary'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <DetailRowIcon icon={<Scissors className="w-3.5 h-3.5 text-text-muted" />} label="Hairstyle" value={day.hairstyle || ''} onSave={v => onUpdateField('hairstyle', v)} />
              {day.contentType !== 'Video' && (
                <DetailRowIcon icon={<Shirt className="w-3.5 h-3.5 text-text-muted" />} label="Style" value={day.styleOption || ''} onSave={v => onUpdateField('styleOption', v)} />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// --- Detail row with Lucide icon for PostCard ---
function DetailRowIcon({ icon, label, value, onSave, multiline }: { icon: React.ReactNode; label: string; value: string; onSave: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <span className="text-xs text-text-muted w-20 flex-shrink-0">{label}</span>
      <InlineEdit value={value} onSave={onSave} className="text-xs text-text-secondary flex-1" placeholder={`Add ${label.toLowerCase()}`} multiline={multiline} />
    </div>
  );
}

// ============================================================================
// Calendar Grid
// ============================================================================

function CalendarGrid({
  days,
  month,
  onMonthChange,
  selectedDayId,
  onSelectDay,
  onUpdateDay,
  onDuplicateDay,
}: {
  days: ContentDay[];
  month: Date;
  onMonthChange: (d: Date) => void;
  selectedDayId: string | null;
  onSelectDay: (id: string) => void;
  onUpdateDay: (dayId: string, newDate: string) => void;
  onDuplicateDay: (dayId: string) => void;
}) {
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDayOfMonth = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const daysByDate = useMemo(() => {
    const map: Record<string, ContentDay[]> = {};
    days.forEach(d => {
      const dt = d.date?.slice(0, 10);
      if (dt) {
        if (!map[dt]) map[dt] = [];
        map[dt].push(d);
      }
    });
    return map;
  }, [days]);

  const prevMonth = () => onMonthChange(new Date(year, mo - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, mo + 1, 1));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const handleDragStart = (e: React.DragEvent, post: ContentDay) => {
    if (post.status === 'published') { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', post.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(post.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const dayId = e.dataTransfer.getData('text/plain');
    if (dayId) onUpdateDay(dayId, dateStr);
    setDragOverDate(null);
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs text-text-muted font-medium py-2">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dayNum, i) => {
          if (dayNum === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(mo + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const dayPosts = daysByDate[dateStr] ?? [];
          const isDragOver = dragOverDate === dateStr;
          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[100px] rounded-lg border p-2 transition-colors cursor-pointer',
                dayPosts.length > 0 ? 'border-border-light hover:border-border-light bg-surface-50/50' : 'border-border/50',
                isDragOver && 'border-brand-500/50 bg-brand-500/5'
              )}
              onClick={() => dayPosts[0] && onSelectDay(dayPosts[0].id)}
              onDragOver={e => handleDragOver(e, dateStr)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, dateStr)}
            >
              <span className={cn(
                'text-xs font-medium',
                dayPosts.length > 0 ? 'text-text-primary' : 'text-text-dim'
              )}>
                {dayNum}
              </span>
              {dayPosts.map(post => {
                const isPublished = post.status === 'published';
                const isDragging = draggingId === post.id;
                return (
                  <div
                    key={post.id}
                    className={cn('mt-1 relative group/calpost', isDragging && 'opacity-50')}
                    draggable={!isPublished}
                    onDragStart={e => handleDragStart(e, post)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Lock badge for published posts */}
                    {isPublished && (
                      <div className="absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded-full bg-brand-500/80 flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-text-primary" />
                      </div>
                    )}
                    {/* Duplicate button for published posts */}
                    {isPublished && (
                      <button
                        onClick={e => { e.stopPropagation(); onDuplicateDay(post.id); }}
                        title="Duplicate post"
                        className="absolute bottom-0.5 right-0.5 z-10 w-5 h-5 rounded bg-surface-200/90 flex items-center justify-center opacity-0 group-hover/calpost:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3 h-3 text-text-secondary" />
                      </button>
                    )}
                    {post.generatedImageUrl ? (
                      <img src={driveDisplayUrl(post.customMediaUrl || post.generatedImageUrl)} alt="" className="w-full aspect-square rounded object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={cn(
                        'w-full h-6 rounded text-[9px] font-medium flex items-center justify-center truncate px-1',
                        STATUS_COLORS[post.status]
                      )}>
                        {post.theme?.slice(0, 20) || post.status}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Persona Editor Panel
// ============================================================================

function PersonaEditorPanel({
  persona,
  onUpdateField,
  onClose,
  onDelete,
  aiDescription,
  onAiDescriptionChange,
  onGenerateAIPersona,
  isAIGenerating,
  onShowConfirm,
  onSyncDrive,
  driveLoading,
  globalDriveFolderUrl,
  globalPostingMode,
  globalPostingTime,
  globalPostingEndTime,
  globalPostsPerDay,
  globalMetaAccessToken,
  isPinned,
  onTogglePin,
}: {
  persona: Persona;
  onUpdateField: (path: string, value: any) => void;
  onClose: () => void;
  onDelete: () => void;
  aiDescription: string;
  onAiDescriptionChange: (v: string) => void;
  onGenerateAIPersona: () => void;
  isAIGenerating: boolean;
  onShowConfirm: (opts: { title: string; message: string; confirmLabel?: string; confirmVariant?: 'danger' | 'default'; onConfirm: () => void }) => void;
  onSyncDrive: () => void;
  driveLoading?: boolean;
  globalDriveFolderUrl?: string;
  globalPostingMode?: 'manual' | 'auto';
  globalPostingTime?: string;
  globalPostingEndTime?: string;
  globalPostsPerDay?: number;
  globalMetaAccessToken?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tab, setTab] = useState<'profile' | 'friends' | 'audience' | 'settings'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailFileRef = useRef<HTMLInputElement>(null);
  const friendFileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const p = persona;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const result = await saveImage(base64, `ref_${Date.now()}.png`, persona.id);
        const urls = [...(persona.referenceImageUrls || []), result.url];
        onUpdateField('referenceImageUrls', urls);
        if (!persona.referenceImageUrl) onUpdateField('referenceImageUrl', result.url);
      } catch (err) { console.error('Upload failed:', err); }
    };
    reader.readAsDataURL(file);
  };

  const removeRefImage = (idx: number) => {
    onShowConfirm({
      title: 'Remove Reference Image',
      message: 'Remove this reference image? This affects AI generation consistency.',
      confirmLabel: 'Remove',
      confirmVariant: 'danger',
      onConfirm: () => {
        const urls = [...(persona.referenceImageUrls || [])];
        urls.splice(idx, 1);
        onUpdateField('referenceImageUrls', urls);
        if (persona.referenceImageUrl === (persona.referenceImageUrls || [])[idx]) {
          onUpdateField('referenceImageUrl', urls[0] || '');
        }
      },
    });
  };

  const handleThumbnailRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const result = await saveImage(base64, `thumb_ref_${Date.now()}.png`, persona.id);
        const urls = [...(persona.thumbnailReferenceUrls || []), result.url];
        onUpdateField('thumbnailReferenceUrls', urls);
      } catch (err) { console.error('Thumbnail ref upload failed:', err); }
    };
    reader.readAsDataURL(file);
  };

  const removeThumbnailRefImage = (idx: number) => {
    onShowConfirm({
      title: 'Remove Thumbnail Reference',
      message: 'Remove this thumbnail style reference?',
      confirmLabel: 'Remove',
      confirmVariant: 'danger',
      onConfirm: () => {
        const urls = [...(persona.thumbnailReferenceUrls || [])];
        urls.splice(idx, 1);
        onUpdateField('thumbnailReferenceUrls', urls);
      },
    });
  };

  const handleFriendImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const friends = persona.friends || [];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const result = await saveImage(base64, `friend_${Date.now()}.png`, persona.id);
        const updated = [...friends];
        updated[idx] = { ...updated[idx], imageUrl: result.url };
        onUpdateField('friends', updated);
      } catch (err) { console.error('Friend image upload failed:', err); }
    };
    reader.readAsDataURL(file);
  };

  const tabButtons: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <User className="w-3.5 h-3.5" /> },
    { key: 'friends', label: 'Friends', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'audience', label: 'Target Audience', icon: <Target className="w-3.5 h-3.5" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-widest text-text-muted font-semibold">Persona Card</span>
        <div className="flex items-center gap-1">
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              title={isPinned ? 'Unpin persona' : 'Pin persona to top'}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isPinned
                  ? 'bg-accent-500/20 text-accent-400 hover:bg-accent-500/30'
                  : 'hover:bg-surface-200 text-text-muted hover:text-text-primary'
              )}
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* AI Prompt Bar — only show when persona is empty/new */}
      {(!persona.identity.fullName || persona.identity.fullName === 'New Persona') && (
        <div className="bg-gradient-to-r from-brand-500/10 to-orange-500/5 border border-brand-500/20 rounded-2xl p-4 mb-4">
          <div className="flex gap-2 items-center">
            <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0" />
            <input
              type="text"
              value={aiDescription}
              onChange={e => onAiDescriptionChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aiDescription.trim() && onGenerateAIPersona()}
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-sm outline-none"
              placeholder='Describe your persona: "24yo Italian lifestyle influencer who loves travel and fashion"'
              disabled={isAIGenerating}
            />
            <button
              onClick={onGenerateAIPersona}
              disabled={!aiDescription.trim() || isAIGenerating}
              className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
            >
              {isAIGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {isAIGenerating ? 'Building...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6">
        {tabButtons.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-accent-600 text-white'
                : 'bg-surface-200 text-text-muted hover:text-text-primary'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ======================== PROFILE TAB ======================== */}
      {tab === 'profile' && (
        <div className="bg-surface-50 border border-border rounded-2xl overflow-hidden">
          {/* Header Band */}
          <div className="bg-surface-50 px-6 py-4">
            <InlineEdit
              value={p.identity.fullName}
              onSave={v => onUpdateField('identity.fullName', v)}
              className="text-3xl font-black text-text-primary tracking-tight"
              placeholder="Persona Name"
            />
            <InlineEdit
              value={p.identity.profession}
              onSave={v => onUpdateField('identity.profession', v)}
              className="text-sm text-text-primary/80 mt-1"
              placeholder="Profession / Role"
            />
          </div>

          {/* Main Grid: 3 columns on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {/* LEFT COLUMN: Photo + Stats */}
            <div className="p-5 border-r border-border space-y-5">
              {/* Reference Images */}
              <div>
                <div className="flex flex-wrap gap-2">
                  {(p.referenceImageUrls || []).map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url} alt=""
                        className={cn(
                          'w-20 h-20 rounded-xl object-cover border-2 cursor-pointer transition-all',
                          url === p.referenceImageUrl ? 'border-white' : 'border-border-light hover:border-border-light'
                        )}
                        onClick={() => onUpdateField('referenceImageUrl', url)}
                      />
                      <button onClick={() => removeRefImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-text-primary" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-border-light hover:border-border-light flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
                <p className="text-[10px] text-text-muted mt-2">Click image to set as primary. These train AI consistency.</p>
              </div>

              {/* Thumbnail Style References */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Thumbnail Style References</p>
                <div className="flex flex-wrap gap-2">
                  {(p.thumbnailReferenceUrls || []).map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url} alt=""
                        className="w-16 h-16 rounded-lg object-cover border-2 border-border-light hover:border-border-light transition-all"
                      />
                      <button onClick={() => removeThumbnailRefImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-text-primary" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => thumbnailFileRef.current?.click()}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-border-light hover:border-border-light flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <input ref={thumbnailFileRef} type="file" accept="image/*" onChange={handleThumbnailRefUpload} className="hidden" />
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">Upload examples of thumbnail styles for this persona's videos</p>
              </div>

              {/* Quick Stats */}
              <div className="space-y-2.5">
                <StatRow label="Age" value={String(p.identity.age || '')} onSave={v => onUpdateField('identity.age', parseInt(v) || 0)} />
                <StatRow label="Gender" value={p.identity.gender} onSave={v => onUpdateField('identity.gender', v)} />
                <StatRow label="Nationality" value={p.identity.nationality} onSave={v => onUpdateField('identity.nationality', v)} />
                <StatRow label="Birthplace" value={p.identity.birthplace} onSave={v => onUpdateField('identity.birthplace', v)} />
                <StatRow label="Height" value={p.appearance.height} onSave={v => onUpdateField('appearance.height', v)} />
                <StatRow label="Body Type" value={p.appearance.bodyType} onSave={v => onUpdateField('appearance.bodyType', v)} />
                <StatRow label="Eyes" value={p.appearance.eyes} onSave={v => onUpdateField('appearance.eyes', v)} />
                <StatRow label="Hair" value={p.appearance.hair} onSave={v => onUpdateField('appearance.hair', v)} />
                <StatRow label="Face" value={p.appearance.faceShape} onSave={v => onUpdateField('appearance.faceShape', v)} />
              </div>

              {/* Locations */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Locations</p>
                <TagList items={p.identity.locations} onUpdate={v => onUpdateField('identity.locations', v)} accent="gray" />
              </div>

              {/* Social Handles */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5"><AtSign className="w-3.5 h-3.5" /> Social Handles</p>
                <div className="space-y-2">
                  <StatRow label="Instagram" value={p.socialHandles?.instagram || ''} onSave={v => onUpdateField('socialHandles.instagram', v)} />
                  <StatRow label="TikTok" value={p.socialHandles?.tiktok || ''} onSave={v => onUpdateField('socialHandles.tiktok', v)} />
                  <StatRow label="YouTube" value={p.socialHandles?.youtube || ''} onSave={v => onUpdateField('socialHandles.youtube', v)} />
                  <StatRow label="Twitter/X" value={p.socialHandles?.twitter || p.socialHandles?.x || ''} onSave={v => { onUpdateField('socialHandles.twitter', v); onUpdateField('socialHandles.x', v); }} />
                </div>
              </div>

              {/* Distinct Features */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Distinct Features</p>
                <TagList items={p.appearance.distinctFeatures} onUpdate={v => onUpdateField('appearance.distinctFeatures', v)} accent="amber" />
              </div>
            </div>

            {/* MIDDLE COLUMN: Bio + Fashion + Lifestyle */}
            <div className="p-5 border-r border-border space-y-5">
              {/* Bio / Backstory */}
              <div className="bg-surface-200/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-text-muted mb-2">Bio</p>
                <InlineEdit
                  value={p.backstory}
                  onSave={v => onUpdateField('backstory', v)}
                  className="text-sm text-text-secondary leading-relaxed"
                  placeholder="Tell the persona's story..."
                  multiline
                />
              </div>

              {/* Mission */}
              <div className="bg-surface-200/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-text-muted mb-2">Mission</p>
                <InlineEdit
                  value={p.psychographic.mission}
                  onSave={v => onUpdateField('psychographic.mission', v)}
                  className="text-sm text-text-secondary italic leading-relaxed"
                  placeholder="What drives this persona?"
                  multiline
                />
              </div>

              {/* Fashion */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Fashion & Style</p>
                <div className="space-y-2">
                  <StatRow label="Aesthetic" value={p.fashionStyle.aesthetic} onSave={v => onUpdateField('fashionStyle.aesthetic', v)} />
                  <StatRow label="Photo Style" value={p.fashionStyle.photographyStyle} onSave={v => onUpdateField('fashionStyle.photographyStyle', v)} />
                </div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-3 mb-2">Signature Items</p>
                <TagList items={p.fashionStyle.signatureItems} onUpdate={v => onUpdateField('fashionStyle.signatureItems', v)} accent="rose" />
              </div>

              {/* Lifestyle */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Lifestyle</p>
                <div className="space-y-2">
                  <StatRow label="Routine" value={p.lifestyle.routine} onSave={v => onUpdateField('lifestyle.routine', v)} />
                  <StatRow label="Diet" value={p.lifestyle.diet} onSave={v => onUpdateField('lifestyle.diet', v)} />
                  <StatRow label="Pet" value={p.lifestyle.pet || ''} onSave={v => onUpdateField('lifestyle.pet', v)} />
                  <StatRow label="Social" value={p.lifestyle.socialMediaPresence} onSave={v => onUpdateField('lifestyle.socialMediaPresence', v)} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Personality + Goals/Fears */}
            <div className="p-5 space-y-5">
              {/* Core Traits */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Core Traits</p>
                <TagList items={p.psychographic.coreTraits} onUpdate={v => onUpdateField('psychographic.coreTraits', v)} accent="emerald" />
              </div>

              {/* Interests */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Interests</p>
                <TagList items={p.psychographic.interests} onUpdate={v => onUpdateField('psychographic.interests', v)} accent="sky" />
              </div>

              {/* Values */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Values</p>
                <TagList items={p.psychographic.values} onUpdate={v => onUpdateField('psychographic.values', v)} accent="gray" />
              </div>

              {/* Motivations */}
              <div>
                <p className="text-xs font-semibold text-text-muted mb-2">Motivations</p>
                <ul className="space-y-1">
                  {p.psychographic.motivations.map((m, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">+</span>
                      <InlineEdit value={m} onSave={v => { const a = [...p.psychographic.motivations]; a[i] = v; onUpdateField('psychographic.motivations', a); }} className="text-sm text-text-secondary" />
                    </li>
                  ))}
                  <button onClick={() => onUpdateField('psychographic.motivations', [...p.psychographic.motivations, ''])} className="text-xs text-text-secondary hover:text-text-primary mt-1">+ Add motivation</button>
                </ul>
              </div>

              {/* Fears */}
              <div>
                <p className="text-xs font-semibold text-text-muted mb-2">Fears</p>
                <ul className="space-y-1">
                  {p.psychographic.fears.map((f, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">-</span>
                      <InlineEdit value={f} onSave={v => { const a = [...p.psychographic.fears]; a[i] = v; onUpdateField('psychographic.fears', a); }} className="text-sm text-text-secondary" />
                    </li>
                  ))}
                  <button onClick={() => onUpdateField('psychographic.fears', [...p.psychographic.fears, ''])} className="text-xs text-text-secondary hover:text-text-primary mt-1">+ Add fear</button>
                </ul>
              </div>

              {/* AI Analysis (collapsed by default) */}
              <details className="group">
                <summary className="text-[10px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-muted">AI Consistency Rules</summary>
                <textarea
                  value={p.aiAnalysis ?? ''}
                  onChange={e => onUpdateField('aiAnalysis', e.target.value)}
                  className="input-field mt-2 min-h-[80px] resize-y text-xs font-mono"
                  placeholder="JSON or text rules for AI generation consistency..."
                />
              </details>
            </div>
          </div>
        </div>
      )}

      {/* ======================== FRIENDS TAB ======================== */}
      {tab === 'friends' && (() => {
        const friends = p.friends || [];
        return (
          <div className="bg-surface-50 border border-border rounded-2xl overflow-hidden p-6">
            <p className="text-xs text-text-muted mb-5">
              Friends appear as recurring characters in your content. Deactivate friends that have left the storyline.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map((friend, idx) => {
                const isActive = (friend as any).active !== false;
                return (
                  <div key={friend.id} className={cn(
                    'bg-surface-200/50 rounded-2xl p-4 flex gap-4 items-start relative group transition-opacity',
                    !isActive && 'opacity-50'
                  )}>
                    {/* Friend Photo (64x64) */}
                    <div
                      className="w-16 h-16 rounded-full bg-surface-300 flex-shrink-0 overflow-hidden cursor-pointer border-2 border-border-light hover:border-border transition-colors flex items-center justify-center"
                      onClick={() => friendFileRefs.current[idx]?.click()}
                    >
                      {friend.imageUrl ? (
                        <img src={friend.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-8 h-8 text-text-muted" />
                      )}
                    </div>
                    <input
                      ref={el => { friendFileRefs.current[idx] = el; }}
                      type="file"
                      accept="image/*"
                      onChange={e => handleFriendImageUpload(e, idx)}
                      className="hidden"
                    />
                    {/* Friend Details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <InlineEdit
                        value={friend.name}
                        onSave={v => { const a = [...friends]; a[idx] = { ...a[idx], name: v }; onUpdateField('friends', a); }}
                        className="text-base font-semibold text-text-primary"
                        placeholder="Friend name"
                      />
                      <InlineEdit
                        value={friend.relationship || ''}
                        onSave={v => { const a = [...friends]; a[idx] = { ...a[idx], relationship: v }; onUpdateField('friends', a); }}
                        className="text-xs text-brand-400"
                        placeholder="Relationship (e.g., Best friend, Gym buddy)"
                      />
                      <TagList
                        items={friend.traits}
                        onUpdate={v => { const a = [...friends]; a[idx] = { ...a[idx], traits: v }; onUpdateField('friends', a); }}
                        accent="sky"
                      />
                      <InlineEdit
                        value={friend.profession || ''}
                        onSave={v => { const a = [...friends]; a[idx] = { ...a[idx], profession: v }; onUpdateField('friends', a); }}
                        className="text-xs text-text-muted"
                        placeholder="Profession"
                      />
                    </div>
                    {/* Active/Inactive toggle + Delete */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          const a = [...friends];
                          a[idx] = { ...a[idx], active: !isActive } as any;
                          onUpdateField('friends', a);
                        }}
                        title={isActive ? 'Deactivate' : 'Activate'}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        {isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => onShowConfirm({ title: 'Remove Friend', message: `Remove ${f.name || 'this friend'}?`, confirmLabel: 'Remove', confirmVariant: 'danger', onConfirm: () => onUpdateField('friends', friends.filter((_, i) => i !== idx)) })}
                        className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {friends.length < 6 && (
              <button
                onClick={() => {
                  const newFriend: PersonaFriend = { id: generateId(), name: '', traits: [], profession: '' };
                  onUpdateField('friends', [...friends, newFriend]);
                }}
                className="mt-4 flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Friend
              </button>
            )}
            {friends.length === 0 && (
              <p className="text-sm text-text-dim italic mt-2">No friends added yet.</p>
            )}
          </div>
        );
      })()}

      {/* ======================== TARGET AUDIENCE TAB ======================== */}
      {tab === 'audience' && (
        <div className="bg-surface-50 border border-border rounded-2xl overflow-hidden p-6">
          <p className="text-xs text-text-muted mb-5">
            Active audiences are available when creating new posts. Deactivate segments you've outgrown.
          </p>

          {/* Header with Generate AI button */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Users className="w-4 h-4" /> Audience Segments</p>
            <button
              onClick={async () => {
                if ((p.targetAudiences || []).length >= 6) return;
                try {
                  const ai = await getAiInstance();
                  const prompt = `Based on this influencer persona: ${p.identity.fullName}, ${p.identity.profession}, interests: ${(p.psychographic.interests || []).join(', ')}, values: ${(p.psychographic.values || []).join(', ')}, mission: ${p.psychographic.mission || 'N/A'}, core traits: ${(p.psychographic.coreTraits || []).join(', ')}.
Generate 3 target audience segments. For each segment return:
{
  "segmentName": "string",
  "ageRange": "string (e.g. 24-35)",
  "genderSkew": "string (e.g. 65% female)",
  "locations": ["string"],
  "coreAspiration": "string",
  "painPoints": ["string", "string", "string"],
  "contentResonanceNotes": "string — how content should speak to this audience"
}
Return a JSON array of 3 segments.`;
                  const response = await ai.models.generateContent({
                    model: TEXT_MODEL,
                    contents: { parts: [{ text: prompt }] },
                    config: { responseMimeType: "application/json" }
                  });
                  const segments = JSON.parse(response.text || '[]');
                  const audiences: TargetAudience[] = segments.map((s: any) => ({
                    id: generateId(),
                    personaId: p.id,
                    segmentName: s.segmentName || '',
                    ageRange: s.ageRange || '',
                    genderSkew: s.genderSkew || '',
                    locations: s.locations || [],
                    coreAspiration: s.coreAspiration || '',
                    painPoints: s.painPoints || [],
                    contentResonanceNotes: s.contentResonanceNotes || '',
                  }));
                  onUpdateField('targetAudiences', audiences);
                } catch (err) { console.error('AI audience generation failed:', err); }
              }}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-500/10 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate with AI
            </button>
          </div>

          {/* Audience cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(p.targetAudiences || []).map((aud, idx) => {
              const isActive = (aud as any).active !== false;
              return (
                <div key={aud.id} className={cn(
                  'bg-surface-200/50 rounded-2xl p-4 relative group transition-opacity',
                  !isActive && 'opacity-50'
                )}>
                  {/* Top row: name + toggle + delete */}
                  <div className="flex items-start justify-between mb-2">
                    <InlineEdit
                      value={aud.segmentName}
                      onSave={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], segmentName: v }; onUpdateField('targetAudiences', a); }}
                      className="text-base font-semibold text-text-primary"
                      placeholder="Segment name"
                    />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          const a = [...(p.targetAudiences || [])];
                          a[idx] = { ...a[idx], active: !isActive } as any;
                          onUpdateField('targetAudiences', a);
                        }}
                        title={isActive ? 'Deactivate' : 'Activate'}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        {isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => onShowConfirm({
                          title: 'Remove Audience Segment',
                          message: `Remove audience segment "${seg.segmentName || 'Untitled'}"?`,
                          confirmLabel: 'Remove',
                          confirmVariant: 'danger',
                          onConfirm: () => {
                            const updated = (p.targetAudiences || []).filter((_: any, i: number) => i !== idx);
                            onUpdateField('targetAudiences', updated);
                          },
                        })}
                        className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Age + Gender compact row */}
                  <div className="flex items-center gap-2 mb-2">
                    <InlineEdit
                      value={aud.ageRange}
                      onSave={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], ageRange: v }; onUpdateField('targetAudiences', a); }}
                      className="text-xs text-text-muted"
                      placeholder="Age range"
                    />
                    <span className="text-text-dim text-xs">/</span>
                    <InlineEdit
                      value={aud.genderSkew}
                      onSave={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], genderSkew: v }; onUpdateField('targetAudiences', a); }}
                      className="text-xs text-text-muted"
                      placeholder="Gender skew"
                    />
                  </div>

                  {/* Locations */}
                  <div className="mb-2">
                    <p className="text-[10px] text-text-muted mb-1">Locations</p>
                    <TagList
                      items={aud.locations || []}
                      onUpdate={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], locations: v }; onUpdateField('targetAudiences', a); }}
                      accent="gray"
                    />
                  </div>

                  {/* Core Aspiration */}
                  <div className="mb-2">
                    <p className="text-[10px] text-text-muted mb-1">Core Aspiration</p>
                    <InlineEdit
                      value={aud.coreAspiration}
                      onSave={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], coreAspiration: v }; onUpdateField('targetAudiences', a); }}
                      className="text-sm text-text-primary font-medium"
                      placeholder="What does this audience aspire to?"
                    />
                  </div>

                  {/* Pain Points */}
                  <div className="mb-2">
                    <p className="text-[10px] text-text-muted mb-1">Pain Points</p>
                    <TagList
                      items={aud.painPoints || []}
                      onUpdate={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], painPoints: v }; onUpdateField('targetAudiences', a); }}
                      accent="rose"
                    />
                  </div>

                  {/* Content Resonance Notes */}
                  <div>
                    <p className="text-[10px] text-text-muted mb-1">Content Resonance</p>
                    <InlineEdit
                      value={aud.contentResonanceNotes}
                      onSave={v => { const a = [...(p.targetAudiences || [])]; a[idx] = { ...a[idx], contentResonanceNotes: v }; onUpdateField('targetAudiences', a); }}
                      className="text-xs text-text-secondary"
                      placeholder="How content should speak to this audience"
                      multiline
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {(p.targetAudiences || []).length < 6 && (
            <button
              onClick={() => {
                const newAud: TargetAudience = {
                  id: generateId(),
                  personaId: p.id,
                  segmentName: '',
                  ageRange: '',
                  genderSkew: '',
                  locations: [],
                  coreAspiration: '',
                  painPoints: [],
                  contentResonanceNotes: '',
                };
                onUpdateField('targetAudiences', [...(p.targetAudiences || []), newAud]);
              }}
              className="mt-4 flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Segment
            </button>
          )}

          {/* Content Themes */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><Target className="w-4 h-4" /> Content Themes</p>
            <TagList
              items={p.contentThemes || []}
              onUpdate={v => onUpdateField('contentThemes', v)}
              accent="sky"
            />
            {(p.contentThemes || []).length === 0 && (
              <button
                onClick={() => {
                  const suggestions = [...new Set([
                    ...(p.psychographic.interests || []),
                    'Lifestyle', 'Motivational',
                  ])].slice(0, 6);
                  onUpdateField('contentThemes', suggestions);
                }}
                className="text-xs text-text-muted hover:text-text-secondary mt-2"
              >
                + Add defaults from interests
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================== SETTINGS TAB ======================== */}
      {tab === 'settings' && (
        <div className="bg-surface-50 border border-border rounded-2xl overflow-hidden p-6 space-y-6">
          <p className="text-xs text-text-muted mb-2">Per-persona configuration for this persona's publishing and media library.</p>
          <Section title="Google Drive">
            <Field label="Drive Folder URL">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={p.driveFolderUrl ?? globalDriveFolderUrl ?? ''}
                  onChange={e => onUpdateField('driveFolderUrl', e.target.value)}
                  className="input-field flex-1"
                  placeholder="https://drive.google.com/drive/folders/..."
                />
                <button
                  onClick={onSyncDrive}
                  disabled={driveLoading || !(p.driveFolderUrl || globalDriveFolderUrl)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 disabled:opacity-40 text-xs font-medium text-text-secondary transition-colors whitespace-nowrap"
                >
                  {driveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync Now
                </button>
              </div>
            </Field>
            <p className="text-[10px] text-text-muted mt-1.5 px-1">Connect a shared Google Drive folder for this persona's media library</p>
          </Section>

          <Section title="Posting Schedule">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Posting Mode">
                <select
                  value={p.postingMode ?? globalPostingMode ?? 'manual'}
                  onChange={e => onUpdateField('postingMode', e.target.value)}
                  className="input-field"
                >
                  <option value="manual">Manual</option>
                  <option value="auto">Auto</option>
                </select>
              </Field>
              <Field label="Posts Per Day">
                <input
                  type="number"
                  value={p.postsPerDay ?? globalPostsPerDay ?? 1}
                  onChange={e => onUpdateField('postsPerDay', parseInt(e.target.value) || 1)}
                  className="input-field"
                  min={1}
                  max={10}
                />
              </Field>
              <Field label="Posting Time">
                <input
                  type="time"
                  value={p.postingTime ?? globalPostingTime ?? '09:00'}
                  onChange={e => onUpdateField('postingTime', e.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Posting End Time">
                <input
                  type="time"
                  value={p.postingEndTime ?? globalPostingEndTime ?? '21:00'}
                  onChange={e => onUpdateField('postingEndTime', e.target.value)}
                  className="input-field"
                />
              </Field>
            </div>
            {(() => {
              const postsPerDay = p.postsPerDay ?? globalPostsPerDay ?? 1;
              const startTime = p.postingTime ?? globalPostingTime ?? '09:00';
              const endTime = p.postingEndTime ?? globalPostingEndTime ?? '21:00';
              const [startH, startM] = startTime.split(':').map(Number);
              const [endH, endM] = endTime.split(':').map(Number);
              const startMinutes = startH * 60 + startM;
              const endMinutes = endH * 60 + endM;
              if (postsPerDay < 1 || endMinutes <= startMinutes) return null;
              const interval = postsPerDay === 1 ? 0 : (endMinutes - startMinutes) / (postsPerDay - 1);
              const slots = Array.from({ length: postsPerDay }, (_, i) => {
                const totalMin = Math.round(startMinutes + (postsPerDay === 1 ? 0 : interval * i));
                const h = Math.floor(totalMin / 60);
                const m = totalMin % 60;
                const period = h >= 12 ? 'PM' : 'AM';
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                return `${h12}:${String(m).padStart(2, '0')} ${period}`;
              });
              return (
                <div className="flex items-center gap-2 mt-3 px-1">
                  <Clock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  <p className="text-xs text-text-muted">
                    <span className="text-text-muted font-medium">Scheduled slots:</span>{' '}
                    {slots.join(' \u00b7 ')}
                  </p>
                </div>
              );
            })()}
          </Section>

          <Section title="Meta / Instagram">
            <Field label="Instagram Account ID">
              <input
                type="text"
                value={p.instagramAccountId ?? ''}
                onChange={e => onUpdateField('instagramAccountId', e.target.value)}
                className="input-field"
                placeholder="17841400..."
              />
            </Field>
            <Field label="Facebook Page ID" className="mt-3">
              <input
                type="text"
                value={p.facebookPageId ?? ''}
                onChange={e => onUpdateField('facebookPageId', e.target.value)}
                className="input-field"
                placeholder="Page ID"
              />
            </Field>
            <p className="text-[10px] text-text-muted mt-2 px-1">Find your Instagram Account ID in Meta Business Suite. Required for direct Meta Graph API publishing.</p>
            <TestMetaConnectionButton
              instagramAccountId={p.instagramAccountId}
              metaAccessToken={globalMetaAccessToken}
            />
          </Section>
        </div>
      )}

      {/* Danger Zone — Profile tab only */}
      {tab === 'profile' && (
        <div className="mt-10 border border-red-500/20 rounded-xl overflow-hidden">
          <div className="bg-red-500/5 px-5 py-3 border-b border-red-500/20">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Danger Zone
            </h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-text-muted leading-relaxed">
              Deleting this persona will permanently remove all associated content posts, generated images, videos, target audiences, and friends. This action cannot be undone and regeneration will cost additional credits.
            </p>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete this persona
            </button>
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}

// --- Inline edit: click text to edit, blur/enter to save ---
function InlineEdit({ value, onSave, className = '', placeholder = '', multiline = false }: {
  value: string; onSave: (v: string) => void; className?: string; placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };

  if (!editing) {
    return (
      <div onClick={() => setEditing(true)} className={cn(className, 'cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors min-h-[1.2em]')}>
        {value || <span className="text-text-dim">{placeholder}</span>}
      </div>
    );
  }

  if (multiline) {
    return <textarea ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} className={cn(className, 'bg-surface-200 rounded px-1 -mx-1 outline-none ring-1 ring-gray-400 w-full resize-y min-h-[60px]')} />;
  }

  return <input ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} className={cn(className, 'bg-surface-200 rounded px-1 -mx-1 outline-none ring-1 ring-gray-400 w-full')} />;
}

// --- Stat row: label : value, click value to edit ---
function StatRow({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-semibold text-text-muted w-20 flex-shrink-0">{label}</span>
      <InlineEdit value={value} onSave={onSave} className="text-sm text-text-primary flex-1" placeholder={`Add ${label.toLowerCase()}`} />
    </div>
  );
}

// --- Tag list with inline add/remove ---
function TagList({ items, onUpdate, accent = 'gray' }: { items: string[]; onUpdate: (v: string[]) => void; accent?: string }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const colorMap: Record<string, string> = {
    gray: 'bg-surface-300/30 text-text-secondary border-border-light/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    sky: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    rose: 'bg-brand-500/20 text-brand-300 border-brand-500/30',
  };
  const tagClass = colorMap[accent] || colorMap.gray;

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const addTag = () => {
    const tags = draft.split(',').map(s => s.trim()).filter(Boolean);
    if (tags.length > 0) { onUpdate([...items, ...tags]); setDraft(''); setAdding(false); }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border', tagClass)}>
          {item}
          <button onClick={() => onUpdate(items.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100 ml-0.5"><X className="w-3 h-3" /></button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (draft.trim()) addTag(); else setAdding(false); }}
          onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setAdding(false); }}
          className="bg-surface-200 border border-border-light rounded-lg px-2 py-1 text-xs text-text-primary outline-none ring-1 ring-gray-400 w-28"
          placeholder="Add tag..."
        />
      ) : (
        <button onClick={() => setAdding(true)} className="px-2 py-1 rounded-lg border border-dashed border-border-light text-xs text-text-muted hover:text-text-primary hover:border-border-light transition-colors">+</button>
      )}
    </div>
  );
}

// ============================================================================
// Test Meta Connection Button (used in PersonaEditorPanel)
// ============================================================================

function TestMetaConnectionButton({
  instagramAccountId,
  metaAccessToken,
}: {
  instagramAccountId?: string;
  metaAccessToken?: string;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; name?: string; username?: string; error?: string } | null>(null);

  const handleTest = async () => {
    if (!instagramAccountId || !metaAccessToken) {
      setResult({ success: false, error: 'Instagram Account ID and Meta Access Token are both required.' });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${instagramAccountId}?fields=name,username&access_token=${metaAccessToken}`
      );
      const data = await res.json();
      if (data.error) {
        setResult({ success: false, error: data.error.message });
      } else {
        setResult({ success: true, name: data.name, username: data.username });
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleTest}
        disabled={testing}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 disabled:opacity-40 text-xs font-medium text-text-secondary transition-colors"
      >
        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        Test Connection
      </button>
      {result && (
        <div className={cn('mt-2 px-3 py-2 rounded-lg text-xs', result.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')}>
          {result.success
            ? `Connected: @${result.username} (${result.name})`
            : `Error: ${result.error}`
          }
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Settings Panel
function DiscoverAccountsButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const handleDiscover = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await discoverMetaAccounts(token);
      setAccounts(result.accounts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to discover accounts');
    }
    setLoading(false);
  };

  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={handleDiscover}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 disabled:opacity-40 text-xs font-medium text-text-secondary transition-colors"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        Discover Instagram Accounts
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {accounts && accounts.length === 0 && (
        <p className="text-xs text-text-muted">No Facebook Pages found. Make sure your token has pages_manage_posts permission.</p>
      )}
      {accounts && accounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-text-muted">Copy the Instagram Account ID into each persona's Settings tab:</p>
          {accounts.map((acc, i) => (
            <div key={i} className="bg-surface-200/50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text-primary">{acc.facebookPageName}</span>
                <span className={acc.instagramAccountId ? 'text-emerald-400' : 'text-text-muted'}>{acc.status}</span>
              </div>
              {acc.instagramAccountId && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">IG:</span>
                    <span className="text-text-primary font-mono">@{acc.instagramUsername}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Account ID:</span>
                    <code className="text-brand-400 font-mono bg-surface-50 px-1.5 py-0.5 rounded select-all">{acc.instagramAccountId}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Page ID:</span>
                    <code className="text-text-secondary font-mono bg-surface-50 px-1.5 py-0.5 rounded select-all">{acc.facebookPageId}</code>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================

function SettingsPanel({
  settings,
  onUpdateField,
  onClose,
  onSignOut,
  onSave,
  saving,
  userEmail,
}: {
  settings: UserSettings;
  onUpdateField: (field: keyof UserSettings, value: any) => void;
  onClose: () => void;
  onSignOut: () => void;
  onSave: () => void;
  saving: boolean;
  userEmail: string;
}) {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header with Save */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-primary">Settings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-600 text-white hover:bg-accent-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* API Keys */}
      <Section title="API Keys">
        <Field label="NanoBanana API Key">
          <input
            type="password"
            value={settings.nanobananaApiKey ?? ''}
            onChange={e => onUpdateField('nanobananaApiKey', e.target.value)}
            className="input-field"
            placeholder="nb-..."
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Kling API Key">
            <input
              type="password"
              value={settings.klingApiKey ?? ''}
              onChange={e => onUpdateField('klingApiKey', e.target.value)}
              className="input-field"
              placeholder="Key"
            />
          </Field>
          <Field label="Kling API Secret">
            <input
              type="password"
              value={settings.klingApiSecret ?? ''}
              onChange={e => onUpdateField('klingApiSecret', e.target.value)}
              className="input-field"
              placeholder="Secret"
            />
          </Field>
        </div>
        <Field label="Blotato API Key" className="mt-3">
          <input
            type="password"
            value={settings.blotatoApiKey ?? ''}
            onChange={e => onUpdateField('blotatoApiKey', e.target.value)}
            className="input-field"
            placeholder="blot-..."
          />
        </Field>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Field label="Color Theme">
          <ThemePicker />
        </Field>
      </Section>

      {/* AI Provider */}
      <Section title="AI Provider">
        <Field label="Primary LLM">
          <select
            value={settings.primaryLlm ?? 'claude'}
            onChange={e => onUpdateField('primaryLlm', e.target.value)}
            className="input-field"
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="gemini">Gemini (Google)</option>
          </select>
        </Field>
        <Field label="Anthropic API Key" className="mt-3">
          <input
            type="password"
            value={settings.anthropicApiKey ?? ''}
            onChange={e => onUpdateField('anthropicApiKey', e.target.value)}
            className="input-field"
            placeholder="sk-ant-..."
          />
        </Field>
        <p className="text-[10px] text-text-muted mt-2 px-1">Claude Sonnet for creative tasks, Haiku for structured tasks. Get your key from console.anthropic.com</p>
      </Section>

      {/* Meta / Instagram API */}
      <Section title="Meta / Instagram API">
        <Field label="Meta Access Token">
          <input
            type="password"
            value={settings.metaAccessToken ?? ''}
            onChange={e => onUpdateField('metaAccessToken', e.target.value)}
            className="input-field"
            placeholder="System User Token"
          />
        </Field>
        <Field label="Meta App ID" className="mt-3">
          <input
            type="text"
            value={settings.metaAppId ?? ''}
            onChange={e => onUpdateField('metaAppId', e.target.value)}
            className="input-field"
            placeholder="App ID"
          />
        </Field>
        <p className="text-[10px] text-text-muted mt-2 px-1">Get your System User Token from Meta Business Manager.</p>
        {settings.metaAccessToken && (
          <DiscoverAccountsButton token={settings.metaAccessToken} />
        )}
      </Section>

      {/* Tunnel */}
      <Section title="Network">
        <Field label="Public Tunnel URL">
          <input
            type="text"
            value={settings.publicTunnelUrl ?? ''}
            onChange={e => onUpdateField('publicTunnelUrl', e.target.value)}
            className="input-field"
            placeholder="https://your-tunnel.ngrok.io"
          />
        </Field>
      </Section>

      {/* AI Prompts */}
      <PromptsManager />

      {/* Profile & Account */}
      <div className="pt-6 mt-6 border-t border-border space-y-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Account</h3>
        <div className="flex items-center gap-3 bg-surface-200/50 rounded-xl p-4">
          <div className="w-10 h-10 rounded-full bg-surface-300 flex items-center justify-center text-sm font-semibold text-text-secondary">
            {userEmail ? userEmail[0].toUpperCase() : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary font-medium truncate">{userEmail || 'Unknown user'}</p>
            <p className="text-xs text-text-muted">Logged in</p>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}

// ============================================================================
// Confirm Modal
// ============================================================================

// ============================================================================
// Drive Picker Modal
// ============================================================================

function DrivePickerModal({
  isOpen,
  files,
  mode,
  loading,
  onSync,
  onSelect,
  onClose,
  contentType,
}: {
  isOpen: boolean;
  files: any[];
  mode: 'single' | 'multi';
  loading: boolean;
  onSync: () => void;
  onSelect: (files: any[]) => void;
  onClose: () => void;
  contentType?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) setSelected(new Set());
  }, [isOpen]);

  // Filter files for video content type
  const filteredFiles = contentType === 'Video'
    ? files.filter(f => f.mimeType?.startsWith('video/'))
    : files.filter(f => f.mimeType?.startsWith('image/'));

  const maxSelect = mode === 'multi' ? 4 : 1;

  const toggleFile = (fileId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        if (mode === 'single') {
          next.clear();
        }
        if (next.size < maxSelect) {
          next.add(fileId);
        }
      }
      return next;
    });
  };

  const handleUseSelected = () => {
    const selectedFiles = filteredFiles.filter(f => selected.has(f.id || f.driveFileId));
    onSelect(selectedFiles);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="drive-picker-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="bg-surface-50 border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-text-muted" />
                Google Drive Media
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
                {selected.size > 0 && ` · ${selected.size} selected`}
                {mode === 'multi' && ` (max ${maxSelect})`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSync}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-text-secondary text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                Sync Drive
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-200 text-text-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading && filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Syncing files from Drive...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <FolderOpen className="w-10 h-10 mb-3 text-text-dim" />
                <p className="text-sm">No {contentType === 'Video' ? 'video' : 'image'} files found</p>
                <p className="text-xs text-text-dim mt-1">Set your Drive folder URL in the persona editor and sync</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredFiles.map(file => {
                  const fileId = file.id || file.driveFileId;
                  const isSelected = selected.has(fileId);
                  const isVideo = file.mimeType?.startsWith('video/');
                  return (
                    <button
                      key={fileId}
                      onClick={() => toggleFile(fileId)}
                      className={cn(
                        'relative rounded-xl overflow-hidden border-2 transition-all text-left group',
                        isSelected
                          ? 'border-white ring-2 ring-white/20'
                          : 'border-border hover:border-border-light'
                      )}
                    >
                      <div className="aspect-square bg-surface-200">
                        {(file.thumbnailLink || file.thumbnailUrl) ? (
                          <img
                            src={file.thumbnailLink || file.thumbnailUrl}
                            alt={file.name || file.fileName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {isVideo ? <Video className="w-8 h-8 text-text-dim" /> : <Image className="w-8 h-8 text-text-dim" />}
                          </div>
                        )}
                      </div>
                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <Check className="w-4 h-4 text-surface-0" />
                        </div>
                      )}
                      {/* Type badge */}
                      {isVideo && (
                        <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-brand-500/90 text-white px-1.5 py-0.5 rounded">
                          Video
                        </span>
                      )}
                      {/* File info */}
                      <div className="p-2 bg-surface-50/80">
                        <p className="text-[11px] text-text-secondary truncate font-medium">{file.name || file.fileName}</p>
                        <p className="text-[10px] text-text-dim">
                          {isVideo ? 'Video' : 'Photo'}
                          {(file.size || file.fileSize) ? ` · ${formatSize(parseInt(file.size || file.fileSize))}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-surface-200 hover:bg-surface-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUseSelected}
              disabled={selected.size === 0}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-accent-600 hover:bg-accent-500 text-white transition-colors disabled:opacity-40"
            >
              Use Selected{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Confirm Modal
// ============================================================================

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="confirm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="bg-surface-50 border border-border rounded-2xl p-6 max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
          <p className="text-sm text-text-muted mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-surface-200 hover:bg-surface-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                confirmVariant === 'danger'
                  ? 'bg-red-500 hover:bg-red-400 text-text-primary'
                  : 'bg-accent-600 hover:bg-accent-500 text-white'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Shared UI Components
// ============================================================================

// ============================================================================
// Theme Picker
// ============================================================================

const THEMES = [
  { id: 'default', label: 'Studio Dark', desc: 'Dark violet theme', mode: 'dark', colors: ['#7c3aed', '#f43f5e', '#1a1a2e'] },
  { id: 'claude', label: 'Claude Light', desc: 'Warm cream & terracotta', mode: 'light', colors: ['#c2956a', '#f5f0e8', '#3d2e1e'] },
  { id: 'midnight', label: 'Midnight', desc: 'Deep navy blue', mode: 'dark', colors: ['#5b8af5', '#4ba3d4', '#1a1a2e'] },
];

function ThemePicker() {
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('cs_theme') || 'default');

  const applyTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem('cs_theme', themeId);

    const theme = THEMES.find(t => t.id === themeId);

    // Set color theme
    if (themeId === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeId);
    }

    // Set mode (light/dark) based on theme's inherent mode
    if (theme?.mode === 'light') {
      document.documentElement.setAttribute('data-mode', 'light');
      localStorage.setItem('cs_mode', 'light');
    } else {
      document.documentElement.removeAttribute('data-mode');
      localStorage.setItem('cs_mode', 'dark');
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map(theme => (
          <button
            key={theme.id}
            onClick={() => applyTheme(theme.id)}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left',
              currentTheme === theme.id
                ? 'border-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30'
                : 'border-border bg-surface-50/40 hover:border-border-light'
            )}
          >
            <div className="flex -space-x-1 flex-shrink-0">
              {theme.colors.map((color, i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 border-surface-0" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div>
              <p className={cn('text-xs font-medium', currentTheme === theme.id ? 'text-accent-300' : 'text-text-primary')}>{theme.label}</p>
              <p className="text-[10px] text-text-dim">{theme.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-text-muted font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
