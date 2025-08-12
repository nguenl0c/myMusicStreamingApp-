// src/services/unifiedPlaylistManager.js
import { getTrackById } from "./localMusicDB";
import { spotifyApi } from "../spotify";
import UnifiedTrack from '../models/unifiedTrack';

const PLAYLISTS_STORAGE_KEY = "unified_playlists";

class UnifiedPlaylistManager {
  constructor() {
    this.playlists = this.loadPlaylists();
  }

  // Load playlists từ localStorage
  loadPlaylists() {
    const storedData = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (storedData) {
      try {
        return JSON.parse(storedData);
      } catch (e) {
        console.error("Error parsing stored playlists:", e);
      }
    }
    return [];
  }

  // Lưu playlists vào localStorage
  savePlaylists() {
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(this.playlists));
  }

  // Lấy danh sách playlist
  getPlaylists() {
    return this.playlists;
  }

  // Tạo playlist mới
  createPlaylist(name, description = "") {
    const newPlaylist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      tracks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.playlists.push(newPlaylist);
    this.savePlaylists();
    return newPlaylist;
  }

  // Lấy playlist theo ID
  getPlaylist(playlistId) {
    return this.playlists.find((p) => p.id === playlistId);
  }

  // Thêm bài hát từ Spotify vào playlist
  async addSpotifyTrackToPlaylist(playlistId, spotifyTrackId) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return false;

    try {
      // Lấy thông tin bài hát từ Spotify API
      const response = await spotifyApi.request({
        method: "GET",
        url: `https://api.spotify.com/v1/tracks/${spotifyTrackId}`,
      });

      if (!response) throw new Error("Failed to fetch track from Spotify");

      const unifiedTrack = UnifiedTrack.fromSpotifyTrack(response);
      playlist.tracks.push(unifiedTrack);
      playlist.updatedAt = new Date().toISOString();

      this.savePlaylists();
      return true;
    } catch (error) {
      console.error("Error adding Spotify track to playlist:", error);
      return false;
    }
  }

  // Thêm bài hát local vào playlist
  async addLocalTrackToPlaylist(playlistId, localTrackId) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return false;

    try {
      // Lấy thông tin bài hát từ LocalDB
      const localTrack = await getTrackById(localTrackId);
      if (!localTrack) throw new Error("Local track not found");

      const unifiedTrack = UnifiedTrack.fromLocalTrack(localTrack);
      playlist.tracks.push(unifiedTrack);
      playlist.updatedAt = new Date().toISOString();

      this.savePlaylists();
      return true;
    } catch (error) {
      console.error("Error adding local track to playlist:", error);
      return false;
    }
  }

  // Xóa bài hát khỏi playlist
  removeTrackFromPlaylist(playlistId, trackIndex) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return false;

    if (trackIndex >= 0 && trackIndex < playlist.tracks.length) {
      playlist.tracks.splice(trackIndex, 1);
      playlist.updatedAt = new Date().toISOString();
      this.savePlaylists();
      return true;
    }

    return false;
  }

  // Sắp xếp lại playlist
  reorderPlaylist(playlistId, oldIndex, newIndex) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return false;

    if (
      oldIndex >= 0 &&
      oldIndex < playlist.tracks.length &&
      newIndex >= 0 &&
      newIndex < playlist.tracks.length
    ) {
      const [movedTrack] = playlist.tracks.splice(oldIndex, 1);
      playlist.tracks.splice(newIndex, 0, movedTrack);
      playlist.updatedAt = new Date().toISOString();

      this.savePlaylists();
      return true;
    }

    return false;
  }

  // Xóa playlist
  deletePlaylist(playlistId) {
    const index = this.playlists.findIndex((p) => p.id === playlistId);
    if (index === -1) return false;

    this.playlists.splice(index, 1);
    this.savePlaylists();
    return true;
  }

  // Import từ playlist Spotify
  async importFromSpotifyPlaylist(spotifyPlaylistId) {
    try {
      // Lấy thông tin playlist từ Spotify API
      const playlistResponse = await spotifyApi.request({
        method: "GET",
        url: `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}`,
      });

      if (!playlistResponse)
        throw new Error("Failed to fetch playlist from Spotify");

      // Tạo playlist mới
      const newPlaylist = this.createPlaylist(
        `${playlistResponse.name} (Imported)`,
        playlistResponse.description || ""
      );

      // Lấy tất cả các bài hát
      let tracks = playlistResponse.tracks.items;
      let next = playlistResponse.tracks.next;

      // Xử lý phân trang nếu có nhiều bài hát
      while (next) {
        const nextTracksResponse = await spotifyApi.request({
          method: "GET",
          url: next,
        });

        if (!nextTracksResponse) break;

        tracks = [...tracks, ...nextTracksResponse.items];
        next = nextTracksResponse.next;
      }

      // Thêm từng bài hát vào playlist
      newPlaylist.tracks = tracks
        .filter((item) => item.track) // Loại bỏ các item không có track
        .map((item) => UnifiedTrack.fromSpotifyTrack(item.track));

      this.savePlaylists();
      return newPlaylist.id;
    } catch (error) {
      console.error("Error importing Spotify playlist:", error);
      return null;
    }
  }

  // Lấy danh sách bài hát để phát từ playlist
  async getPlayableTracksForPlaylist(playlistId) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return [];

    // Tạo danh sách các bài hát để phát
    const playableTracks = [];

    for (const track of playlist.tracks) {
      if (track.source === "spotify") {
        playableTracks.push({
          type: "spotify",
          uri: track.spotifyUri,
          id: track.spotifyId,
          name: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          image: track.albumArt,
        });
      } else if (track.source === "local") {
        try {
          // Đảm bảo lấy URL mới nhất cho file local
          const localTrack = await getTrackById(track.localId);
          if (localTrack) {
            playableTracks.push({
              type: "local",
              id: track.localId,
              url: localTrack.url, // URL mới
              name: track.title,
              artist: track.artist,
              album: track.album,
              duration: track.duration,
            });
          }
        } catch (error) {
          console.error(`Error fetching local track ${track.localId}:`, error);
        }
      }
    }

    return playableTracks;
  }
}

export default new UnifiedPlaylistManager();
