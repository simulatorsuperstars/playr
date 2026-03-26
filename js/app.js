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
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.titleEl.textContent = title;
            this.messageEl.textContent = message;
            this.modal.classList.remove('hidden');
            this.confirmBtn.focus();
        });
    }

    close(result) {
        this.modal.classList.add('hidden');
        if (this.resolve) {
            this.resolve(result);
            this.resolve = null;
        }
    }
}

const dialogManager = new DialogManager();

function userKey(key) {
    return `user_${currentUser}_${key}`;
}

function getRating(key) {
    return parseFloat(localStorage.getItem(userKey(key))) || 0;
}

function saveRating(key, value) {
    localStorage.setItem(userKey(key), value);
    render();
}

function isInterlude(key) {
    return localStorage.getItem(userKey("interlude_" + key)) === "true";
}

function toggleInterlude(key) {
    const fullKey = userKey("interlude_" + key);
    localStorage.setItem(fullKey, !isInterlude(key));
    render();
}

const grid = document.getElementById("album-grid");
const page = document.getElementById("album-page");
const searchInput = document.getElementById("search");
const toggle = document.getElementById("theme-toggle");

function setTheme(dark) {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");

    if (toggle) {
        toggle.innerHTML = dark ?
            `<i class="fa-solid fa-sun"></i>` :
            `<i class="fa-solid fa-moon"></i>`;
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

if (searchInput) {
    let last = "";
    searchInput.addEventListener("input", e => {
        if (e.target.value !== last) {
            last = e.target.value;
            render(last);
        }
    });
}

function getRating(key) {
    return parseFloat(localStorage.getItem(key)) || 0;
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
    let scores = [];

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
    dialogManager.show('Reset Ratings', 'Reset all ratings for this album?').then(confirmed => {
        if (!confirmed) return;

        const album = albums.find(a => a.id == albumId);
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

        html += `</span>`;
    }

    html += `</div>`;
    return html;
}

function getAlbumStats(album) {
    let total = 0;
    let count = 0;

    album.discs.forEach((disc, d) => {
        disc.tracks.forEach((_, t) => {
            const key = `track_${album.id}_${d}_${t}`;
            if (isInterlude(key)) return;

            const r = getRating(key);
            if (r > 0) {
                total += r;
                count++;
            }
        });
    });

    return {
        avg: count ? (total / count) : 0,
        count
    };
}

function highlightMatch(text, query) {
    const q = query.trim();
    if (!q) return text;

    const index = text.toLowerCase().indexOf(q.toLowerCase());
    if (index === -1) return text;

    return (
        text.slice(0, index) +
        `<mark>${text.slice(index, index + q.length)}</mark>` +
        text.slice(index + q.length)
    );
}

function getTruncatedTrackHtml(trackName) {
    const maxLength = 35;
    if (trackName.length > maxLength) {
        return `<span class="track-title truncated" data-full-title="${trackName.replace(/"/g, '&quot;')}">${trackName}</span>`;
    }
    return `<span class="track-title">${trackName}</span>`;
}

function render(searchQuery = "") {
    const query = searchQuery.trim().toLowerCase();

    if (grid) {
        grid.innerHTML = "";

        albums.forEach(album => {
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
                                const key = `track_${album.id}_${d}_${t}`;

                                if (isInterlude(key)) continue;

                                if (track.toLowerCase().includes(query)) {
                                    matchLabel = `Matched track: “${track}”`;
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
    const album = albums.find(a => a.id == id);
    const rating = getAlbumScore(album);

    page.innerHTML = `
      <div class="album-view">
        <div class="album-hero">
          <img src="${album.cover}">

          <div class="album-right">
            <div class="album-meta">
              <h2>${album.title}</h2>
              <p>${album.artist} • ${album.year}</p>

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
                  const key = `track_${album.id}_0_${trackIndex}`;
                  const blocked = isInterlude(key);

                  return `
                    <div class="track ${blocked ? "is-interlude" : ""}">
                      ${getTruncatedTrackHtml(track)}
                      ${blocked ? "" : generateStars(key, getRating(key))}
                      <button class="interlude-toggle" onclick="toggleInterlude('${key}')">
                        <i class="fa-solid fa-ban"></i>
                      </button>
                    </div>
                  `;
                }).join("")
              : album.discs.map((disc, discIndex) => `
                  <div class="disc">
                    <h4>${disc.name}</h4>
                    <div class="tracklist">
                      ${disc.tracks.map((track, trackIndex) => {
                        const key = `track_${album.id}_${discIndex}_${trackIndex}`;
                        const blocked = isInterlude(key);

                        return `
                          <div class="track ${blocked ? "is-interlude" : ""}">
                            ${getTruncatedTrackHtml(track)}
                            ${blocked ? "" : generateStars(key, getRating(key))}
                            <button class="interlude-toggle" onclick="toggleInterlude('${key}')">
                              <i class="fa-solid fa-ban"></i>
                            </button>
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
}

window.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(() => {
    document.body.classList.add("page-enter");
  });
});

document.addEventListener("click", e => {
  const link = e.target.closest("a");

  if (!link || link.target === "_blank") return;
  if (!link.href || link.origin !== location.origin) return;

  e.preventDefault();

  document.body.classList.add("page-exit");

  setTimeout(() => {
    window.location.href = link.href;
  }, 250);
});

render();