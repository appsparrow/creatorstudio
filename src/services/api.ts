import { getAuthToken } from './supabase';
import type { Persona, ContentDay } from '../types';

// In dev mode, use relative URLs (Vite proxy). In production, use the Worker URL.
const API_BASE = import.meta.env.VITE_API_URL || '';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error: ${res.status}`);
  }
  return res.json();
}

// ===== Personas =====
export const fetchPersonas = () => apiFetch<Persona[]>('/api/personas');

export const savePersona = (persona: Persona) =>
  apiFetch('/api/personas', { method: 'POST', body: JSON.stringify(persona) });

export const deletePersona = (id: string) =>
  apiFetch(`/api/personas/${id}`, { method: 'DELETE' });

// ===== Content Days =====
export const fetchDays = () => apiFetch<ContentDay[]>('/api/days');

export const saveDay = (day: ContentDay) =>
  apiFetch('/api/days', { method: 'POST', body: JSON.stringify(day) });

export const deleteDay = (id: string) =>
  apiFetch(`/api/days/${id}`, { method: 'DELETE' });

// ===== Images =====
export const saveImage = (base64: string, filename: string, personaId?: string) =>
  apiFetch<{ url: string }>('/api/images/save', {
    method: 'POST',
    body: JSON.stringify({ base64, filename, personaId }),
  });

// ===== NanoBanana Proxy =====
export const proxyNanoBanana = (endpoint: string, apiKey: string, payload: any, method = 'POST') =>
  apiFetch('/api/nanobanana/proxy', {
    method: 'POST',
    body: JSON.stringify({ endpoint, method, payload, apiKey }),
  });

// ===== Kling Video =====
export const generateVideo = (params: {
  prompt: string;
  image_url: string;
  apiKey: string;
  apiSecret: string;
  model_name: string;
  dayId?: string;
  publicTunnelUrl?: string;
}) => apiFetch<{ taskId: string }>('/api/videos/generate', {
  method: 'POST',
  body: JSON.stringify(params),
});

export const checkVideoStatus = (taskId: string, apiKey: string, apiSecret: string) =>
  apiFetch(`/api/videos/status/${taskId}`, {
    headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret },
  });

export const saveVideo = (videoUrl: string, personaId?: string) =>
  apiFetch<{ url: string }>('/api/videos/save', {
    method: 'POST',
    body: JSON.stringify({ videoUrl, personaId }),
  });

// ===== Meta Graph API =====
export const discoverMetaAccounts = (token: string) =>
  apiFetch<{ accounts: any[]; hint: string }>(`/api/meta/accounts?token=${encodeURIComponent(token)}`);

export const publishToMeta = (params: {
  imageUrl?: string;
  videoUrl?: string;
  caption: string;
  contentType: string;
  slideImageUrls?: string[];
  instagramAccountId: string;
  metaAccessToken: string;
}) => apiFetch('/api/meta/publish', {
  method: 'POST',
  body: JSON.stringify(params),
});

// ===== Blotato Publishing =====
export const publishToBlotato = (params: {
  image?: string;
  video?: string;
  imageBlob?: string; // base64 with text overlay already burned
  caption: string;
  hashtags: string;
  contentType: string;
  blotatoApiKey: string;
  dayId: string;
}) => apiFetch('/api/blotato/publish', {
  method: 'POST',
  body: JSON.stringify(params),
});

// ===== Google Drive =====
export const syncDriveFiles = (folderUrl: string) =>
  apiFetch<{ files: any[]; total: number }>('/api/drive/list', {
    method: 'POST',
    body: JSON.stringify({ folderUrl }),
  });

export const fetchDriveAssets = (params?: { status?: string; contentType?: string }) => {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<any[]>(`/api/drive/assets${query ? `?${query}` : ''}`);
};

export const updateDriveAsset = (id: string, updates: { status?: string; linkedDayId?: string }) =>
  apiFetch(`/api/drive/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

export const fetchDriveStats = () =>
  apiFetch<{ total: number; unused: number; queued: number; published: number; photos: number; videos: number }>('/api/drive/stats');

// ===== User Settings =====
export const fetchUserSettings = () =>
  apiFetch<Record<string, any>>('/api/settings');

export const saveUserSettings = (settings: Record<string, any>) =>
  apiFetch('/api/settings', { method: 'POST', body: JSON.stringify(settings) });
