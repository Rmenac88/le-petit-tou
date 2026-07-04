const fetch = require('node-fetch');

async function testGeocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10`;
  console.log(`\nSearching for: "${query}"`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LePetitTou/1.0'
      }
    });
    const data = await response.json();
    data.forEach((item, index) => {
      console.log(`[${index}] Title: ${item.display_name} (Lat: ${item.lat}, Lng: ${item.lon})`);
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

testGeocode("restaurant in Toulouse, Toulouse");
