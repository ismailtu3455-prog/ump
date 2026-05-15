const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  dialog,
  Notification,
  nativeImage,
  shell,
  globalShortcut,
  net,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const PLAYLISTS_DIR = isDev
  ? path.join(__dirname, '../playlists')
  : path.join(app.getPath('userData'), 'playlists');

const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'ogg',
  'mkv',
  'avi',
  'mov',
  'flv',
  'wmv',
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
]);

const STARTUP_TRAY_ARG = '--startup-tray';
const IMPORT_PREVIEW_TTL_MS = 15 * 60 * 1000;
const IMPORT_ARCHIVE_EXTENSION = '.ump.zip';
const GLOBAL_HOTKEY_ACTIONS = new Set([
  'togglePlayPause',
  'previousTrack',
  'nextTrack',
  'toggleWindow',
]);
const AUTO_UPDATE_CHECK_DELAY_MS = 15000;
const AUTO_UPDATE_RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(__dirname, 'Untitled Project (1).jpg'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const APP_ICON = resolveIconPath();

let mainWindow = null;
let splashWindow = null;
let tray = null;
let handlersRegistered = false;
let pendingFiles = [];
let isRendererReady = false;
let trayModeEnabled = false;
let isQuitting = false;
let launchToTrayOnStartup = process.argv.includes(STARTUP_TRAY_ARG);
const activeImportPreviews = new Map();
const registeredGlobalHotkeys = new Map();
let autoUpdateInitialized = false;
let autoUpdateIntervalRef = null;
let autoUpdateDialogOpen = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function showSystemNotification(title, body) {
  try {
    const notification = new Notification({
      title,
      body,
      icon: APP_ICON,
    });
    notification.show();
  } catch {
    // Ignore notification errors on unsupported environments.
  }
}

function shouldSkipAutoUpdate() {
  if (isDev || !app.isPackaged) return true;
  if (!['win32', 'darwin'].includes(process.platform)) return true;

  if (
    process.platform === 'win32' &&
    process.argv.some((argument) => String(argument || '').toLowerCase().includes('--squirrel-firstrun'))
  ) {
    return true;
  }

  return false;
}

function checkForAppUpdates() {
  if (shouldSkipAutoUpdate()) return;

  autoUpdater.checkForUpdates().catch((error) => {
    const errorText = String(error?.message || error || 'Unknown auto-update error');
    console.error(`[auto-update] ${errorText}`);
  });
}

function setupAutoUpdates() {
  if (autoUpdateInitialized || shouldSkipAutoUpdate()) return;
  autoUpdateInitialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.info('[auto-update] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    const version = String(info?.version || '').trim();
    const versionSuffix = version ? ` ${version}` : '';
    showSystemNotification('Update found', `Downloading new version${versionSuffix}.`);
  });

  autoUpdater.on('update-not-available', () => {
    console.info('[auto-update] No updates found.');
  });

  autoUpdater.on('error', (error) => {
    const errorText = String(error?.message || error || 'Unknown auto-update error');
    console.error(`[auto-update] ${errorText}`);
    showSystemNotification('Update error', errorText);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const version = String(info?.version || '').trim();
    const versionLabel = version ? ` ${version}` : '';
    showSystemNotification('Update ready', `Version${versionLabel} was downloaded.`);

    if (autoUpdateDialogOpen) return;
    autoUpdateDialogOpen = true;

    try {
      const parentWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      const result = await dialog.showMessageBox(parentWindow, {
        type: 'info',
        title: 'Update ready',
        message: 'A new version has been downloaded.',
        detail: 'Restart now to install it?',
        buttons: ['Install now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      }
    } catch (error) {
      const errorText = String(error?.message || error || 'Failed to show update dialog');
      console.error(`[auto-update] ${errorText}`);
    } finally {
      autoUpdateDialogOpen = false;
    }
  });

  setTimeout(() => {
    checkForAppUpdates();
    autoUpdateIntervalRef = setInterval(checkForAppUpdates, AUTO_UPDATE_RECHECK_INTERVAL_MS);
  }, AUTO_UPDATE_CHECK_DELAY_MS);
}

function ensurePlaylistsDirectory() {
  if (!fs.existsSync(PLAYLISTS_DIR)) {
    fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
  }
}

function normalizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';

  if (filePath.startsWith('file:///')) {
    const decoded = decodeURIComponent(filePath.replace('file:///', ''));
    return process.platform === 'win32' ? decoded.replace(/^\//, '') : `/${decoded}`;
  }

  return filePath;
}

function isValidMediaFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized || normalized.startsWith('-')) return false;

  const ext = path.extname(normalized).toLowerCase().replace('.', '');
  return MEDIA_EXTENSIONS.has(ext);
}

function extractMediaFiles(argv) {
  return argv
    .map((entry) => normalizeFilePath(entry))
    .filter((entry) => entry && isValidMediaFile(entry));
}

function collectMediaFilesFromDirectory(directoryPath, maxFiles = 20000) {
  const root = normalizeFilePath(directoryPath);
  if (!root || !fs.existsSync(root)) {
    return [];
  }

  const result = [];
  const stack = [root];

  while (stack.length > 0) {
    const currentDirectory = stack.pop();
    if (!currentDirectory) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      if (isValidMediaFile(fullPath)) {
        result.push(fullPath);
        if (result.length >= maxFiles) {
          return result;
        }
      }
    }
  }

  return result;
}

function collectMediaFilesFromPlaylistDirectory(directoryPath) {
  const root = normalizeFilePath(directoryPath);
  if (!root || !fs.existsSync(root)) {
    return [];
  }

  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(root, entry.name);
    if (!isValidMediaFile(fullPath)) continue;
    discovered.push({
      name: path.basename(fullPath),
      path: fullPath,
    });
  }

  return discovered;
}

function safeSegment(value, fallback = 'playlist') {
  const sanitized = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim();

  return sanitized || fallback;
}

function escapePowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowerShellCommand(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `PowerShell exited with code ${code}`));
    });
  });
}

async function compressDirectoryToArchive(sourceDirectory, destinationArchivePath) {
  const source = escapePowerShellLiteral(path.resolve(sourceDirectory));
  const destination = escapePowerShellLiteral(path.resolve(destinationArchivePath));

  const script = [
    `$src = ${source}`,
    `$dst = ${destination}`,
    'if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }',
    'Compress-Archive -Path (Join-Path $src \'*\') -DestinationPath $dst -Force',
  ].join('; ');

  await runPowerShellCommand(script);
}

async function extractArchive(archivePath, destinationDirectory) {
  const source = escapePowerShellLiteral(path.resolve(archivePath));
  const destination = escapePowerShellLiteral(path.resolve(destinationDirectory));

  const script = [
    `$src = ${source}`,
    `$dst = ${destination}`,
    'if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }',
    'New-Item -ItemType Directory -Path $dst -Force | Out-Null',
    'Expand-Archive -LiteralPath $src -DestinationPath $dst -Force',
  ].join('; ');

  await runPowerShellCommand(script);
}

function toElectronAccelerator(binding) {
  if (!binding || typeof binding !== 'string') return '';

  const tokenMap = {
    ctrl: 'CommandOrControl',
    control: 'CommandOrControl',
    cmd: 'CommandOrControl',
    command: 'CommandOrControl',
    meta: 'CommandOrControl',
    alt: 'Alt',
    option: 'Alt',
    shift: 'Shift',
    esc: 'Escape',
    arrowleft: 'Left',
    arrowright: 'Right',
    arrowup: 'Up',
    arrowdown: 'Down',
  };

  const tokens = binding
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase();
      if (tokenMap[lower]) return tokenMap[lower];
      if (token.length === 1) return token.toUpperCase();
      return token;
    });

  const uniqueTokens = [];
  for (const token of tokens) {
    if (!uniqueTokens.includes(token)) {
      uniqueTokens.push(token);
    }
  }

  return uniqueTokens.join('+');
}

function ensureUniqueFilePath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }

  const directory = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let suffix = 2;
  let candidate = path.join(directory, `${base} (${suffix})${ext}`);

  while (fs.existsSync(candidate)) {
    suffix += 1;
    candidate = path.join(directory, `${base} (${suffix})${ext}`);
  }

  return candidate;
}

function ensureUniquePlaylistName(baseName) {
  ensurePlaylistsDirectory();

  const normalized = safeSegment(baseName, 'Imported Playlist');
  if (!fs.existsSync(path.join(PLAYLISTS_DIR, normalized))) {
    return normalized;
  }

  let suffix = 2;
  let candidate = `${normalized} (${suffix})`;
  while (fs.existsSync(path.join(PLAYLISTS_DIR, candidate))) {
    suffix += 1;
    candidate = `${normalized} (${suffix})`;
  }

  return candidate;
}

function cleanupImportPreview(token) {
  const session = activeImportPreviews.get(token);
  if (!session) return;

  activeImportPreviews.delete(token);

  if (session.tempRoot && fs.existsSync(session.tempRoot)) {
    fs.rmSync(session.tempRoot, { recursive: true, force: true });
  }
}

function cleanupExpiredImportPreviews() {
  const now = Date.now();
  for (const [token, session] of activeImportPreviews.entries()) {
    if (now - session.createdAt > IMPORT_PREVIEW_TTL_MS) {
      cleanupImportPreview(token);
    }
  }
}

function createImportToken() {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function downloadFileToPath(url, destinationPath) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https links are supported');
  }

  const response = await requestUrl(parsed.toString());
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.arrayBuffer();
  await fs.promises.writeFile(destinationPath, Buffer.from(body));
}

async function requestUrl(url, options = {}) {
  const errors = [];
  const requestOptions = {
    method: 'GET',
    ...options,
  };

  if (net && typeof net.fetch === 'function') {
    try {
      return await net.fetch(url, requestOptions);
    } catch (error) {
      errors.push(`electron.net: ${String(error?.message || error)}`);
    }
  }

  if (typeof fetch === 'function') {
    try {
      return await fetch(url, requestOptions);
    } catch (error) {
      errors.push(`node.fetch: ${String(error?.message || error)}`);
    }
  }

  if (errors.length === 0) {
    errors.push('Network API is unavailable in this build');
  }

  throw new Error(errors.join(' | '));
}

function isVkHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return host === 'vk.com' || host === 'm.vk.com' || host === 'vkvideo.ru' || host.endsWith('.vkvideo.ru');
}

function decodeEscapedUrl(rawValue) {
  if (!rawValue) return '';

  return String(rawValue)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .trim();
}

function decodePercentEncodedUrl(rawValue) {
  let value = String(rawValue || '').trim();
  for (let index = 0; index < 3; index += 1) {
    if (!/%[0-9a-fA-F]{2}/.test(value)) break;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return value;
}

function normalizeAbsoluteUrl(rawValue) {
  const value = decodePercentEncodedUrl(decodeEscapedUrl(rawValue));
  if (!value) return '';

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  return value;
}

function collectVkPlaybackCandidates(html) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (url, score, quality = '', format = 'video') => {
    const normalizedUrl = normalizeAbsoluteUrl(url);
    if (!/^https?:\/\//i.test(normalizedUrl)) return;
    if (seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    candidates.push({
      url: normalizedUrl,
      score,
      quality,
      format,
    });
  };

  // Typical VK JSON payload fields: url240/url360/... with escaped slashes.
  const qualityPattern = /"url(\d{3,4})":"(https?:\\\/\\\/[^"]+?\.mp4[^"]*)"/gi;
  let qualityMatch = qualityPattern.exec(html);
  while (qualityMatch) {
    const quality = Number(qualityMatch[1] || 0);
    pushCandidate(qualityMatch[2], 10000 + quality, `${quality}p`, 'mp4');
    qualityMatch = qualityPattern.exec(html);
  }

  // Unicode-escaped slashes: https:\u002F\u002F...
  const unicodeQualityPattern = /"url(\d{3,4})":"(https?:\\u002f\\u002f[^"]+?\.mp4[^"]*)"/gi;
  let unicodeQualityMatch = unicodeQualityPattern.exec(html);
  while (unicodeQualityMatch) {
    const quality = Number(unicodeQualityMatch[1] || 0);
    pushCandidate(unicodeQualityMatch[2], 9950 + quality, `${quality}p`, 'mp4');
    unicodeQualityMatch = unicodeQualityPattern.exec(html);
  }

  // Fallback for escaped direct MP4 links without explicit url### key.
  const escapedMp4Pattern = /"(https?:\\\/\\\/[^"]+?\.mp4[^"]*)"/gi;
  let escapedMp4Match = escapedMp4Pattern.exec(html);
  while (escapedMp4Match) {
    pushCandidate(escapedMp4Match[1], 9000, '', 'mp4');
    escapedMp4Match = escapedMp4Pattern.exec(html);
  }

  const escapedUnicodeMp4Pattern = /"(https?:\\u002f\\u002f[^"]+?\.mp4[^"]*)"/gi;
  let escapedUnicodeMp4Match = escapedUnicodeMp4Pattern.exec(html);
  while (escapedUnicodeMp4Match) {
    pushCandidate(escapedUnicodeMp4Match[1], 8950, '', 'mp4');
    escapedUnicodeMp4Match = escapedUnicodeMp4Pattern.exec(html);
  }

  // Fallback for plain direct MP4 links.
  const plainMp4Pattern = /https?:\/\/[^\s"'<>\\]+?\.mp4[^\s"'<>\\]*/gi;
  let plainMp4Match = plainMp4Pattern.exec(html);
  while (plainMp4Match) {
    pushCandidate(plainMp4Match[0], 8500, '', 'mp4');
    plainMp4Match = plainMp4Pattern.exec(html);
  }

  // Final fallback: HLS playlist link (Chromium may not play all HLS links natively).
  const escapedHlsPattern = /"(https?:\\\/\\\/[^"]+?\.m3u8[^"]*)"/gi;
  let escapedHlsMatch = escapedHlsPattern.exec(html);
  while (escapedHlsMatch) {
    pushCandidate(escapedHlsMatch[1], 5000, '', 'm3u8');
    escapedHlsMatch = escapedHlsPattern.exec(html);
  }

  const escapedUnicodeHlsPattern = /"(https?:\\u002f\\u002f[^"]+?\.m3u8[^"]*)"/gi;
  let escapedUnicodeHlsMatch = escapedUnicodeHlsPattern.exec(html);
  while (escapedUnicodeHlsMatch) {
    pushCandidate(escapedUnicodeHlsMatch[1], 4950, '', 'm3u8');
    escapedUnicodeHlsMatch = escapedUnicodeHlsPattern.exec(html);
  }

  // Generic escaped URLs in quoted values.
  const genericEscapedPattern =
    /"((?:https?:\\\/\\\/|https?:\\u002f\\u002f)[^"]+?\.(?:mp4|m3u8|mpd)[^"]*)"/gi;
  let genericEscapedMatch = genericEscapedPattern.exec(html);
  while (genericEscapedMatch) {
    const item = genericEscapedMatch[1];
    const format = /\.m3u8/i.test(item) ? 'm3u8' : /\.mpd/i.test(item) ? 'mpd' : 'mp4';
    pushCandidate(item, format === 'mp4' ? 8800 : format === 'm3u8' ? 4900 : 4700, '', format);
    genericEscapedMatch = genericEscapedPattern.exec(html);
  }

  // Percent-encoded direct media URLs.
  const percentEncodedMediaPattern = /https%3a%2f%2f[^"'<>\\\s]+?\.(?:mp4|m3u8|mpd)[^"'<>\\\s]*/gi;
  let percentEncodedMediaMatch = percentEncodedMediaPattern.exec(html);
  while (percentEncodedMediaMatch) {
    const decoded = decodePercentEncodedUrl(percentEncodedMediaMatch[0]);
    const format = /\.m3u8/i.test(decoded) ? 'm3u8' : /\.mpd/i.test(decoded) ? 'mpd' : 'mp4';
    pushCandidate(decoded, format === 'mp4' ? 8750 : format === 'm3u8' ? 4880 : 4680, '', format);
    percentEncodedMediaMatch = percentEncodedMediaPattern.exec(html);
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function extractVkVideoIdentifiers(parsedUrl, html = '') {
  const pathMatch = String(parsedUrl.pathname || '').match(/\/video(-?\d+)_(\d+)/i);
  if (pathMatch) {
    return { ownerId: pathMatch[1], videoId: pathMatch[2] };
  }

  const z = parsedUrl.searchParams.get('z');
  const zMatch = String(z || '').match(/video(-?\d+)_(\d+)/i);
  if (zMatch) {
    return { ownerId: zMatch[1], videoId: zMatch[2] };
  }

  const htmlMatch = String(html).match(/video(-?\d+)_(\d+)/i);
  if (htmlMatch) {
    return { ownerId: htmlMatch[1], videoId: htmlMatch[2] };
  }

  return null;
}

function extractVkHashes(html) {
  const hashes = [];
  const seen = new Set();

  const pushHash = (rawValue) => {
    const value = decodePercentEncodedUrl(decodeEscapedUrl(rawValue)).trim();
    if (!value || value.length < 6) return;
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) return;
    if (seen.has(value)) return;
    seen.add(value);
    hashes.push(value);
  };

  const queryHashPattern = /(?:[?&]|%3f|%26)(?:hash|access_hash|video_hash)%3d([a-zA-Z0-9._-]+)/gi;
  let queryHashMatch = queryHashPattern.exec(html);
  while (queryHashMatch) {
    pushHash(queryHashMatch[1]);
    queryHashMatch = queryHashPattern.exec(html);
  }

  const plainQueryHashPattern = /[?&](?:hash|access_hash|video_hash)=([a-zA-Z0-9._-]+)/gi;
  let plainQueryHashMatch = plainQueryHashPattern.exec(html);
  while (plainQueryHashMatch) {
    pushHash(plainQueryHashMatch[1]);
    plainQueryHashMatch = plainQueryHashPattern.exec(html);
  }

  const jsonHashPattern = /"(?:hash|access_hash|embed_hash|video_ext_hash)"\s*:\s*"([^"]+)"/gi;
  let jsonHashMatch = jsonHashPattern.exec(html);
  while (jsonHashMatch) {
    pushHash(jsonHashMatch[1]);
    jsonHashMatch = jsonHashPattern.exec(html);
  }

  const singleQuotedHashPattern = /'(?:hash|access_hash|embed_hash|video_ext_hash)'\s*:\s*'([^']+)'/gi;
  let singleQuotedHashMatch = singleQuotedHashPattern.exec(html);
  while (singleQuotedHashMatch) {
    pushHash(singleQuotedHashMatch[1]);
    singleQuotedHashMatch = singleQuotedHashPattern.exec(html);
  }

  return hashes;
}

function buildVkEmbedPageCandidates(html, parsedUrl) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (rawValue) => {
    const decoded = normalizeAbsoluteUrl(rawValue);
    if (!decoded) return;

    let normalized = decoded;
    if (normalized.startsWith('/video_ext.php')) {
      normalized = `https://vk.com${normalized}`;
    }

    if (!/^https?:\/\/(www\.)?vk\.com\/video_ext\.php\?/i.test(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const escapedAbsolutePattern = /https?:\\\/\\\/(?:www\.)?vk\.com\\\/video_ext\.php\?[^"'<>\s\\]+/gi;
  let escapedAbsoluteMatch = escapedAbsolutePattern.exec(html);
  while (escapedAbsoluteMatch) {
    pushCandidate(escapedAbsoluteMatch[0]);
    escapedAbsoluteMatch = escapedAbsolutePattern.exec(html);
  }

  const unicodeAbsolutePattern = /https?:\\u002f\\u002f(?:www\.)?vk\.com\\u002fvideo_ext\.php\?[^"'<>\s\\]+/gi;
  let unicodeAbsoluteMatch = unicodeAbsolutePattern.exec(html);
  while (unicodeAbsoluteMatch) {
    pushCandidate(unicodeAbsoluteMatch[0]);
    unicodeAbsoluteMatch = unicodeAbsolutePattern.exec(html);
  }

  const percentEncodedAbsolutePattern = /https%3a%2f%2f(?:www\.)?vk\.com%2fvideo_ext\.php%3f[^"'<>\s\\]+/gi;
  let percentEncodedAbsoluteMatch = percentEncodedAbsolutePattern.exec(html);
  while (percentEncodedAbsoluteMatch) {
    pushCandidate(percentEncodedAbsoluteMatch[0]);
    percentEncodedAbsoluteMatch = percentEncodedAbsolutePattern.exec(html);
  }

  const plainAbsolutePattern = /https?:\/\/(?:www\.)?vk\.com\/video_ext\.php\?[^"'<>\s\\]+/gi;
  let plainAbsoluteMatch = plainAbsolutePattern.exec(html);
  while (plainAbsoluteMatch) {
    pushCandidate(plainAbsoluteMatch[0]);
    plainAbsoluteMatch = plainAbsolutePattern.exec(html);
  }

  const relativePattern = /(?:^|["'(\s])(\/video_ext\.php\?[^"'<>\s\\]+)/gi;
  let relativeMatch = relativePattern.exec(html);
  while (relativeMatch) {
    pushCandidate(relativeMatch[1]);
    relativeMatch = relativePattern.exec(html);
  }

  const identifiers = extractVkVideoIdentifiers(parsedUrl, html);
  if (identifiers) {
    const { ownerId, videoId } = identifiers;
    const listParam = parsedUrl.searchParams.get('list');
    const hashes = extractVkHashes(html);
    const baseHosts = ['https://vk.com', 'https://m.vk.com'];

    for (const host of baseHosts) {
      const listSuffix = listParam ? `&list=${encodeURIComponent(listParam)}` : '';
      pushCandidate(`${host}/video_ext.php?oid=${ownerId}&id=${videoId}&hd=4${listSuffix}`);
      pushCandidate(`${host}/video_ext.php?oid=${ownerId}&id=${videoId}&hd=4&autoplay=1${listSuffix}`);
    }

    for (const hash of hashes) {
      for (const host of baseHosts) {
        const listSuffix = listParam ? `&list=${encodeURIComponent(listParam)}` : '';
        const hashSuffix = `&hash=${encodeURIComponent(hash)}`;
        pushCandidate(`${host}/video_ext.php?oid=${ownerId}&id=${videoId}&hd=4${hashSuffix}${listSuffix}`);
        pushCandidate(`${host}/video_ext.php?oid=${ownerId}&id=${videoId}&hd=4&autoplay=1${hashSuffix}${listSuffix}`);
      }
    }
  }

  return candidates;
}

function buildVkOEmbedRequestCandidates(parsedUrl) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (targetVideoUrl) => {
    const normalizedVideoUrl = String(targetVideoUrl || '').trim();
    if (!normalizedVideoUrl) return;
    const oembedUrl = `https://vk.com/oembed.php?url=${encodeURIComponent(normalizedVideoUrl)}`;
    if (seen.has(oembedUrl)) return;
    seen.add(oembedUrl);
    candidates.push(oembedUrl);
  };

  const pathWithQuery = `${parsedUrl.pathname || ''}${parsedUrl.search || ''}`;
  pushCandidate(parsedUrl.toString());
  pushCandidate(`https://vk.com${pathWithQuery}`);
  pushCandidate(`https://m.vk.com${pathWithQuery}`);
  pushCandidate(`https://vkvideo.ru${pathWithQuery}`);

  return candidates;
}

function appendUniqueValues(targetList, values) {
  if (!Array.isArray(values) || values.length === 0) return;
  const seen = new Set(targetList);
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    targetList.push(normalized);
  }
}

async function resolveVkViaEmbedPages(embedCandidates, requestHeaders, requestErrors) {
  for (const embedUrl of embedCandidates) {
    let embedResponse;
    try {
      embedResponse = await requestUrl(embedUrl, { headers: requestHeaders });
    } catch (error) {
      requestErrors.push(`${embedUrl}: ${String(error?.message || error)}`);
      continue;
    }

    if (!embedResponse.ok) {
      requestErrors.push(`${embedUrl}: ${embedResponse.status} ${embedResponse.statusText}`);
      continue;
    }

    const embedHtml = await embedResponse.text();
    const embedCandidatesFound = collectVkPlaybackCandidates(embedHtml);
    if (embedCandidatesFound[0]) {
      return embedCandidatesFound[0];
    }
  }

  return null;
}

async function appendVkEmbedCandidatesFromOEmbed(parsedUrl, requestHeaders, requestErrors, embedCandidates) {
  const oembedCandidates = buildVkOEmbedRequestCandidates(parsedUrl);
  for (const oembedUrl of oembedCandidates) {
    let oembedResponse;
    try {
      oembedResponse = await requestUrl(oembedUrl, {
        headers: {
          ...requestHeaders,
          accept: 'application/json,text/plain,*/*',
        },
      });
    } catch (error) {
      requestErrors.push(`${oembedUrl}: ${String(error?.message || error)}`);
      continue;
    }

    if (!oembedResponse.ok) {
      requestErrors.push(`${oembedUrl}: ${oembedResponse.status} ${oembedResponse.statusText}`);
      continue;
    }

    let oembedText = '';
    try {
      oembedText = await oembedResponse.text();
    } catch {
      continue;
    }

    const foundInRaw = buildVkEmbedPageCandidates(oembedText, parsedUrl);
    appendUniqueValues(embedCandidates, foundInRaw);

    try {
      const parsed = JSON.parse(oembedText);
      if (parsed && typeof parsed.html === 'string') {
        const foundInHtml = buildVkEmbedPageCandidates(parsed.html, parsedUrl);
        appendUniqueValues(embedCandidates, foundInHtml);
      }
    } catch {
      // Ignore non-JSON payloads.
    }
  }
}

function inferVkMediaFormat(url) {
  const normalized = String(url || '').toLowerCase();
  if (/\.mp4(?:$|[?#])/i.test(normalized)) return 'mp4';
  if (/\.m3u8(?:$|[?#])/i.test(normalized)) return 'm3u8';
  if (/\.mpd(?:$|[?#])/i.test(normalized)) return 'mpd';
  return 'video';
}

function inferVkQualityFromUrl(url) {
  const normalized = String(url || '');
  const patterns = [
    /(?:^|[^\d])(2160|1440|1080|720|540|480|360|240)(?:p)?(?:[^\d]|$)/i,
    /url(2160|1440|1080|720|540|480|360|240)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const quality = Number(match[1]);
      if (Number.isFinite(quality) && quality > 0) return quality;
    }
  }

  return 0;
}

function rankVkMediaCandidate(url) {
  const format = inferVkMediaFormat(url);
  const quality = inferVkQualityFromUrl(url);
  const baseScore = format === 'mp4' ? 10000 : format === 'm3u8' ? 7500 : format === 'mpd' ? 7000 : 5000;
  return {
    url,
    format,
    quality: quality > 0 ? `${quality}p` : '',
    score: baseScore + quality,
  };
}

function pickBestVkMediaCandidate(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const ranked = urls
    .map((entry) => rankVkMediaCandidate(entry))
    .sort((a, b) => b.score - a.score);
  return ranked[0] || null;
}

async function resolveVkViaHiddenWindow(sourceUrl, userAgent) {
  const rawUrl = String(sourceUrl || '').trim();
  if (!rawUrl) {
    return { success: false, error: 'Hidden browser: source URL is empty' };
  }

  const collectedUrls = [];
  const seenUrls = new Set();

  return new Promise((resolve) => {
    let settled = false;
    let windowRef = null;
    let timeoutRef = null;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }

      try {
        const sessionRef = windowRef?.webContents?.session;
        if (sessionRef?.webRequest) {
          sessionRef.webRequest.onBeforeRequest(null);
        }
      } catch {
        // Ignore cleanup errors.
      }

      try {
        if (windowRef && !windowRef.isDestroyed()) {
          windowRef.destroy();
        }
      } catch {
        // Ignore cleanup errors.
      }

      resolve(result);
    };

    const maybeAddMediaUrl = (rawMediaUrl) => {
      const normalized = normalizeAbsoluteUrl(rawMediaUrl);
      if (!/^https?:\/\//i.test(normalized)) return false;
      if (!/\.(mp4|m3u8|mpd)(?:$|[?#])/i.test(normalized)) return false;
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      collectedUrls.push(normalized);
      return true;
    };

    const trySettleWithBest = () => {
      const best = pickBestVkMediaCandidate(collectedUrls);
      if (!best) return false;
      settle({
        success: true,
        playableUrl: best.url,
        format: best.format,
        quality: best.quality || null,
      });
      return true;
    };

    const nudgePlayback = () => {
      if (!windowRef || windowRef.isDestroyed()) return;
      windowRef.webContents
        .executeJavaScript(
          `(() => {
            const click = (selector) => {
              const node = document.querySelector(selector);
              if (!node) return false;
              node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return true;
            };

            const video = document.querySelector('video');
            if (video) {
              video.muted = true;
              video.volume = 0;
              const playPromise = video.play();
              if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => undefined);
              }
            }

            click('button[aria-label*="Play"]') ||
            click('button[aria-label*="Воспроизвести"]') ||
            click('[data-testid*="play"]') ||
            click('.vjs-big-play-button') ||
            click('.VideoLayer__playButton');
            return true;
          })();`,
          true
        )
        .catch(() => undefined);
    };

    try {
      const partition = `vk-resolve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      windowRef = new BrowserWindow({
        show: false,
        width: 1280,
        height: 720,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          partition,
        },
      });

      const sessionRef = windowRef.webContents.session;
      sessionRef.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        if (maybeAddMediaUrl(details.url)) {
          trySettleWithBest();
        }
        callback({ cancel: false });
      });

      windowRef.webContents.on('did-finish-load', () => {
        nudgePlayback();
        setTimeout(nudgePlayback, 900);
        setTimeout(nudgePlayback, 2200);
      });
      windowRef.webContents.on('dom-ready', () => {
        nudgePlayback();
      });
      windowRef.webContents.on('did-navigate', () => {
        setTimeout(nudgePlayback, 700);
      });
      windowRef.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        settle({ success: false, error: `Hidden browser load failed: ${errorCode} ${errorDescription}` });
      });

      timeoutRef = setTimeout(() => {
        if (trySettleWithBest()) return;
        settle({ success: false, error: 'Hidden browser: stream not found' });
      }, 16000);

      windowRef
        .loadURL(rawUrl, userAgent ? { userAgent } : undefined)
        .catch((error) => settle({ success: false, error: `Hidden browser open failed: ${String(error?.message || error)}` }));
    } catch (error) {
      settle({ success: false, error: `Hidden browser init failed: ${String(error?.message || error)}` });
    }
  });
}

function buildVkPageCandidates(parsedUrl) {
  const candidates = [];
  const seen = new Set();
  const pathWithQuery = `${parsedUrl.pathname || ''}${parsedUrl.search || ''}`;

  const pushCandidate = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  pushCandidate(parsedUrl.toString());

  const host = String(parsedUrl.hostname || '').toLowerCase().replace(/^www\./, '');
  if (host === 'vkvideo.ru' || host.endsWith('.vkvideo.ru')) {
    pushCandidate(`https://vk.com${pathWithQuery}`);
    pushCandidate(`https://m.vk.com${pathWithQuery}`);
    return candidates;
  }

  if (host === 'vk.com' || host === 'm.vk.com') {
    pushCandidate(`https://vk.com${pathWithQuery}`);
    pushCandidate(`https://m.vk.com${pathWithQuery}`);
    return candidates;
  }

  return candidates;
}

async function resolveVkVideoPlaybackUrl(inputUrl) {
  const rawUrl = String(inputUrl || '').trim();
  if (!rawUrl) {
    return { success: false, error: 'VK URL is empty' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { success: false, error: 'Invalid VK URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { success: false, error: 'Only http/https VK links are supported' };
  }

  if (!isVkHost(parsed.hostname)) {
    return { success: false, error: 'Only VK video links are supported' };
  }

  const requestErrors = [];
  const pageCandidates = buildVkPageCandidates(parsed);
  const requestHeaders = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  for (const pageUrl of pageCandidates) {
    let response;
    try {
      response = await requestUrl(pageUrl, { headers: requestHeaders });
    } catch (error) {
      requestErrors.push(`${pageUrl}: ${String(error?.message || error)}`);
      continue;
    }

    if (!response.ok) {
      requestErrors.push(`${pageUrl}: ${response.status} ${response.statusText}`);
      continue;
    }

    const html = await response.text();
    const directCandidates = collectVkPlaybackCandidates(html);
    const directBest = directCandidates[0];
    if (directBest) {
      return {
        success: true,
        playableUrl: directBest.url,
        format: directBest.format,
        quality: directBest.quality || null,
      };
    }

    const parsedPageUrl = new URL(pageUrl);
    const embedCandidates = buildVkEmbedPageCandidates(html, parsedPageUrl);
    await appendVkEmbedCandidatesFromOEmbed(parsedPageUrl, requestHeaders, requestErrors, embedCandidates);
    const embedBest = await resolveVkViaEmbedPages(embedCandidates, requestHeaders, requestErrors);

    if (embedBest) {
      return {
        success: true,
        playableUrl: embedBest.url,
        format: embedBest.format,
        quality: embedBest.quality || null,
      };
    }

    requestErrors.push(`${pageUrl}: stream not found`);
  }

  for (const pageUrl of pageCandidates) {
    const hiddenResult = await resolveVkViaHiddenWindow(pageUrl, requestHeaders['user-agent']);
    if (hiddenResult?.success && hiddenResult.playableUrl) {
      return hiddenResult;
    }
    if (hiddenResult?.error) {
      requestErrors.push(`${pageUrl} hidden: ${hiddenResult.error}`);
    }
  }

  const nonOembedErrors = requestErrors.filter((item) => !item.includes('/oembed.php?url='));
  const errorList = nonOembedErrors.length > 0 ? nonOembedErrors : requestErrors;
  const details = errorList.slice(0, 3).join(' | ');
  return {
    success: false,
    error: `Unable to open VK video link. ${details || 'No playable stream found.'}`,
  };
}

function sendPlaybackControl(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('playback-control', command);
}

function toggleMainWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isVisible()) {
    hideMainWindowToTray();
    return;
  }

  showMainWindow();
}

function triggerGlobalHotkey(action) {
  if (action === 'togglePlayPause') {
    sendPlaybackControl('toggle');
    return;
  }

  if (action === 'previousTrack') {
    sendPlaybackControl('previous');
    return;
  }

  if (action === 'nextTrack') {
    sendPlaybackControl('next');
    return;
  }

  if (action === 'toggleWindow') {
    toggleMainWindowVisibility();
  }
}

function registerGlobalHotkeys(bindings = {}) {
  globalShortcut.unregisterAll();
  registeredGlobalHotkeys.clear();

  const result = {
    registered: [],
    failed: [],
  };

  for (const [action, binding] of Object.entries(bindings)) {
    if (!GLOBAL_HOTKEY_ACTIONS.has(action)) continue;
    if (!binding || typeof binding !== 'string') continue;

    const accelerator = toElectronAccelerator(binding);
    if (!accelerator) continue;

    const ok = globalShortcut.register(accelerator, () => triggerGlobalHotkey(action));
    if (ok) {
      registeredGlobalHotkeys.set(action, accelerator);
      result.registered.push({ action, accelerator });
    } else {
      result.failed.push({ action, accelerator });
    }
  }

  return result;
}

function showMainWindow() {
  if (!mainWindow) return;

  mainWindow.setSkipTaskbar(false);

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  updateTrayMenu();
}

function hideMainWindowToTray() {
  if (!mainWindow) return;

  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const isVisible = Boolean(mainWindow && mainWindow.isVisible());

  const menu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Window' : 'Open Player',
      click: () => toggleMainWindowVisibility(),
    },
    { type: 'separator' },
    {
      label: 'Play/Pause',
      click: () => sendPlaybackControl('toggle'),
    },
    {
      label: 'Next',
      click: () => sendPlaybackControl('next'),
    },
    {
      label: 'Previous',
      click: () => sendPlaybackControl('previous'),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  if (tray) {
    updateTrayMenu();
    return;
  }

  const iconImage = nativeImage.createFromPath(APP_ICON);
  tray = new Tray(iconImage.isEmpty() ? nativeImage.createEmpty() : iconImage);
  tray.setToolTip('Universal Media Player');
  tray.on('click', () => toggleMainWindowVisibility());
  tray.on('double-click', () => showMainWindow());

  updateTrayMenu();
}

function destroyTray() {
  if (!tray) return;

  tray.destroy();
  tray = null;
}

function setTrayModeEnabled(enabled) {
  trayModeEnabled = Boolean(enabled);

  if (trayModeEnabled) {
    createTray();
  } else {
    destroyTray();
    if (mainWindow) {
      mainWindow.setSkipTaskbar(false);
    }
  }

  return trayModeEnabled;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashHtml = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          margin: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Manrope, Segoe UI, sans-serif;
          background: radial-gradient(circle at 20% 0, rgba(79,157,255,0.34), transparent 45%), linear-gradient(150deg, rgba(12,18,32,0.98), rgba(18,30,54,0.98));
          color: #eef4ff;
          overflow: hidden;
        }

        .card {
          width: 360px;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 28px;
          text-align: center;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(16px);
        }

        .logo-wrap {
          position: relative;
          width: 76px;
          height: 76px;
          margin: 0 auto 16px;
        }

        .ring,
        .ring2 {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(79,157,255,0.45);
          animation: spin 1.6s linear infinite;
        }

        .ring2 {
          inset: 8px;
          border-color: rgba(255,255,255,0.6);
          animation-direction: reverse;
          animation-duration: 1.2s;
        }

        .logo {
          position: absolute;
          inset: 18px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(160deg, #5ba5ff, #2b69ff);
          font-weight: 700;
          letter-spacing: 0.05em;
          box-shadow: 0 0 26px rgba(79,157,255,0.55);
          animation: pulse 1.3s ease-in-out infinite;
        }

        .progress {
          margin-top: 14px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          overflow: hidden;
        }

        .progress span {
          display: block;
          height: 100%;
          width: 32%;
          background: linear-gradient(90deg, #4f9dff, #9bc2ff);
          animation: loader 1.1s ease-in-out infinite;
        }

        h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        p {
          margin: 8px 0 0;
          font-size: 12px;
          color: rgba(238, 244, 255, 0.72);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(0.92); }
          50% { transform: scale(1); }
        }

        @keyframes loader {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-wrap">
          <div class="ring"></div>
          <div class="ring2"></div>
          <div class="logo">UM</div>
        </div>
        <h1>Universal Media Player</h1>
        <p>Preparing workspace...</p>
        <div class="progress"><span></span></div>
      </div>
    </body>
  </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createMainWindow() {
  isRendererReady = false;
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0b1220',
    icon: APP_ICON,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    if (launchToTrayOnStartup) {
      createTray();
      hideMainWindowToTray();
      launchToTrayOnStartup = false;
    } else {
      showMainWindow();
    }

    if (splashWindow) {
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
      }, 320);
    }

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-start-loading', () => {
    isRendererReady = false;
  });

  mainWindow.on('close', (event) => {
    if (trayModeEnabled && !isQuitting) {
      event.preventDefault();
      hideMainWindowToTray();
    }
  });

  mainWindow.on('closed', () => {
    isRendererReady = false;
    mainWindow = null;
  });

  mainWindow.on('show', () => updateTrayMenu());
  mainWindow.on('hide', () => updateTrayMenu());

  createAppMenu();
}

function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open files',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Playback',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => mainWindow?.webContents.send('playback-control', 'toggle'),
        },
        {
          label: 'Stop',
          accelerator: 'S',
          click: () => mainWindow?.webContents.send('playback-control', 'stop'),
        },
        {
          label: 'Next',
          accelerator: 'N',
          click: () => mainWindow?.webContents.send('playback-control', 'next'),
        },
        {
          label: 'Previous',
          accelerator: 'P',
          click: () => mainWindow?.webContents.send('playback-control', 'previous'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openFileDialog() {
  if (!mainWindow) return;

  dialog
    .showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media files',
          extensions: Array.from(MEDIA_EXTENSIONS),
        },
        {
          name: 'All files',
          extensions: ['*'],
        },
      ],
    })
    .then((result) => {
      if (result.canceled || result.filePaths.length === 0) return;

      const files = result.filePaths
        .map((filePath) => normalizeFilePath(filePath))
        .filter((filePath) => isValidMediaFile(filePath));

      if (files.length > 0) {
        mainWindow.webContents.send('files-selected', files);
      }
    })
    .catch(() => undefined);
}

function flushPendingFiles() {
  if (!mainWindow || !isRendererReady || pendingFiles.length === 0) return;

  const unique = Array.from(new Set(pendingFiles.filter((filePath) => isValidMediaFile(filePath))));
  pendingFiles = [];

  if (unique.length > 0) {
    mainWindow.webContents.send('files-opened', unique);
  }
}

function queueFilesForOpen(filePaths) {
  const validFiles = filePaths.filter((filePath) => isValidMediaFile(filePath));
  if (validFiles.length === 0) return;

  if (!mainWindow || mainWindow.webContents.isLoading() || !isRendererReady) {
    pendingFiles.push(...validFiles);
    return;
  }

  mainWindow.webContents.send('files-opened', validFiles);
}

function isPathInside(parentPath, targetPath) {
  const relative = path.relative(parentPath, targetPath);
  if (!relative) return true;
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function readManifestFromExtractedArchive(extractedDirectory) {
  const directManifest = path.join(extractedDirectory, 'manifest.json');
  if (fs.existsSync(directManifest)) {
    return {
      manifestPath: directManifest,
      baseDirectory: extractedDirectory,
    };
  }

  const entries = fs.readdirSync(extractedDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(extractedDirectory, entry.name, 'manifest.json');
    if (fs.existsSync(candidate)) {
      return {
        manifestPath: candidate,
        baseDirectory: path.join(extractedDirectory, entry.name),
      };
    }
  }

  return null;
}

async function createPlaylistExportArchive(payload) {
  const playlistName = safeSegment(payload?.playlistName, 'playlist');
  const inputFiles = Array.isArray(payload?.files) ? payload.files : [];
  const localFiles = inputFiles.filter((file) => {
    const sourcePath = normalizeFilePath(file?.path || '');
    return sourcePath && !sourcePath.startsWith('blob:') && fs.existsSync(sourcePath);
  });

  if (localFiles.length === 0) {
    return {
      success: false,
      canceled: false,
      error: 'No local files available for export',
    };
  }

  const saveDialog = await dialog.showSaveDialog(mainWindow || undefined, {
    title: 'Export playlist archive',
    defaultPath: `${playlistName}${IMPORT_ARCHIVE_EXTENSION}`,
    filters: [{ name: 'Playlist archives', extensions: ['zip'] }],
  });

  if (saveDialog.canceled || !saveDialog.filePath) {
    return { success: false, canceled: true };
  }

  const tempRoot = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'ump-export-'));
  const bundleDirectory = path.join(tempRoot, 'bundle');
  const mediaDirectory = path.join(bundleDirectory, 'media');

  try {
    await fs.promises.mkdir(mediaDirectory, { recursive: true });

    const manifestFiles = [];

    for (const [index, file] of localFiles.entries()) {
      const sourcePath = normalizeFilePath(file.path || '');
      if (!sourcePath || !fs.existsSync(sourcePath)) continue;

      const sourceExt = path.extname(sourcePath);
      const fallbackName = sourceExt ? path.basename(sourcePath) : `${path.basename(sourcePath)}.bin`;
      const preferredName = safeSegment(file.name || fallbackName, fallbackName);
      const targetPath = ensureUniqueFilePath(path.join(mediaDirectory, preferredName));
      await fs.promises.copyFile(sourcePath, targetPath);

      const relativePath = path.relative(bundleDirectory, targetPath);
      manifestFiles.push({
        index,
        name: path.basename(targetPath),
        format: file.format || path.extname(targetPath).replace('.', '').toLowerCase(),
        type: file.type || null,
        relativePath: relativePath.split(path.sep).join('/'),
      });
    }

    if (manifestFiles.length === 0) {
      return {
        success: false,
        canceled: false,
        error: 'No readable files were exported',
      };
    }

    const manifest = {
      formatVersion: 1,
      app: 'Universal Media Player',
      exportedAt: new Date().toISOString(),
      playlists: [
        {
          name: payload?.playlistName || playlistName,
          files: manifestFiles,
        },
      ],
    };

    await fs.promises.writeFile(
      path.join(bundleDirectory, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    await compressDirectoryToArchive(bundleDirectory, saveDialog.filePath);

    return {
      success: true,
      canceled: false,
      archivePath: saveDialog.filePath,
      playlistName: payload?.playlistName || playlistName,
      fileCount: manifestFiles.length,
    };
  } catch (error) {
    return {
      success: false,
      canceled: false,
      error: String(error?.message || error),
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function createImportPreview(payload) {
  cleanupExpiredImportPreviews();

  const tempRoot = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'ump-import-'));
  const archivePath = path.join(tempRoot, 'bundle.zip');
  const extractDirectory = path.join(tempRoot, 'extracted');

  try {
    const sourceType = payload?.type === 'file' ? 'file' : 'url';

    if (sourceType === 'file') {
      const sourcePath = normalizeFilePath(payload?.filePath || '');
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error('Archive file was not found');
      }

      await fs.promises.copyFile(sourcePath, archivePath);
    } else {
      const sourceUrl = String(payload?.url || '').trim();
      if (!sourceUrl) {
        throw new Error('Import link is empty');
      }

      await downloadFileToPath(sourceUrl, archivePath);
    }

    await extractArchive(archivePath, extractDirectory);

    const manifestInfo = readManifestFromExtractedArchive(extractDirectory);
    if (!manifestInfo) {
      throw new Error('manifest.json was not found in archive');
    }

    const raw = await fs.promises.readFile(manifestInfo.manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);

    if (!manifest || !Array.isArray(manifest.playlists)) {
      throw new Error('Invalid archive manifest');
    }

    const previewPlaylists = manifest.playlists.map((playlist) => {
      const files = Array.isArray(playlist?.files) ? playlist.files : [];
      return {
        name: String(playlist?.name || 'Imported Playlist'),
        fileCount: files.length,
        files: files.map((file) => ({
          name: String(file?.name || path.basename(String(file?.relativePath || 'file'))),
          format: String(file?.format || ''),
          type: String(file?.type || ''),
        })),
      };
    });

    const totalFiles = previewPlaylists.reduce((acc, playlist) => acc + playlist.fileCount, 0);
    if (totalFiles === 0) {
      throw new Error('Archive has no media files');
    }

    const token = createImportToken();
    activeImportPreviews.set(token, {
      createdAt: Date.now(),
      tempRoot,
      baseDirectory: manifestInfo.baseDirectory,
      manifest,
    });

    return {
      success: true,
      token,
      preview: {
        playlistCount: previewPlaylists.length,
        totalFiles,
        playlists: previewPlaylists,
      },
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    return {
      success: false,
      error: String(error?.message || error),
    };
  }
}

async function applyImportPreview(token) {
  cleanupExpiredImportPreviews();

  const session = activeImportPreviews.get(token);
  if (!session) {
    return {
      success: false,
      error: 'Import preview session expired. Please preview archive again.',
    };
  }

  try {
    ensurePlaylistsDirectory();

    const importedPlaylists = [];
    const playlists = Array.isArray(session.manifest?.playlists) ? session.manifest.playlists : [];

    for (const playlist of playlists) {
      const targetPlaylistName = ensureUniquePlaylistName(playlist?.name || 'Imported Playlist');
      const targetDirectory = path.join(PLAYLISTS_DIR, targetPlaylistName);
      await fs.promises.mkdir(targetDirectory, { recursive: true });

      const sourceFiles = Array.isArray(playlist?.files) ? playlist.files : [];
      const savedFiles = [];

      for (const fileEntry of sourceFiles) {
        const relativePath = String(fileEntry?.relativePath || '').trim();
        if (!relativePath) continue;

        const sourcePath = path.resolve(session.baseDirectory, relativePath);
        if (!isPathInside(session.baseDirectory, sourcePath)) continue;
        if (!fs.existsSync(sourcePath)) continue;

        const preferredName = safeSegment(
          fileEntry?.name || path.basename(sourcePath),
          path.basename(sourcePath)
        );
        const targetPath = ensureUniqueFilePath(path.join(targetDirectory, preferredName));
        await fs.promises.copyFile(sourcePath, targetPath);

        savedFiles.push({
          name: path.basename(targetPath),
          path: targetPath,
        });
      }

      await fs.promises.writeFile(
        path.join(targetDirectory, 'files.json'),
        JSON.stringify({ files: savedFiles, importedAt: Date.now() }, null, 2),
        'utf-8'
      );

      importedPlaylists.push({
        name: targetPlaylistName,
        savedFiles,
      });
    }

    return {
      success: true,
      importedPlaylists,
      totalFiles: importedPlaylists.reduce(
        (acc, playlist) => acc + (Array.isArray(playlist.savedFiles) ? playlist.savedFiles.length : 0),
        0
      ),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error),
    };
  } finally {
    cleanupImportPreview(token);
  }
}

function setupIpcHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.on('open-file-dialog', () => {
    openFileDialog();
  });

  ipcMain.on('renderer-ready', () => {
    isRendererReady = true;
    flushPendingFiles();
  });

  ipcMain.handle('pick-media-folder', async () => {
    try {
      const selection = await dialog.showOpenDialog(mainWindow || undefined, {
        title: 'Select folder with media files',
        properties: ['openDirectory'],
      });

      if (selection.canceled || !Array.isArray(selection.filePaths) || selection.filePaths.length === 0) {
        return {
          success: false,
          canceled: true,
          files: [],
        };
      }

      const folderPath = normalizeFilePath(selection.filePaths[0]);
      const files = collectMediaFilesFromDirectory(folderPath);

      return {
        success: true,
        canceled: false,
        folderPath,
        files,
      };
    } catch (error) {
      return {
        success: false,
        canceled: false,
        files: [],
        error: String(error?.message || error),
      };
    }
  });

  ipcMain.handle('load-saved-playlists', async () => {
    try {
      ensurePlaylistsDirectory();

      const folders = fs.readdirSync(PLAYLISTS_DIR).filter((entry) => {
        return fs.statSync(path.join(PLAYLISTS_DIR, entry)).isDirectory();
      });

      const playlists = folders.map((folderName) => {
        const playlistDirectory = path.join(PLAYLISTS_DIR, folderName);
        const filesPath = path.join(playlistDirectory, 'files.json');
        let savedFiles = [];

        if (fs.existsSync(filesPath)) {
          try {
            const content = JSON.parse(fs.readFileSync(filesPath, 'utf-8'));
            savedFiles = Array.isArray(content.files) ? content.files : [];
          } catch {
            savedFiles = [];
          }
        }

        if (!Array.isArray(savedFiles) || savedFiles.length === 0) {
          const recoveredFiles = collectMediaFilesFromPlaylistDirectory(playlistDirectory);
          if (recoveredFiles.length > 0) {
            savedFiles = recoveredFiles;
            try {
              fs.writeFileSync(
                filesPath,
                JSON.stringify({ files: recoveredFiles, recoveredAt: Date.now() }, null, 2),
                'utf-8'
              );
            } catch {
              // Non-fatal: continue even if files.json cannot be rewritten now.
            }
          }
        }

        return {
          name: folderName,
          savedFiles,
        };
      });

      return { success: true, playlists };
    } catch (error) {
      return { success: false, playlists: [], error: String(error?.message || error) };
    }
  });

  ipcMain.handle('delete-playlist-folder', async (_event, playlistName) => {
    try {
      ensurePlaylistsDirectory();
      const target = path.join(PLAYLISTS_DIR, playlistName);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('open-playlists-folder', async () => {
    try {
      ensurePlaylistsDirectory();
      const openResult = await shell.openPath(PLAYLISTS_DIR);
      if (openResult) {
        return { success: false, error: openResult };
      }

      return { success: true, path: PLAYLISTS_DIR };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('save-files-to-playlist', async (_event, playlistName, files) => {
    try {
      ensurePlaylistsDirectory();
      const playlistPath = path.join(PLAYLISTS_DIR, playlistName);

      await fs.promises.mkdir(playlistPath, { recursive: true });

      const inputFiles = Array.isArray(files) ? files : [];
      const total = inputFiles.length;
      let copiedCount = 0;
      let processed = 0;
      const filesJsonPath = path.join(playlistPath, 'files.json');
      let existingSavedFiles = [];

      if (fs.existsSync(filesJsonPath)) {
        try {
          const existingContent = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
          existingSavedFiles = Array.isArray(existingContent.files) ? existingContent.files : [];
        } catch {
          existingSavedFiles = [];
        }
      }

      const savedFilesByPath = new Map();
      for (const existingFile of existingSavedFiles) {
        const existingPath = normalizeFilePath(existingFile?.path || '');
        if (!existingPath || !fs.existsSync(existingPath)) continue;
        savedFilesByPath.set(existingPath, {
          name: path.basename(existingPath),
          path: existingPath,
        });
      }

      const sendProgress = (done = false) => {
        mainWindow?.webContents.send('playlist-save-progress', {
          playlistName,
          processed,
          total,
          copiedCount,
          done,
        });
      };

      if (total === 0) {
        sendProgress(true);
        return { success: true, copiedCount, total };
      }

      for (const file of inputFiles) {
        if (!file?.path) {
          processed += 1;
          sendProgress(false);
          continue;
        }

        const sourcePath = normalizeFilePath(file.path);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          processed += 1;
          sendProgress(false);
          continue;
        }

        const targetPath = path.join(playlistPath, path.basename(sourcePath));

        if (!fs.existsSync(targetPath)) {
          await fs.promises.copyFile(sourcePath, targetPath);
          copiedCount += 1;
        }

        savedFilesByPath.set(targetPath, {
          name: path.basename(targetPath),
          path: targetPath,
        });

        processed += 1;
        sendProgress(false);
      }

      const mergedSavedFiles = Array.from(savedFilesByPath.values());

      await fs.promises.writeFile(
        filesJsonPath,
        JSON.stringify({ files: mergedSavedFiles, updatedAt: Date.now() }, null, 2)
      );

      sendProgress(true);
      return { success: true, copiedCount, total };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.on('show-notification', (_event, title, message) => {
    const notification = new Notification({
      title,
      body: message,
      icon: APP_ICON,
    });

    notification.show();
  });

  ipcMain.handle('get-window-settings', async () => {
    if (!mainWindow) return null;

    const bounds = mainWindow.getBounds();
    return {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      trayMode: trayModeEnabled,
    };
  });

  ipcMain.handle('set-window-settings', async (_event, settings) => {
    if (!mainWindow) return { success: false, error: 'Window is not ready' };

    try {
      if (settings.width && settings.height) {
        mainWindow.setSize(Math.max(900, settings.width), Math.max(600, settings.height));
      }

      if (typeof settings.x === 'number' && typeof settings.y === 'number') {
        mainWindow.setPosition(settings.x, settings.y);
      }

      if (typeof settings.trayMode === 'boolean') {
        setTrayModeEnabled(settings.trayMode);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('set-auto-start', async (_event, enabled) => {
    try {
      const autoStartEnabled = Boolean(enabled);
      app.setLoginItemSettings({
        openAtLogin: autoStartEnabled,
        openAsHidden: autoStartEnabled,
        args: autoStartEnabled ? [STARTUP_TRAY_ARG] : [],
      });

      return { success: true, enabled: autoStartEnabled };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('get-auto-start', async () => {
    try {
      const settings = app.getLoginItemSettings();
      const args = Array.isArray(settings.args) ? settings.args : [];
      return {
        success: true,
        enabled: Boolean(settings.openAtLogin),
        startInTray: args.includes(STARTUP_TRAY_ARG),
      };
    } catch (error) {
      return { success: false, enabled: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('set-tray-mode', async (_event, enabled) => {
    try {
      setTrayModeEnabled(enabled);
      return { success: true, enabled: trayModeEnabled };
    } catch (error) {
      return { success: false, enabled: trayModeEnabled, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('get-tray-mode', async () => {
    return { success: true, enabled: trayModeEnabled };
  });

  ipcMain.handle('set-global-hotkeys', async (_event, bindings) => {
    try {
      const result = registerGlobalHotkeys(bindings);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: String(error?.message || error), registered: [], failed: [] };
    }
  });

  ipcMain.handle('get-global-hotkeys', async () => {
    const registered = Array.from(registeredGlobalHotkeys.entries()).map(([action, accelerator]) => ({
      action,
      accelerator,
    }));

    return { success: true, registered };
  });

  ipcMain.handle('export-playlist-archive', async (_event, payload) => {
    return createPlaylistExportArchive(payload);
  });

  ipcMain.handle('preview-playlist-import', async (_event, payload) => {
    return createImportPreview(payload);
  });

  ipcMain.handle('apply-playlist-import', async (_event, token) => {
    return applyImportPreview(String(token || ''));
  });

  ipcMain.handle('discard-playlist-import-preview', async (_event, token) => {
    cleanupImportPreview(String(token || ''));
    return { success: true };
  });

  ipcMain.handle('open-url', async (_event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('resolve-vk-video-url', async (_event, url) => {
    return resolveVkVideoPlaybackUrl(url);
  });

  ipcMain.handle('enter-picture-in-picture', async () => {
    if (!mainWindow) return { success: false, error: 'Window is not ready' };

    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    return { success: true };
  });

  ipcMain.handle('exit-picture-in-picture', async () => {
    if (!mainWindow) return { success: false, error: 'Window is not ready' };

    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    return { success: true };
  });

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (!mainWindow) return;

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    if (trayModeEnabled) {
      hideMainWindowToTray();
      return;
    }

    mainWindow?.close();
  });
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    showMainWindow();
  }

  const files = extractMediaFiles(commandLine);
  if (files.length > 0) {
    queueFilesForOpen(files);
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!filePath || !isValidMediaFile(filePath)) return;

  queueFilesForOpen([filePath]);
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (autoUpdateIntervalRef) {
    clearInterval(autoUpdateIntervalRef);
    autoUpdateIntervalRef = null;
  }
  for (const token of activeImportPreviews.keys()) {
    cleanupImportPreview(token);
  }
  destroyTray();
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.mediaplayer.app');

  try {
    const loginSettings = app.getLoginItemSettings();
    if (loginSettings?.wasOpenedAtLogin) {
      launchToTrayOnStartup = true;
    }
  } catch {
    // noop
  }

  const startupFiles = extractMediaFiles(process.argv);
  if (startupFiles.length > 0) {
    launchToTrayOnStartup = false;
  }

  ensurePlaylistsDirectory();
  setupIpcHandlers();
  createSplashWindow();
  createMainWindow();

  if (trayModeEnabled || launchToTrayOnStartup) {
    createTray();
  }

  if (startupFiles.length > 0) {
    queueFilesForOpen(startupFiles);
  }

  setupAutoUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !trayModeEnabled) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createSplashWindow();
    createMainWindow();
    return;
  }

  showMainWindow();
});

