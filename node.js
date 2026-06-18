// generate_places.js
const fs = require('fs');
const path = require('path');

// İstanbul mahalle listesi (gerçek veri, 2023)
const neighborhoods = [
  { district: 'Adalar', name: 'Büyükada', lat: 40.857, lng: 29.122 },
  { district: 'Adalar', name: 'Heybeliada', lat: 40.848, lng: 29.103 },
  // ... (tüm mahalleler eklenecek)
  // Örnek olarak sadece birkaçı; gerçek veri seti 961 mahalledir.
  // Tam liste için: https://github.com/cihatdev/istanbul-mahalle-listesi
];

// Her mahalle için otomatik mekan oluştur
const places = [];
const categories = ['park', 'tarihi', 'kültür', 'manzara', 'alışveriş', 'yeme içme', 'sahil', 'müze'];

neighborhoods.forEach((n, index) => {
  const cat = categories[index % categories.length];
  const placeName = `${n.name} ${cat === 'park' ? 'Parkı' : cat === 'tarihi' ? 'Tarihi Alanı' : cat === 'kültür' ? 'Kültür Merkezi' : cat === 'manzara' ? 'Seyir Noktası' : cat === 'alışveriş' ? 'Çarşısı' : cat === 'yeme içme' ? 'Meydanı' : cat === 'sahil' ? 'Sahili' : 'Müzesi'}`;
  const id = `place-${index}`;
  places.push({
    id,
    name: placeName,
    category: cat,
    lat: n.lat + (Math.random() * 0.005 - 0.0025), // hafif rastgelelik
    lng: n.lng + (Math.random() * 0.005 - 0.0025),
    district: n.district,
    neighborhood: n.name,
    description: `${n.district}, ${n.name} bölgesinde gezilecek güzel bir nokta.`
  });
});

// 1000'i tamamlamak için ekstra popüler noktalar ekle (örnek)
const extraPlaces = [
  { id: 'extra-1', name: 'Kız Kulesi', category: 'tarihi', lat: 41.0211, lng: 29.0041, district: 'Üsküdar', neighborhood: 'Salacak', description: 'Boğazın incisi.' },
  // ... 40 adet daha eklenebilir
];
places.push(...extraPlaces);

const jsonPath = path.join(__dirname, 'data', 'places.json');
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(places, null, 2), 'utf8');
console.log(`${places.length} mekan oluşturuldu → data/places.json`);