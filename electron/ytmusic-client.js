/**
 * YouTube Music API Client для UMPlayer
 * Использует пакет ytmusic-api для поиска и воспроизведения музыки
 */

const YTMusic = require('ytmusic-api');

const ytmusic = new YTMusic();

// Инициализация
async function init() {
  try {
    await ytmusic.initialize();
    console.log('[YTMusic] Инициализация успешна');
    return true;
  } catch (error) {
    console.error('[YTMusic] Ошибка инициализации:', error.message);
    return false;
  }
}

// Поиск музыки
async function search(query, limit = 20, filter = 'songs') {
  try {
    console.log(`[YTMusic] Поиск: "${query}" (filter: ${filter}, limit: ${limit})`);
    
    const results = await ytmusic.search(query, {
      type: mapFilter(filter),
      limit: limit
    });

    const tracks = results.map(item => ({
      id: item.id || item.videoId,
      title: item.title || 'Unknown',
      artist: item.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: item.album?.name || null,
      videoId: item.videoId || item.id,
      thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
      duration: formatDuration(item.durationSeconds),
      type: item.type || 'song',
      browseId: item.browseId
    }));

    console.log(`[YTMusic] Найдено треков: ${tracks.length}`);
    return { success: true, tracks };
  } catch (error) {
    console.error('[YTMusic] Search error:', error);
    return { success: false, tracks: [], error: error.message };
  }
}

// Получить информацию о треке
async function getTrackInfo(videoId) {
  try {
    console.log(`[YTMusic] Информация о треке: ${videoId}`);
    
    const info = await ytmusic.getSong(videoId);
    
    return {
      success: true,
      title: info.title || 'Unknown',
      artist: info.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: info.album?.name || null,
      duration: formatDuration(info.durationSeconds),
      thumbnail: info.thumbnails?.[info.thumbnails.length - 1]?.url || '',
      videoId: videoId,
      lyrics: info.lyrics
    };
  } catch (error) {
    console.error('[YTMusic] Track info error:', error);
    return { 
      success: false, 
      title: '', 
      artist: '', 
      album: null, 
      duration: '0:00', 
      thumbnail: '', 
      videoId: videoId, 
      error: error.message 
    };
  }
}

// Получить подсказки для поиска
async function getSearchSuggestions(query) {
  try {
    console.log(`[YTMusic] Подсказки для: "${query}"`);
    
    const suggestions = await ytmusic.getSearchSuggestions(query);
    
    const result = suggestions.map(s => s.text || s).slice(0, 10);
    
    return { success: true, suggestions: result };
  } catch (error) {
    console.error('[YTMusic] Suggestions error:', error);
    return { success: false, suggestions: [], error: error.message };
  }
}

// Получить главную страницу с рекомендациями
async function getHome(limit = 6) {
  try {
    console.log('[YTMusic] Получение главной страницы');
    
    const home = await ytmusic.getHome(limit);
    
    const sections = home.map(section => ({
      title: section.title,
      contents: section.contents?.map(item => ({
        id: item.id || item.videoId,
        title: item.title,
        artist: item.artists?.map(a => a.name).join(', '),
        thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url,
        type: item.type
      }))
    }));
    
    return { success: true, sections };
  } catch (error) {
    console.error('[YTMusic] Home error:', error);
    return { success: false, error: error.message };
  }
}

// Получить чарты
async function getCharts(country = 'US') {
  try {
    console.log(`[YTMusic] Чарты для страны: ${country}`);
    
    const charts = await ytmusic.getCharts(country);
    
    return { success: true, charts };
  } catch (error) {
    console.error('[YTMusic] Charts error:', error);
    return { success: false, error: error.message };
  }
}

// Получить информацию об артисте
async function getArtist(artistId) {
  try {
    console.log(`[YTMusic] Информация об артисте: ${artistId}`);
    
    const artist = await ytmusic.getArtist(artistId);
    
    return { 
      success: true, 
      artist: {
        name: artist.name,
        description: artist.description,
        thumbnails: artist.thumbnails,
        songs: artist.songs?.map(s => ({
          id: s.id || s.videoId,
          title: s.title,
          thumbnail: s.thumbnails?.[0]?.url
        })),
        albums: artist.albums?.map(a => ({
          id: a.id,
          title: a.title,
          year: a.year,
          thumbnail: a.thumbnails?.[0]?.url
        }))
      }
    };
  } catch (error) {
    console.error('[YTMusic] Artist error:', error);
    return { success: false, error: error.message };
  }
}

// Получить информацию об альбоме
async function getAlbum(albumId) {
  try {
    console.log(`[YTMusic] Информация об альбоме: ${albumId}`);
    
    const album = await ytmusic.getAlbum(albumId);
    
    return { 
      success: true, 
      album: {
        title: album.title,
        artist: album.artists?.map(a => a.name).join(', '),
        year: album.year,
        tracks: album.tracks?.map(t => ({
          id: t.id || t.videoId,
          title: t.title,
          artist: t.artists?.map(a => a.name).join(', '),
          duration: formatDuration(t.durationSeconds),
          thumbnail: t.thumbnails?.[0]?.url
        }))
      }
    };
  } catch (error) {
    console.error('[YTMusic] Album error:', error);
    return { success: false, error: error.message };
  }
}

// Получить информацию о плейлисте
async function getPlaylist(playlistId) {
  try {
    console.log(`[YTMusic] Информация о плейлисте: ${playlistId}`);
    
    const playlist = await ytmusic.getPlaylist(playlistId);
    
    return { 
      success: true, 
      playlist: {
        title: playlist.title,
        author: playlist.author?.name,
        trackCount: playlist.trackCount,
        tracks: playlist.tracks?.map(t => ({
          id: t.id || t.videoId,
          title: t.title,
          artist: t.artists?.map(a => a.name).join(', '),
          duration: formatDuration(t.durationSeconds),
          thumbnail: t.thumbnails?.[0]?.url
        }))
      }
    };
  } catch (error) {
    console.error('[YTMusic] Playlist error:', error);
    return { success: false, error: error.message };
  }
}

// Получить текст песни
async function getLyrics(browseId) {
  try {
    console.log(`[YTMusic] Текст песни: ${browseId}`);
    
    const lyrics = await ytmusic.getLyrics(browseId);
    
    return { success: true, lyrics: lyrics?.lyrics || lyrics };
  } catch (error) {
    console.error('[YTMusic] Lyrics error:', error);
    return { success: false, error: error.message };
  }
}

// Вспомогательные функции
function mapFilter(filter) {
  const filterMap = {
    'songs': 'songs',
    'videos': 'videos',
    'albums': 'albums',
    'artists': 'artists',
    'playlists': 'playlists'
  };
  return filterMap[filter] || 'songs';
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Экспорт функций
module.exports = {
  init,
  search,
  getTrackInfo,
  getSearchSuggestions,
  getHome,
  getCharts,
  getArtist,
  getAlbum,
  getPlaylist,
  getLyrics
};
