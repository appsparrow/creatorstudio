import type { Persona } from './types';

export const HAIRSTYLES = [
  'Classic Dutch Braid Pigtails',
  'Sleek High Ponytail',
  'Loose Beach Waves',
  'Messy Low Bun',
  'Side-Swept Curls',
  'Straight Blowout with Center Part',
  'Half-Up Half-Down with Soft Waves',
  'Braided Crown Updo',
  'Textured Bob with Slight Curl',
  'Voluminous Curly Blowout',
  'Slicked-Back Wet Look',
] as const;

export const VIDEO_CAMERA_ANGLES = [
  { label: 'Overhead shot', value: 'overhead shot looking down' },
  { label: 'Zoom in', value: 'slow zoom into face' },
  { label: 'Walking in', value: 'walking toward camera confidently' },
  { label: 'Low angle', value: 'low angle looking up, powerful stance' },
  { label: 'Action close-up', value: 'close-up of hands or face in action' },
  { label: 'Dolly zoom', value: 'dolly zoom dramatic focus' },
  { label: 'Pan', value: 'smooth pan from left to right' },
  { label: 'Tilt', value: 'tilt from feet to face' },
] as const;

export const STYLE_OPTIONS = [
  'Luxury/High-end',
  'Casual/Street',
  'Morning Cozy',
  'Elegant Evening',
  'Formal/Corporate',
] as const;

export const PLATFORMS = ['Instagram', 'TikTok', 'YouTube'] as const;

export const CONTENT_TYPES = ['Photo', 'Carousel', 'Video'] as const;

export const STORY_ARCS = [
  'Beautiful Day',
  'Real Moment',
  'Achievement',
  'Lesson',
  'Invitation',
] as const;

export const CAPTION_TONES = [
  'Aspirational',
  'Relatable',
  'Educational',
  'Vulnerable',
  'Playful',
] as const;

export const CONTENT_STATUSES = ['draft', 'generating', 'completed', 'published'] as const;

export function getRandomHairstyle(): string {
  return HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)];
}

export function generateId(): string {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
