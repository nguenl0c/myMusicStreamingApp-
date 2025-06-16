class UnifiedTrack {
  constructor({
    id,
    title,
    artist,
    album,
    duration,
    source, // 'spotify' hoặc 'local'
    spotifyId = null,
    spotifyUri = null,
    localId = null,
    localUrl = null,
    albumArt = null,
    addedAt = new Date(),
  }) {
    this.id =
      id || `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.title = title;
    this.artist = artist;
    this.album = album;
    this.duration = duration;
    this.source = source;
    this.spotifyId = spotifyId;
    this.spotifyUri = spotifyUri;
    this.localId = localId;
    this.localUrl = localUrl;
    this.albumArt = albumArt;
    this.addedAt = addedAt;
  }

  static fromSpotifyTrack(spotifyTrack) {
    return new UnifiedTrack({
      title: spotifyTrack.name,
      artist: spotifyTrack.artists?.map((a) => a.name).join(", ") || "Unknown",
      album: spotifyTrack.album?.name || "Unknown",
      duration: spotifyTrack.duration_ms ? spotifyTrack.duration_ms / 1000 : 0,
      source: "spotify",
      spotifyId: spotifyTrack.id,
      spotifyUri: spotifyTrack.uri || `spotify:track:${spotifyTrack.id}`,
      albumArt: spotifyTrack.album?.images?.[0]?.url || null,
    });
  }

  static fromLocalTrack(localTrack) {
    return new UnifiedTrack({
      title: localTrack.title,
      artist: localTrack.artist,
      album: localTrack.album,
      duration: localTrack.duration,
      source: "local",
      localId: localTrack.id,
      localUrl: localTrack.url,
    });
  }

  // Phương thức để chuyển đổi ngược lại
  toPlayableFormat() {
    if (this.source === "spotify") {
      return {
        type: "spotify",
        uri: this.spotifyUri,
        id: this.spotifyId,
      };
    } else {
      return {
        type: "local",
        id: this.localId,
        url: this.localUrl,
      };
    }
  }
}

export default UnifiedTrack;
