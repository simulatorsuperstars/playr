(function () {
  const FEED_LIMIT = 20;
  const SEARCH_LIMIT = 25;
  const FEED_COUNTRY = "us";
  const COVER_SIZE_RX = /\/[0-9]+x[0-9]+bb\./;

  function toCover(url) {
    if (!url || typeof url !== "string") return "";
    return url.replace(COVER_SIZE_RX, "/600x600bb.");
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("API request failed: " + response.status + " " + response.statusText);
    }
    return response.json();
  }

  async function fetchTopAlbums(limit, country) {
    const url = "https://itunes.apple.com/" + country + "/rss/topalbums/limit=" + limit + "/json";
    const payload = await fetchJson(url);
    const entries = (payload && payload.feed && payload.feed.entry) || [];

    return entries.map((entry, index) => {
      const collectionId = entry && entry.id && entry.id.attributes ? Number(entry.id.attributes["im:id"]) : null;
      const title = entry && entry["im:name"] ? entry["im:name"].label : "Unknown Album";
      const artist = entry && entry["im:artist"] ? entry["im:artist"].label : "Unknown Artist";
      const yearLabel = entry && entry["im:releaseDate"] ? entry["im:releaseDate"].label : "";
      const year = yearLabel ? Number(String(yearLabel).slice(0, 4)) : null;
      const images = (entry && entry["im:image"]) || [];
      const cover = images.length ? toCover(images[images.length - 1].label) : "";

      return {
        id: collectionId || index,
        collectionId,
        title,
        artist,
        year,
        cover,
        discs: [{ name: "Disc 1", tracks: [] }]
      };
    });
  }

  function mergeUniqueAlbums(baseAlbums, incomingAlbums) {
    const merged = [];
    const seen = new Set();

    baseAlbums.concat(incomingAlbums).forEach((album) => {
      if (!album || !album.id || seen.has(album.id)) return;
      seen.add(album.id);
      merged.push(album);
    });

    return merged;
  }

  function normalizeSearchAlbum(result) {
    const collectionId = result && result.collectionId ? Number(result.collectionId) : null;
    const yearLabel = result && result.releaseDate ? result.releaseDate : "";

    if (!collectionId) return null;

    return {
      id: collectionId,
      collectionId,
      title: result.collectionName || result.trackName || "Unknown Album",
      artist: result.artistName || "Unknown Artist",
      year: yearLabel ? Number(String(yearLabel).slice(0, 4)) : null,
      cover: toCover(result.artworkUrl100 || result.artworkUrl60 || result.artworkUrl30 || ""),
      discs: [{ name: "Disc 1", tracks: [] }]
    };
  }

  async function fetchSearchAlbums(query, limit) {
    const term = encodeURIComponent(query);
    const albumUrl = "https://itunes.apple.com/search?media=music&entity=album&limit=" + limit + "&term=" + term;
    const songUrl = "https://itunes.apple.com/search?media=music&entity=song&limit=" + limit + "&term=" + term;

    const [albumPayload, songPayload] = await Promise.all([fetchJson(albumUrl), fetchJson(songUrl)]);
    const albumResults = (albumPayload && albumPayload.results) || [];
    const songResults = (songPayload && songPayload.results) || [];

    const uniqueAlbums = mergeUniqueAlbums(
      [],
      albumResults.concat(songResults).map(normalizeSearchAlbum).filter(Boolean)
    ).slice(0, limit);

    return Promise.all(
      uniqueAlbums.map(async (album) => {
        try {
          return await fetchTracksForAlbum(album);
        } catch (error) {
          return album;
        }
      })
    );
  }

  async function fetchTracksForAlbum(album) {
    if (!album.collectionId) return album;

    const lookupUrl = "https://itunes.apple.com/lookup?id=" + album.collectionId + "&entity=song&limit=200";
    const payload = await fetchJson(lookupUrl);
    const results = (payload && payload.results) || [];
    const collection = results.find((item) => item.wrapperType === "collection") || {};
    const yearLabel = collection.releaseDate || "";

    const tracks = results
      .filter((item) => item.wrapperType === "track" && item.kind === "song")
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
      .map((item) => ({
        name: item.trackName,
        previewUrl: item.previewUrl || ""
      }))
      .filter((track) => track.name);

    return {
      id: album.id || album.collectionId,
      collectionId: album.collectionId,
      title: album.title || collection.collectionName || "Unknown Album",
      artist: album.artist || collection.artistName || "Unknown Artist",
      year: album.year || (yearLabel ? Number(String(yearLabel).slice(0, 4)) : null),
      cover: album.cover || toCover(collection.artworkUrl100 || collection.artworkUrl60 || collection.artworkUrl30 || ""),
      discs: [{ name: "Disc 1", tracks }]
    };
  }

  async function loadAlbumsFromApi() {
    const topAlbums = await fetchTopAlbums(FEED_LIMIT, FEED_COUNTRY);

    const withTracks = await Promise.all(
      topAlbums.map(async (album) => {
        try {
          return await fetchTracksForAlbum(album);
        } catch (error) {
          return {
            id: album.id,
            collectionId: album.collectionId,
            title: album.title,
            artist: album.artist,
            year: album.year,
            cover: album.cover,
            discs: [{ name: "Disc 1", tracks: [] }]
          };
        }
      })
    );

    return withTracks;
  }

  const state = {
    albums: [],
    topAlbums: [],
    ready: null,
    error: null,
    searchCache: new Map(),
    searchSequence: 0
  };

  state.searchAlbums = async (query) => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const searchSequence = ++state.searchSequence;

    if (!normalizedQuery) {
      const topAlbums = state.topAlbums.slice();

      if (searchSequence === state.searchSequence) {
        state.albums = topAlbums;
        window.albums = topAlbums;
      }

      return topAlbums;
    }

    if (!state.searchCache.has(normalizedQuery)) {
      state.searchCache.set(
        normalizedQuery,
        fetchSearchAlbums(normalizedQuery, SEARCH_LIMIT).catch(() => [])
      );
    }

    const searchAlbums = await state.searchCache.get(normalizedQuery);
    const mergedAlbums = mergeUniqueAlbums(state.topAlbums, searchAlbums);

    if (searchSequence === state.searchSequence) {
      state.albums = mergedAlbums;
      window.albums = mergedAlbums;
    }

    return mergedAlbums;
  };

  state.fetchAlbumById = async (albumId) => {
    const numericAlbumId = Number(albumId);
    if (!numericAlbumId) return null;

    const existingAlbum = state.albums.find((album) => album.id === numericAlbumId)
      || state.topAlbums.find((album) => album.id === numericAlbumId);

    if (existingAlbum && existingAlbum.discs && existingAlbum.discs.some((disc) => disc.tracks.length)) {
      return existingAlbum;
    }

    const fetchedAlbum = await fetchTracksForAlbum({
      id: numericAlbumId,
      collectionId: numericAlbumId,
      title: existingAlbum ? existingAlbum.title : "",
      artist: existingAlbum ? existingAlbum.artist : "",
      year: existingAlbum ? existingAlbum.year : null,
      cover: existingAlbum ? existingAlbum.cover : "",
      discs: [{ name: "Disc 1", tracks: [] }]
    });

    state.albums = mergeUniqueAlbums(state.albums, [fetchedAlbum]);
    window.albums = state.albums;

    return fetchedAlbum;
  };

  state.ready = loadAlbumsFromApi()
    .then((albums) => {
      state.topAlbums = albums;
      state.albums = albums.slice();
      window.albums = state.albums;
      return state.albums;
    })
    .catch((error) => {
      state.error = error;
      state.topAlbums = Array.isArray(window.albums) ? window.albums : [];
      state.albums = state.topAlbums.slice();
      return state.albums;
    });

  window.playrData = state;
})();
