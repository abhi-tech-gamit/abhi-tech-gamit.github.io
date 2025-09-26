// Utility: fetch JSON file locally (works with file:// if browser allows)
async function fetchJSON(path) {
  // Use relative path from /docs, so always fetch from same dir
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error('Not found');
    return await resp.json();
  } catch {
    // fallback: try XMLHttpRequest (for file://)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.overrideMimeType('application/json');
      xhr.open('GET', path, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 0)
            resolve(JSON.parse(xhr.responseText));
          else reject(xhr.statusText);
        }
      };
      xhr.send(null);
    });
  }
}

// Theme toggle
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.onclick = () => {
    document.body.classList.toggle('light');
    document.body.classList.toggle('dark');
    btn.textContent = document.body.classList.contains('light') ? 'Dark Mode' : 'Light Mode';
  };
}

// Song List page
async function loadSongList() {
  setupThemeToggle();
  const list = document.getElementById('song-list');
  if (!list) return;
  let songs;
  try {
    songs = await fetchJSON('songs.json');
  } catch {
    list.innerHTML = '<li>Unable to load songs.json</li>';
    return;
  }
  list.innerHTML = '';
  songs.forEach(song => {
    const li = document.createElement('li');
    li.textContent = song.title;
    li.onclick = () => {
      window.location.href = `viewer.html?file=${encodeURIComponent(song.filename)}`;
    };
    list.appendChild(li);
  });
}

// Song Viewer page
async function loadViewer() {
  setupThemeToggle();
  // Get filename from URL
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  if (!file) {
    document.getElementById('song-view').textContent = 'No song specified.';
    return;
  }
  let song;
  try {
    song = await fetchJSON(`songs/${file}`);
  } catch {
    document.getElementById('song-view').textContent = 'Error loading song file.';
    return;
  }
  document.getElementById('song-title').textContent = song.title + (song.key ? ` [Key: ${song.key}]` : '');
  let transpose = 0;

  function renderSong() {
    const view = document.getElementById('song-view');
    view.innerHTML = '';
    
    song.lines.forEach(line => {
      // Create a container for the entire line
      const lineDiv = document.createElement('div');
      lineDiv.className = 'song-line';
      
      // Create chord line
      const chordLine = document.createElement('div');
      chordLine.className = 'chords-line';
      
      // Create lyric line
      const lyricLine = document.createElement('div');
      lyricLine.className = 'lyrics-line';
      
      // Build the full lyric text to calculate positions
      let lyricText = '';
      let chordPositions = [];
      
      // Process each word and its chord
      for (let i = 0; i < line.lyrics.length; i++) {
        const word = line.lyrics[i];
        const chord = line.chords[i] ? transposeChord(line.chords[i], transpose) : '';
        
        // Add the word to the lyric text
        if (i > 0) {
          lyricText += ' ';
        }
        lyricText += word;
        
        // If there's a chord, record its position
        if (chord) {
          chordPositions.push({
            chord: chord,
            position: lyricText.length - word.length
          });
        }
      }
      
      // Set the lyric text
      lyricLine.textContent = lyricText;
      
      // Position each chord above its corresponding word
      chordPositions.forEach(chordInfo => {
        const chordSpan = document.createElement('span');
        chordSpan.className = 'chord';
        chordSpan.textContent = chordInfo.chord;
        
        // Calculate position based on character index
        // Using 0.6em as approximate width of a monospace character
        chordSpan.style.left = `${chordInfo.position * 0.6}em`;
        
        chordLine.appendChild(chordSpan);
      });
      
      lineDiv.appendChild(chordLine);
      lineDiv.appendChild(lyricLine);
      view.appendChild(lineDiv);
    });
  }

  // Transpose helpers
  document.getElementById('transpose-up').onclick = () => { transpose++; renderSong(); };
  document.getElementById('transpose-down').onclick = () => { transpose--; renderSong(); };
  renderSong();
}

// Chord transposing logic (basic, supports # and b, ignores extensions)
const CHORDS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_MAP = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
function transposeChord(chord, steps) {
  if (!chord) return '';
  // Match root (C, D, E, F, G, A, B) + optional #/b + rest
  const m = chord.match(/^([A-G])([b#]?)(.*)$/);
  if (!m) return chord;
  let [_, root, accidental, suffix] = m;
  let full = root + accidental;
  // Handle flats
  if (FLAT_MAP[full]) full = FLAT_MAP[full];
  let idx = CHORDS.indexOf(full);
  if (idx === -1) return chord;
  let newIdx = (idx + steps + 12) % 12;
  let newRoot = CHORDS[newIdx];
  return newRoot + suffix;
}
