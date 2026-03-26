function el(id) { return document.getElementById(id) }

function createTrackRow(idx, name = '') {
    const div = document.createElement('div');
    div.className = 'track-item';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Track ${idx+1} title`;
    nameInput.value = name;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => div.remove());
    div.appendChild(nameInput);
    div.appendChild(remove);
    return div;
}

function createDiscElement(discIdx, discName = 'Disc 1', trackNames = []) {
    const disc = document.createElement('div');
    disc.className = 'disc';
    disc.dataset.idx = discIdx;

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.gap = '8px';
    header.style.alignItems = 'center';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = discName;
    nameInput.placeholder = `Disc ${discIdx+1} name`;
    nameInput.className = 'disc-name';

    const addTrackBtn = document.createElement('button');
    addTrackBtn.textContent = 'Add Track';
    addTrackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addTrackToDisc(disc);
    });

    const removeDiscBtn = document.createElement('button');
    removeDiscBtn.textContent = 'Remove Disc';
    removeDiscBtn.addEventListener('click', (e) => {
        e.preventDefault();
        disc.remove();
    });

    header.appendChild(nameInput);
    header.appendChild(addTrackBtn);
    header.appendChild(removeDiscBtn);

    const tracksContainer = document.createElement('div');
    tracksContainer.className = 'tracks-list';
    tracksContainer.dataset.for = 'disc';
    trackNames.forEach((t, i) => tracksContainer.appendChild(createTrackRow(i, t)));

    disc.appendChild(header);
    disc.appendChild(tracksContainer);
    return disc;
}

function getTracksFromContainer(container) {
    const rows = Array.from(container.querySelectorAll('.track-item'));
    return rows.map(r => { const input = r.querySelector('input'); return (input && input.value) ? input.value.trim() : ''; }).filter(t => t);
}

function getDiscs() {
    const discsContainer = el('discs');
    const discEls = Array.from(discsContainer.querySelectorAll('.disc'));
    return discEls.map(d => {
        const nameInput = d.querySelector('.disc-name');
        const tracksContainer = d.querySelector('.tracks-list');
        return { name: (nameInput && nameInput.value) ? nameInput.value.trim() : 'Disc', tracks: getTracksFromContainer(tracksContainer) };
    }).filter(d => d.tracks && d.tracks.length);
}

function renderPreview(obj) {
    const p = el('preview');
    p.innerHTML = '';
    const img = document.createElement('img');
    img.src = obj.cover || '';
    img.alt = obj.title || '';
    img.style.maxWidth = '160px';
    img.style.maxHeight = '160px';
    img.onerror = () => { img.style.display = 'none' };
    const info = document.createElement('div');
    info.innerHTML = `<strong>${obj.title || ''}</strong><div>${obj.artist || ''} • ${obj.year || ''}</div>`;
    p.appendChild(img);
    p.appendChild(info);

    if (obj.discs && obj.discs.length) {
        obj.discs.forEach(d => {
            const h = document.createElement('h4');
            h.textContent = d.name || 'Disc';
            const ol = document.createElement('ol');
            (d.tracks || []).forEach(t => {
                const li = document.createElement('li');
                li.textContent = t;
                ol.appendChild(li);
            });
            p.appendChild(h);
            p.appendChild(ol);
        });
    }
}

function generate() {
    const discs = getDiscs();
    const album = {
        id: nextId(),
        title: el('title').value.trim(),
        artist: el('artist').value.trim(),
        year: el('year').value ? Number(el('year').value) : null,
        cover: el('cover').value.trim(),
        discs: discs.length ? discs : [{ name: 'Disc 1', tracks: [] }]
    };
    const json = JSON.stringify(album, null, 2);
    el('output').value = json;
    el('output-js').value = formatForDataJS(album);
    renderPreview(album);
}

function nextId() {
    try {
        if (Array.isArray(window.albums) && window.albums.length) {
            return Math.max(...window.albums.map(a => a.id || 0)) + 1;
        }
    } catch (e) {}
    return Date.now();
}

function formatForDataJS(album) {
    const id = album.id;
    const title = album.title || '';
    const artist = album.artist || '';
    const year = (album.year === null || album.year === undefined) ? null : album.year;
    const cover = album.cover || '';
    const discs = album.discs || [];

    const lines = [];
    lines.push('{');
    lines.push(`  id: ${id},`);
    lines.push(`  title: ${JSON.stringify(title)},`);
    lines.push(`  artist: ${JSON.stringify(artist)},`);
    lines.push(`  year: ${year === null ? null : year},`);
    lines.push(`  cover: ${JSON.stringify(cover)},`);
    lines.push('  discs: [');
    discs.forEach((d, di) => {
                lines.push('    {');
                lines.push(`      name: ${JSON.stringify(d.name || `Disc ${di+1}`)},`);
        lines.push('      tracks: [');
        (d.tracks || []).forEach((t, ti) => {
            const comma = (ti === (d.tracks.length - 1)) ? '' : ',';
            lines.push(`        ${JSON.stringify(t)}${comma}`);
        });
        lines.push('      ]');
        lines.push(di === discs.length - 1 ? '    }' : '    },');
    });
    lines.push('  ]');
    lines.push('}');
    return lines.join('\n');
}


function copyOutput() {
    const out = el('output-js');
    out.select();
    document.execCommand('copy');
}

function downloadOutput() {
    const blob = new Blob([el('output').value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'album.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function addTrack() {
    const container = el('tracks');
    if (!container) return;
    const idx = container.querySelectorAll('.track-item').length;
    container.appendChild(createTrackRow(idx));
}

function addTrackToDisc(discEl) {
    if (!discEl) return;
    const tracksContainer = discEl.querySelector('.tracks-list');
    if (!tracksContainer) return;
    const idx = tracksContainer.querySelectorAll('.track-item').length;
    tracksContainer.appendChild(createTrackRow(idx));
}

function init() {
    el('generate').addEventListener('click', (e) => {
        e.preventDefault();
        generate();
    });
    el('copy').addEventListener('click', (e) => {
        e.preventDefault();
        copyOutput();
    });
    el('download').addEventListener('click', (e) => { e.preventDefault(); downloadOutput(); });
    const addDiscBtn = el('add-disc');
    if (addDiscBtn) addDiscBtn.addEventListener('click', (e) => { e.preventDefault(); const discs = el('discs'); const idx = discs.querySelectorAll('.disc').length; discs.appendChild(createDiscElement(idx)); });

    const discs = el('discs');
    const first = createDiscElement(0, 'Disc 1', ['Track 1']);
    if (discs) discs.appendChild(first);
}

window.addEventListener('DOMContentLoaded', init);