import { MediaFile, MediaType } from '@/types';

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
  const extension = getFileExtension(filePath);

  if (VIDEO_FORMATS.includes(extension)) return 'video';
  if (AUDIO_FORMATS.includes(extension)) return 'audio';
  if (IMAGE_FORMATS.includes(extension)) return 'image';

  return null;
}

export function isSupportedFormat(filePath: string): boolean {
  return detectMediaType(filePath) !== null;
}

export function formatDuration(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const sizeIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, sizeIndex);

  return `${value.toFixed(1)} ${units[sizeIndex]}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createMediaFileFromPath(filePath: string): MediaFile | null {
  const mediaType = detectMediaType(filePath);
  if (!mediaType) return null;

  return {
    id: generateId(),
    name: getFileName(filePath) || 'Unknown',
    path: filePath,
    type: mediaType,
    format: getFileExtension(filePath),
    size: 0,
    addedAt: Date.now(),
  };
}

export function createMediaFileFromFile(file: File): MediaFile | null {
  const nativePath = (file as File & { path?: string }).path;
  const sourcePath = nativePath || file.name;
  const mediaType = detectMediaType(sourcePath);
  if (!mediaType) return null;

  if (nativePath) {
    return {
      id: generateId(),
      name: getFileName(nativePath) || file.name,
      path: nativePath,
      type: mediaType,
      format: getFileExtension(nativePath),
      size: file.size,
      addedAt: Date.now(),
      isBlob: false,
    };
  }

  return {
    id: generateId(),
    name: file.name,
    path: URL.createObjectURL(file),
    type: mediaType,
    format: getFileExtension(file.name),
    size: file.size,
    addedAt: Date.now(),
    isBlob: true,
  };
}

export function safeFileName(input: string): string {
  return input.replace(/[<>:"/\\|?*]/g, '_').trim() || 'snapshot';
}

