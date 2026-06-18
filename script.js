// Global değişkenler
let map = L.map('map').setView([41.0082, 28.9784], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

let placesData = [];
let markersLayer = L.layerGroup().addTo(map);

// JSON verisini yükle
fetch('data/places.json')
  .then(res => res.json())
  .then(data => {
    placesData = data;
  })
  .catch(err => console.error('Veri yüklenemedi:', err));

// Haversine mesafe hesaplama (km)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

// Nominatim ile adres → koordinat
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query + ', İstanbul, Türkiye'
  )}&limit=5`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'tr' }
  });
  return await res.json();
}

// Arama butonu
document.getElementById('searchBtn').addEventListener('click', async () => {
  const input = document.getElementById('locationInput').value.trim();
  if (!input) return;

  const btn = document.getElementById('searchBtn');
  btn.disabled = true;
  btn.textContent = 'Aranıyor...';

  const geoResults = await geocode(input);
  if (geoResults.length === 0) {
    alert('Konum bulunamadı. Lütfen daha net bir semt/ilçe yazın.');
    btn.disabled = false;
    btn.textContent = 'Ara';
    return;
  }

  const { lat, lon, display_name } = geoResults[0];
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lon);

  // Haritayı konuma taşı
  map.setView([userLat, userLng], 13);

  // Mesafeleri hesapla ve sırala
  const withDistances = placesData.map(place => ({
    ...place,
    distance: calculateDistance(userLat, userLng, place.lat, place.lng)
  }));

  withDistances.sort((a, b) => a.distance - b.distance);
  const closest = withDistances.slice(0, 12); // en az 10 (garanti 12)

  // Harita işaretçilerini güncelle
  markersLayer.clearLayers();
  // Kullanıcı konumu mavi işaretçi
  L.marker([userLat, userLng], {
    icon: L.divIcon({
      className: 'user-marker',
      html: '<div style="background:#1e90ff; width:16px; height:16px; border-radius:50%; border:2px solid white;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })
  }).addTo(map).bindPopup(`<b>Konumunuz:</b><br>${display_name}`);

  closest.forEach((place, index) => {
    const marker = L.marker([place.lat, place.lng])
      .addTo(markersLayer)
      .bindPopup(`
        <b>${place.name}</b><br>
        <i>${place.category} · ${place.district}/${place.neighborhood}</i><br>
        Mesafe: ${place.distance.toFixed(1)} km
      `);
    if (index === 0) marker.openPopup(); // en yakının popup'ını aç
  });

  // Liste görünümünü güncelle
  renderPlaceList(closest);

  btn.disabled = false;
  btn.textContent = 'Ara';
});

function renderPlaceList(places) {
  const listDiv = document.getElementById('placesList');
  listDiv.innerHTML = places.map(place => `
    <div class="place-card">
      <h3>${place.name}</h3>
      <span class="category">${place.category}</span>
      <p style="margin-top:0.25rem;">${place.description || ''}</p>
      <p class="distance">📍 ${place.distance.toFixed(1)} km</p>
    </div>
  `).join('');
}