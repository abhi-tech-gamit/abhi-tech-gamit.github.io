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

// Function to download a song as PDF
async function downloadSongAsPDF(filename, title) {
  try {
    const song = await fetchJSON(`songs/${filename}`);
    generatePDF(song, title, 0); // No transpose when downloading from list
  } catch (error) {
    console.error('Error downloading song:', error);
    alert('Error downloading song. Please try again.');
  }
}

// Function to generate PDF
function generatePDF(song, title, transpose = 0) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text(title, 20, 20);
  
  if (song.key) {
    const transposedKey = transposeChord(song.key, transpose);
    doc.setFontSize(12);
    doc.text(`Key: ${transposedKey}`, 20, 30);
  }
  
  // Add lyrics with chords
  doc.setFontSize(12);
  let yPosition = 40;
  
  song.lines.forEach(line => {
    // Check if we need a new page
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Add chords
    const chordsRow = line.chords.map(chord => chord ? transposeChord(chord, transpose) : '').join('  ');
    if (chordsRow.trim()) {
      doc.setFontSize(10);
      doc.text(chordsRow, 20, yPosition);
      yPosition += 5;
    }
    
    // Add lyrics
    const lyricsRow = line.lyrics.join(' ');
    doc.setFontSize(12);
    doc.text(lyricsRow, 20, yPosition);
    yPosition += 10;
  });
  
  // Save the PDF
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${sanitizedTitle}.pdf`);
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
    
    // Create a container for the song title and download button
    const songContainer = document.createElement('div');
    songContainer.className = 'song-item';
    
    // Create the title element
    const titleElement = document.createElement('span');
    titleElement.className = 'song-title';
    titleElement.textContent = song.title;
    titleElement.onclick = () => {
      window.location.href = `viewer.html?file=${encodeURIComponent(song.filename)}`;
    };
    
    // Create the download button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download PDF';
    downloadBtn.className = 'download-btn';
    downloadBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent triggering the title click
      downloadSongAsPDF(song.filename, song.title);
    };
    
    // Add elements to the container
    songContainer.appendChild(titleElement);
    songContainer.appendChild(downloadBtn);
    
    // Add the container to the list item
    li.appendChild(songContainer);
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
  
  // Store the song data globally for PDF generation
  window.currentSong = song;
  window.currentSongFile = file;
  
  document.getElementById('song-title').textContent = song.title + (song.key ? ` [Key: ${song.key}]` : '');
  let transpose = 0;

  function renderSong() {
    const view = document.getElementById('song-view');
    view.innerHTML = '';
    song.lines.forEach(line => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'lyric-line';

      // Chords above lyrics
      const chordsRow = document.createElement('div');
      chordsRow.className = 'chords-row';
      line.chords.forEach(chord => {
        const transposed = chord ? transposeChord(chord, transpose) : '';
        const chordSpan = document.createElement('span');
        chordSpan.textContent = transposed;
        chordsRow.appendChild(chordSpan);
      });

      const lyricsRow = document.createElement('div');
      lyricsRow.className = 'lyrics-row';
      line.lyrics.forEach(word => {
        const wordSpan = document.createElement('span');
        wordSpan.textContent = word;
        lyricsRow.appendChild(wordSpan);
      });

      lineDiv.appendChild(chordsRow);
      lineDiv.appendChild(lyricsRow);
      view.appendChild(lineDiv);
    });
    
    // Update the global transpose value for PDF generation
    window.currentTranspose = transpose;
  }

  // Transpose helpers
  document.getElementById('transpose-up').onclick = () => { transpose++; renderSong(); };
  document.getElementById('transpose-down').onclick = () => { transpose--; renderSong(); };
  
  // Setup download button if it exists
  const downloadBtn = document.getElementById('download-pdf');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      generatePDFFromViewer();
    };
  }
  
  renderSong();
}

// Function to generate PDF from viewer (with current transpose)
function generatePDFFromViewer() {
  if (window.currentSong) {
    generatePDF(window.currentSong, window.currentSong.title, window.currentTranspose || 0);
  }
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
