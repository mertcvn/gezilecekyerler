// ==================== GLOBAL DEĞİŞKENLER ====================
let map = L.map('map').setView([41.0082, 28.9784], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

let placesData = [];
let markersLayer = L.layerGroup().addTo(map);
let currentResults = [];
let userCoords = null;

// ==================== DOM ELEMANLARI ====================
const locationInput = document.getElementById('locationInput');
const searchBtn = document.getElementById('searchBtn');
const btnText = document.querySelector('.btn-text');
const spinner = document.querySelector('.spinner');
const gpsBtn = document.getElementById('gpsBtn');
const themeToggle = document.getElementById('themeToggle');
const categoryFilter = document.getElementById('categoryFilter');
const sortBy = document.getElementById('sortBy');
const fullscreenMapBtn = document.getElementById('fullscreenMapBtn');
const closeFullscreen = document.getElementById('closeFullscreen');
const contentGrid = document.getElementById('contentGrid');
const placesList = document.getElementById('placesList');
const historyTags = document.getElementById('historyTags');
const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');

// ==================== TEMA YÖNETİMİ ====================
function initTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
}
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});
initTheme();

// ==================== VERİ YÜKLEME ====================
fetch('data/places.json')
  .then(res => res.json())
  .then(data => placesData = data)
  .catch(() => placesData = []);

// ==================== MESAFE HESAPLAMA ====================
function toRad(deg) { return deg * (Math.PI / 180); }
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==================== GEOCODE (NOMINATIM) ====================
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', İstanbul, Türkiye')}&limit=5`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'tr' } });
  return await res.json();
}

// ==================== ARAMA GEÇMİŞİ ====================
function getHistory() {
  try { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch { return []; }
}
function addToHistory(query) {
  let history = getHistory();
  history = [query, ...history.filter(h => h !== query)].slice(0, 5);
  localStorage.setItem('searchHistory', JSON.stringify(history));
  renderHistory();
}
function renderHistory() {
  const history = getHistory();
  historyTags.innerHTML = history.map(h => `<span class="history-tag" data-query="${h}">${h}</span>`).join('');
  document.querySelectorAll('.history-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      locationInput.value = tag.dataset.query;
      performSearch();
    });
  });
}
renderHistory();

// ==================== GPS ====================
gpsBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tarayıcınız GPS desteklemiyor.');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    userCoords = { lat: latitude, lng: longitude };
    map.setView([latitude, longitude], 14);
    L.marker([latitude, longitude], {
      icon: L.divIcon({ className: 'gps-marker', html: '<div style="background:#2563eb; width:14px; height:14px; border-radius:50%; border:2px solid white;"></div>', iconSize: [18,18], iconAnchor: [9,9] })
    }).addTo(map).bindPopup('Konumunuz').openPopup();
    searchByCoords(latitude, longitude);
  }, () => alert('Konum alınamadı.'));
});

// ==================== ANA ARAMA FONKSİYONU ====================
async function performSearch() {
  const query = locationInput.value.trim();
  if (!query) return;
  btnText.classList.add('hidden');
  spinner.classList.remove('hidden');
  searchBtn.disabled = true;

  const results = await geocode(query);
  if (results.length === 0) {
    alert('Konum bulunamadı.');
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
    searchBtn.disabled = false;
    return;
  }

  const { lat, lon, display_name } = results[0];
  userCoords = { lat: parseFloat(lat), lng: parseFloat(lon) };
  map.setView([userCoords.lat, userCoords.lng], 13);
  addToHistory(query);
  searchByCoords(userCoords.lat, userCoords.lng);

  btnText.classList.remove('hidden');
  spinner.classList.add('hidden');
  searchBtn.disabled = false;
}

function searchByCoords(lat, lng) {
  if (!placesData.length) return;
  const withDist = placesData.map(p => ({ ...p, distance: calculateDistance(lat, lng, p.lat, p.lng) }));
  currentResults = withDist;
  applyFiltersAndRender();
}

searchBtn.addEventListener('click', performSearch);
locationInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });

// ==================== FİLTRELEME & SIRALAMA & RENDER ====================
function applyFiltersAndRender() {
  let filtered = [...currentResults];
  const cat = categoryFilter.value;
  if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);
  if (sortBy.value === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name, 'tr'));
  else filtered.sort((a,b) => a.distance - b.distance);

  const closest = filtered.slice(0, 12);
  renderMarkers(closest);
  renderList(closest);
}

categoryFilter.addEventListener('change', applyFiltersAndRender);
sortBy.addEventListener('change', applyFiltersAndRender);

// ==================== HARİTA MARKER'LARI ====================
function renderMarkers(places) {
  markersLayer.clearLayers();
  places.forEach((place, i) => {
    const marker = L.marker([place.lat, place.lng])
      .addTo(markersLayer)
      .bindPopup(`<b>${i+1}. ${place.name}</b><br>${place.district}/${place.neighborhood}<br>${place.distance.toFixed(1)} km`);
    marker.on('click', () => openDetailModal(place));
  });
}

// ==================== LİSTE RENDER ====================
function renderList(places) {
  if (!places.length) {
    placesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Filtreye uygun mekan bulunamadı.</p></div>`;
    return;
  }
  placesList.innerHTML = places.map((p, i) => `
    <div class="place-card" data-id="${p.id}">
      <h3>${i+1}. ${p.name}</h3>
      <span class="category-badge">${p.category}</span>
      <p style="font-size:0.9rem; color:var(--text-secondary);">${p.district} / ${p.neighborhood}</p>
      <p class="distance">📍 ${p.distance.toFixed(1)} km</p>
    </div>
  `).join('');

  document.querySelectorAll('.place-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const place = currentResults.find(p => p.id === id);
      if (place) openDetailModal(place);
    });
  });
}

// ==================== DETAY MODAL ====================
function openDetailModal(place) {
  document.getElementById('modalImage').src = place.imageUrl || 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=500&h=300&fit=crop';
  document.getElementById('modalName').textContent = place.name;
  document.getElementById('modalCategory').textContent = place.category;
  document.getElementById('modalDescription').textContent = place.description || 'Açıklama bulunmuyor.';
  document.getElementById('modalDistrict').textContent = `${place.district} / ${place.neighborhood}`;
  document.getElementById('modalDistance').textContent = `📍 ${place.distance.toFixed(1)} km`;
  document.getElementById('modalDirections').href = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  detailModal.classList.remove('hidden');
}
closeModal.addEventListener('click', () => detailModal.classList.add('hidden'));
detailModal.addEventListener('click', e => { if (e.target === detailModal) detailModal.classList.add('hidden'); });

// ==================== TAM EKRAN HARİTA ====================
fullscreenMapBtn.addEventListener('click', () => {
  contentGrid.classList.add('fullscreen-map');
  closeFullscreen.classList.remove('hidden');
  map.invalidateSize();
});
closeFullscreen.addEventListener('click', () => {
  contentGrid.classList.remove('fullscreen-map');
  closeFullscreen.classList.add('hidden');
  map.invalidateSize();
});
