import { MediaType } from '@/types';

const VIDEO_FORMATS = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'flv', 'wmv'];
const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

export function getFileExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}

export function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || '';
}

export function detectMediaType(filePath: string): MediaType | null {
  const ext = getFileExtension(filePath);
  if (VIDEO_FORMATS.includes(ext)) return 'video';
  if (AUDIO_FORMATS.includes(ext)) return 'audio';
  if (IMAGE_FORMATS.includes(ext)) return 'image';
  return null;
}

export function isSupportedFormat(filePath: string): boolean {
  return detectMediaType(filePath) !== null;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
