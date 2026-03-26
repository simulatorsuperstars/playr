let albums = [];

class DialogManager {
  constructor() {
    this.modal = document.getElementById('dialog-modal');
    this.titleEl = document.getElementById('dialog-title');
    this.messageEl = document.getElementById('dialog-message');
    this.cancelBtn = document.getElementById('dialog-cancel');
    this.confirmBtn = document.getElementById('dialog-confirm');
    this.resolve = null;

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.close(false));
    }
    if (this.confirmBtn) {
      this.confirmBtn.addEventListener('click', () => this.close(true));
    }

    const backdrop = this.modal ? document.body.querySelector('.dialog-backdrop') : null;
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close(false));
    }
  }

  show(title, message) {
    if (!this.modal || !this.titleEl || !this.messageEl || !this.confirmBtn) {
      return Promise.resolve(window.confirm(message));
    }

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.titleEl.textContent = title;
      this.messageEl.textContent = message;
      this.modal.classList.remove('hidden');
      this.confirmBtn.focus();
    });
  }

  close(result) {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }
}

const dialogManager = new DialogManager();
const grid = document.getElementById("album-grid");
const page = document.getElementById("album-page");
const searchInput = document.getElementById("search");
const toggle = document.getElementById("theme-toggle");
let activePreviewTrackKey = null;

class PreviewPlayer {
  constructor() {
    this.modal = document.getElementById("preview-modal");
    this.audio = document.getElementById("preview-audio");
    this.cover = document.getElementById("preview-cover");
    this.titleEl = document.getElementById("preview-track-title");
    this.subtitleEl = document.getElementById("preview-track-subtitle");
    this.closeBtn = document.getElementById("preview-close");

    if (!this.modal || !this.audio) return;

    const backdrop = this.modal.querySelector(".preview-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => this.close());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }

    this.audio.addEventListener("pause", () => syncPreviewButtons());
    this.audio.addEventListener("play", () => syncPreviewButtons());
    this.audio.addEventListener("ended", () => {
      activePreviewTrackKey = null;
      syncPreviewButtons();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen()) {
        this.close();
      }
    });
  }

  isOpen() {
    return !!this.modal && !this.modal.classList.contains("hidden");
  }

  async open(track) {
    if (!this.modal || !this.audio) return;

    this.titleEl.textContent = track.name;
    this.subtitleEl.textContent = track.artist + " • " + track.album;
    this.audio.src = track.previewUrl;
    this.audio.currentTime = 0;
    this.cover.src = track.cover || "";
    this.cover.style.display = track.cover ? "block" : "none";
    this.cover.alt = track.album ? track.album + " cover" : "Album cover";
    this.modal.classList.remove("hidden");
    this.modal.setAttribute("aria-hidden", "false");
    activePreviewTrackKey = track.key;

    try {
      await this.audio.play();
    } catch (error) {
      activePreviewTrackKey = null;
    }

    syncPreviewButtons();
  }

  close() {
    if (!this.modal || !this.audio) return;

    this.audio.pause();
    this.audio.currentTime = 0;
    this.modal.classList.add("hidden");
    this.modal.setAttribute("aria-hidden", "true");
    activePreviewTrackKey = null;
    syncPreviewButtons();
  }

  isActiveTrack(trackKey) {
    return this.isOpen() && activePreviewTrackKey === trackKey && this.audio && !this.audio.paused;
  }
}

const previewPlayer = new PreviewPlayer();

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");

  if (toggle) {
    toggle.innerHTML = dark
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  }
}

const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
setTheme(savedTheme ? savedTheme === "dark" : prefersDark);

const mql = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
if (mql && !localStorage.getItem("theme")) {
  const applyPref = (e) => setTheme(e.matches);
  if (mql.addEventListener) mql.addEventListener("change", applyPref);
  else mql.addListener(applyPref);
}

if (toggle) {
  toggle.addEventListener("click", () => {
    setTheme(!document.body.classList.contains("dark"));
  });
}

let searchTimer = null;
let activeSearchRequest = 0;

async function syncSearchResults(searchQuery, requestId) {
  if (!window.playrData || typeof window.playrData.searchAlbums !== "function") {
    render(searchQuery);
    return;
  }

  const query = searchQuery.trim();

  if (grid && query) {
    grid.innerHTML = '<p style="opacity:.7">Searching...</p>';
  }

  const nextAlbums = await window.playrData.searchAlbums(searchQuery);
  if (requestId !== activeSearchRequest) return;

  albums = Array.isArray(nextAlbums) ? nextAlbums : [];
  render(searchQuery);
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const value = e.target.value;
    const requestId = ++activeSearchRequest;

    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }

    searchTimer = window.setTimeout(() => {
      syncSearchResults(value, requestId);
    }, 250);
  });
}

function getRating(key) {
  return parseFloat(localStorage.getItem(key)) || 0;
}

function getTrackName(track) {
  if (typeof track === "string") return track;
  if (track && typeof track.name === "string") return track.name;
  return "Unknown Track";
}

function getTrackPreviewUrl(track) {
  if (!track || typeof track === "string") return "";
  return typeof track.previewUrl === "string" ? track.previewUrl : "";
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function syncPreviewButtons() {
  document.querySelectorAll(".preview-btn").forEach((button) => {
    const isPlaying = previewPlayer.isActiveTrack(button.dataset.trackKey);

    button.classList.toggle("is-playing", isPlaying);
    button.setAttribute("aria-label", isPlaying ? "Preview playing" : "Open preview player");
    button.innerHTML = isPlaying
      ? '<i class="fa-solid fa-wave-square"></i>'
      : '<i class="fa-solid fa-play"></i>';
  });
}

async function openTrackPreview(trackKey, button) {
  if (!button) return;

  const previewUrl = button.dataset.previewUrl;
  if (!previewUrl) return;

  await previewPlayer.open({
    key: trackKey,
    name: button.dataset.trackName || "Unknown Track",
    artist: button.dataset.trackArtist || "Unknown Artist",
    album: button.dataset.trackAlbum || "",
    cover: button.dataset.trackCover || "",
    previewUrl
  });
}

function saveRating(key, value) {
  localStorage.setItem(key, value);
  render();
}

function isInterlude(key) {
  return localStorage.getItem("interlude_" + key) === "true";
}

function toggleInterlude(key) {
  const current = isInterlude(key);
  localStorage.setItem("interlude_" + key, !current);
  render();
}

function getAlbumScore(album) {
  if (!album || !album.discs) return 0;

  const scores = [];
  album.discs.forEach((disc, discIndex) => {
    disc.tracks.forEach((_, trackIndex) => {
      const key = `track_${album.id}_${discIndex}_${trackIndex}`;
      if (isInterlude(key)) return;

      const rating = getRating(key);
      if (rating > 0) scores.push(rating);
    });
  });

  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function resetAlbumRating(albumId) {
  dialogManager.show('Reset Ratings', 'Reset all ratings for this album?').then((confirmed) => {
    if (!confirmed) return;

    const album = albums.find((a) => a.id == albumId);
    if (!album) return;

    album.discs.forEach((disc, d) => {
      disc.tracks.forEach((_, t) => {
        const key = `track_${albumId}_${d}_${t}`;
        localStorage.removeItem(key);
        localStorage.removeItem('interlude_' + key);
      });
    });

    render();
  });
}

function generateStars(key, rating, readonly = false) {
  const wrapperClass = `stars${readonly ? ' readonly' : ''}`;
  let html = `<div class="${wrapperClass}">`;

  for (let i = 1; i <= 5; i++) {
    const full = rating >= i;
    const half = rating >= i - 0.5 && rating < i;

    let icon;
    if (full) icon = '<i class="fa-solid fa-star"></i>';
    else if (half) icon = '<i class="fa-solid fa-star-half-stroke"></i>';
    else icon = '<i class="fa-regular fa-star"></i>';

    html += `<span class="star">${icon}`;

    if (!readonly) {
      html += `<button class="hit" onclick="saveRating('${key}', ${i - 0.5})" aria-label="rate ${i - 0.5}"></button>`;
      html += `<button class="hit right" onclick="saveRating('${key}', ${i})" aria-label="rate ${i}"></button>`;
    }

    html += '</span>';
  }

  html += '</div>';
  return html;
}

function getAlbumStats(album) {
  let total = 0;
  let count = 0;

  album.discs.forEach((disc, d) => {
    disc.tracks.forEach((_, t) => {
      const key = `track_${album.id}_${d}_${t}`;
      if (isInterlude(key)) return;

      const rating = getRating(key);
      if (rating > 0) {
        total += rating;
        count++;
      }
    });
  });

  return { avg: count ? total / count : 0, count };
}

function highlightMatch(text, query) {
  const q = query.trim();
  if (!q) return text;

  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;

  return text.slice(0, index) + `<mark>${text.slice(index, index + q.length)}</mark>` + text.slice(index + q.length);
}

function getTruncatedTrackHtml(trackName) {
  const maxLength = 35;
  if (trackName.length > maxLength) {
    return `<span class="track-title truncated" data-full-title="${escapeAttribute(trackName)}">${trackName}</span>`;
  }
  return `<span class="track-title">${trackName}</span>`;
}

function render(searchQuery = searchInput ? searchInput.value : "") {
  const query = searchQuery.trim().toLowerCase();

  if (grid) {
    grid.innerHTML = "";

    albums.forEach((album) => {
      let matchLabel = "";

      const albumTitleMatch = album.title.toLowerCase().includes(query);
      const artistMatch = album.artist.toLowerCase().includes(query);

      if (albumTitleMatch) {
        matchLabel = "Matched album title";
      } else if (artistMatch) {
        matchLabel = "Matched artist";
      } else {
        for (let d = 0; d < album.discs.length; d++) {
          for (let t = 0; t < album.discs[d].tracks.length; t++) {
            const track = album.discs[d].tracks[t];
            const trackName = getTrackName(track);
            const key = `track_${album.id}_${d}_${t}`;
            if (isInterlude(key)) continue;

            if (trackName.toLowerCase().includes(query)) {
              matchLabel = `Matched track: "${trackName}"`;
              break;
            }
          }
          if (matchLabel) break;
        }
      }

      if (query && !matchLabel) return;

      const rating = getAlbumScore(album);
      const div = document.createElement("div");
      div.className = "album-card";
      div.innerHTML = `
    <img src="${album.cover}">
    <h3>${query ? highlightMatch(album.title, searchQuery) : album.title}</h3>
    <p>${query ? highlightMatch(album.artist, searchQuery) : album.artist}</p>

    ${query && matchLabel ? `<div class="match-label">${matchLabel}</div>` : ""}

    <div class="score">
      ${rating ? generateStars("album_display_" + album.id, rating, true) : "Not rated"}
    </div>

    <a class="open-btn" href="album.html?id=${album.id}">Open</a>
    `;

      grid.appendChild(div);
    });
  }

  if (page) {
    const id = new URLSearchParams(window.location.search).get("id");
    const album = albums.find((a) => a.id == id);

    if (!album) {
      page.innerHTML = '<p style="opacity:.7">Album not found.</p>';
      return;
    }

    const rating = getAlbumScore(album);

    page.innerHTML = `
    <div class="album-view">
    <div class="album-hero">
      <img src="${album.cover}">

      <div class="album-right">
      <div class="album-meta">
        <h2>${album.title}</h2>
        <p>${album.artist} • ${album.year || ""}</p>

        <div class="album-rating">
        <h3>Album Rating</h3>
        <div class="stars readonly">
          ${generateStars("album_display_" + album.id, rating)}
          </div>

          <button class="reset-rating" onclick="resetAlbumRating('${album.id}')" aria-label="Reset ratings">
          <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
        </div>
      </div>
    </div>

    <h3>Tracks</h3>
    <div class="tracklist">
      ${
      album.discs.length === 1
        ? album.discs[0].tracks.map((track, trackIndex) => {
          const trackName = getTrackName(track);
          const previewUrl = getTrackPreviewUrl(track);
          const key = `track_${album.id}_0_${trackIndex}`;
          const blocked = isInterlude(key);

          return `
          <div class="track ${blocked ? "is-interlude" : ""}">
            ${getTruncatedTrackHtml(trackName)}
            <div class="track-actions">
              ${blocked ? "" : generateStars(key, getRating(key))}
              ${previewUrl ? `<button class="preview-btn" data-track-key="${key}" data-preview-url="${escapeAttribute(previewUrl)}" data-track-name="${escapeAttribute(trackName)}" data-track-artist="${escapeAttribute(album.artist)}" data-track-album="${escapeAttribute(album.title)}" data-track-cover="${escapeAttribute(album.cover)}" aria-label="Open preview player" onclick="openTrackPreview('${key}', this)"><i class="fa-solid fa-play"></i></button>` : ""}
              <button class="interlude-toggle" onclick="toggleInterlude('${key}')">
              <i class="fa-solid fa-ban"></i>
              </button>
            </div>
          </div>
          `;
        }).join("")
        : album.discs.map((disc, discIndex) => `
          <div class="disc">
          <h4>${disc.name}</h4>
          <div class="tracklist">
            ${disc.tracks.map((track, trackIndex) => {
            const trackName = getTrackName(track);
            const previewUrl = getTrackPreviewUrl(track);
            const key = `track_${album.id}_${discIndex}_${trackIndex}`;
            const blocked = isInterlude(key);

            return `
              <div class="track ${blocked ? "is-interlude" : ""}">
              ${getTruncatedTrackHtml(trackName)}
              <div class="track-actions">
                ${blocked ? "" : generateStars(key, getRating(key))}
                ${previewUrl ? `<button class="preview-btn" data-track-key="${key}" data-preview-url="${escapeAttribute(previewUrl)}" data-track-name="${escapeAttribute(trackName)}" data-track-artist="${escapeAttribute(album.artist)}" data-track-album="${escapeAttribute(album.title)}" data-track-cover="${escapeAttribute(album.cover)}" aria-label="Open preview player" onclick="openTrackPreview('${key}', this)"><i class="fa-solid fa-play"></i></button>` : ""}
                <button class="interlude-toggle" onclick="toggleInterlude('${key}')">
                  <i class="fa-solid fa-ban"></i>
                </button>
              </div>
              </div>
            `;
            }).join("")}
          </div>
          </div>
        `).join("")
      }
    </div>
    </div>
  `;
  }

  syncPreviewButtons();
}

async function ensureAlbumsLoaded() {
  if (window.playrData && window.playrData.ready) {
    await window.playrData.ready;
    albums = Array.isArray(window.playrData.albums) ? window.playrData.albums : [];
    return;
  }

  albums = Array.isArray(window.albums) ? window.albums : [];
}

async function ensurePageAlbumLoaded() {
  if (!page || !window.playrData || typeof window.playrData.fetchAlbumById !== "function") {
    return;
  }

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id || albums.some((album) => album.id == id)) {
    return;
  }

  const album = await window.playrData.fetchAlbumById(id);
  if (!album || albums.some((existingAlbum) => existingAlbum.id === album.id)) {
    return;
  }

  albums = albums.concat(album);
}

async function initPlayr() {
  await ensureAlbumsLoaded();
  await ensurePageAlbumLoaded();
  render();
  syncPreviewButtons();
}

window.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(() => {
    document.body.classList.add("page-enter");
  });
});

document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link || link.target === "_blank") return;
  if (!link.href || link.origin !== location.origin) return;

  e.preventDefault();
  document.body.classList.add("page-exit");
  setTimeout(() => {
    window.location.href = link.href;
  }, 250);
});

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initPlayr);
} else {
  initPlayr();
}