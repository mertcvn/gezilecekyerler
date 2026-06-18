class IstanbulNearbyPlaces {
  constructor() {
    this.map = null;
    this.markerClusterGroup = null;
    this.placesData = [];
    this.currentResults = [];
    this.userCoords = null;
    this.abortController = null;

    // DOM elements
    this.elements = {
      locationInput: document.getElementById('locationInput'),
      searchBtn: document.getElementById('searchBtn'),
      btnText: document.querySelector('.btn-text'),
      spinner: document.querySelector('.spinner'),
      gpsBtn: document.getElementById('gpsBtn'),
      themeToggle: document.getElementById('themeToggle'),
      categoryFilter: document.getElementById('categoryFilter'),
      sortBy: document.getElementById('sortBy'),
      fullscreenMapBtn: document.getElementById('fullscreenMapBtn'),
      closeFullscreen: document.getElementById('closeFullscreen'),
      contentGrid: document.getElementById('contentGrid'),
      placesList: document.getElementById('placesList'),
      historyTags: document.getElementById('historyTags'),
      detailModal: document.getElementById('detailModal'),
      closeModal: document.getElementById('closeModal'),
      toast: document.getElementById('toast')
    };

    this.init();
  }

  async init() {
    this.initMap();
    this.initTheme();
    this.bindEvents();
    await this.loadPlaces();
    this.renderHistory();
  }

  initMap() {
    this.map = L.map('map', { attributionControl: true, zoomControl: true }).setView([41.0082, 28.9784], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);
    this.markerClusterGroup = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 });
    this.map.addLayer(this.markerClusterGroup);
  }

  initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark', isDark);
    this.updateThemeIcon(isDark);
  }

  updateThemeIcon(isDark) {
    this.elements.themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }

  bindEvents() {
    this.elements.searchBtn.addEventListener('click', () => this.performSearch());
    this.elements.locationInput.addEventListener('keypress', e => { if (e.key === 'Enter') this.performSearch(); });
    this.elements.gpsBtn.addEventListener('click', () => this.useGPS());
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.elements.categoryFilter.addEventListener('change', () => this.applyFiltersAndRender());
    this.elements.sortBy.addEventListener('change', () => this.applyFiltersAndRender());
    this.elements.fullscreenMapBtn.addEventListener('click', () => this.toggleFullscreen(true));
    this.elements.closeFullscreen.addEventListener('click', () => this.toggleFullscreen(false));
    this.elements.closeModal.addEventListener('click', () => this.closeModal());
    this.elements.detailModal.addEventListener('click', e => { if (e.target === this.elements.detailModal) this.closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeModal(); });
  }

  async loadPlaces() {
    try {
      const res = await fetch('data/places.json');
      if (!res.ok) throw new Error('Veri yüklenemedi');
      this.placesData = await res.json();
    } catch (err) {
      this.showToast('Mekan verisi yüklenemedi, lütfen sayfayı yenileyin.');
    }
  }

  async performSearch() {
    const query = this.elements.locationInput.value.trim();
    if (!query) return this.showToast('Lütfen bir semt veya ilçe adı girin.');
    this.setLoading(true);
    this.abortController = new AbortController();
    try {
      const geoResults = await this.geocode(query, this.abortController.signal);
      if (!geoResults.length) {
        this.showToast('Konum bulunamadı, lütfen daha net bir ifade deneyin.');
        return;
      }
      const { lat, lon, display_name } = geoResults[0];
      this.userCoords = { lat: parseFloat(lat), lng: parseFloat(lon) };
      this.map.setView([this.userCoords.lat, this.userCoords.lng], 13);
      this.addToHistory(query);
      this.searchByCoords(this.userCoords.lat, this.userCoords.lng);
      this.showToast(`${display_name} konumuna yakın yerler listelendi.`);
    } catch (err) {
      if (err.name !== 'AbortError') this.showToast('Arama sırasında bir hata oluştu.');
    } finally {
      this.setLoading(false);
    }
  }

  async geocode(query, signal) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', İstanbul, Türkiye')}&limit=5`;
    const res = await fetch(url, { signal, headers: { 'Accept-Language': 'tr' } });
    return await res.json();
  }

  searchByCoords(lat, lng) {
    if (!this.placesData.length) return;
    const withDistance = this.placesData.map(p => ({
      ...p,
      distance: this.calculateDistance(lat, lng, p.lat, p.lng)
    }));
    this.currentResults = withDistance;
    this.applyFiltersAndRender();
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  toRad(deg) { return deg * (Math.PI/180); }

  applyFiltersAndRender() {
    let filtered = [...this.currentResults];
    const cat = this.elements.categoryFilter.value;
    if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);
    filtered.sort((a, b) => {
      if (this.elements.sortBy.value === 'name') return a.name.localeCompare(b.name, 'tr');
      return a.distance - b.distance;
    });
    const closest = filtered.slice(0, 12);
    this.renderMarkers(closest);
    this.renderList(closest);
  }

  renderMarkers(places) {
    this.markerClusterGroup.clearLayers();
    const markers = places.map(p => {
      const marker = L.marker([p.lat, p.lng]);
      marker.bindPopup(`<b>${p.name}</b><br>${p.district}/${p.neighborhood}<br>${p.distance.toFixed(1)} km`);
      marker.on('click', () => this.openDetailModal(p));
      return marker;
    });
    this.markerClusterGroup.addLayers(markers);
  }

  renderList(places) {
    if (!places.length) {
      this.elements.placesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Filtreye uygun mekan bulunamadı.</p></div>`;
      return;
    }
    this.elements.placesList.innerHTML = places.map((p, i) => `
      <div class="place-card" tabindex="0" role="button" aria-label="${p.name} - ${p.distance.toFixed(1)} km" data-id="${p.id}">
        <h3>${i+1}. ${p.name}</h3>
        <span class="category-badge">${p.category}</span>
        <p style="font-size:0.9rem; color:var(--text-secondary);">${p.district} / ${p.neighborhood}</p>
        <p class="distance">📍 ${p.distance.toFixed(1)} km</p>
      </div>
    `).join('');

    document.querySelectorAll('.place-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const place = this.currentResults.find(p => p.id === id);
        if (place) this.openDetailModal(place);
      });
      card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
    });
  }

  openDetailModal(place) {
    document.getElementById('modalImage').src = place.imageUrl || 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=500&h=300&fit=crop';
    document.getElementById('modalName').textContent = place.name;
    document.getElementById('modalCategory').textContent = place.category;
    document.getElementById('modalDescription').textContent = place.description || 'Açıklama bulunmuyor.';
    document.getElementById('modalDistrict').textContent = `${place.district} / ${place.neighborhood}`;
    document.getElementById('modalDistance').textContent = `📍 ${place.distance.toFixed(1)} km`;
    document.getElementById('modalDirections').href = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    this.elements.detailModal.classList.remove('hidden');
    this.elements.detailModal.querySelector('.close-btn').focus();
  }

  closeModal() {
    this.elements.detailModal.classList.add('hidden');
  }

  useGPS() {
    if (!navigator.geolocation) return this.showToast('Tarayıcınız GPS desteklemiyor.');
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      this.userCoords = { lat: latitude, lng: longitude };
      this.map.setView([latitude, longitude], 14);
      this.searchByCoords(latitude, longitude);
      this.showToast('GPS konumunuza yakın yerler listelendi.');
    }, () => this.showToast('Konum alınamadı.'));
  }

  toggleFullscreen(enable) {
    this.elements.contentGrid.classList.toggle('fullscreen-map', enable);
    this.elements.closeFullscreen.classList.toggle('hidden', !enable);
    this.map.invalidateSize();
  }

  toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    this.updateThemeIcon(isDark);
  }

  // Geçmiş yönetimi
  getHistory() {
    try { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch { return []; }
  }
  addToHistory(query) {
    let history = this.getHistory();
    history = [query, ...history.filter(h => h !== query)].slice(0, 5);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    this.renderHistory();
  }
  renderHistory() {
    const history = this.getHistory();
    this.elements.historyTags.innerHTML = history.map(h => `<span class="history-tag" role="button" tabindex="0">${h}</span>`).join('');
    document.querySelectorAll('.history-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        this.elements.locationInput.value = tag.textContent;
        this.performSearch();
      });
    });
  }

  setLoading(loading) {
    this.elements.btnText.classList.toggle('hidden', loading);
    this.elements.spinner.classList.toggle('hidden', !loading);
    this.elements.searchBtn.disabled = loading;
  }

  showToast(message) {
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
  }
}

// Uygulamayı başlat
document.addEventListener('DOMContentLoaded', () => {
  new IstanbulNearbyPlaces();
});
