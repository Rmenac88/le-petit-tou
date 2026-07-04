const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const client = createClient(supabaseUrl, supabaseAnonKey);

async function listSpots() {
  const { data, error } = await client.from('spots').select('*');
  if (error) {
    console.error("Error fetching spots:", error);
  } else {
    console.log("Spots in database:");
    data.forEach(s => {
      console.log(`- ID: ${s.id}\n  Name: ${s.name}\n  Lat: ${s.lat}\n  Lng: ${s.lng}\n  Desc: ${s.description}\n`);
    });
  }
}

listSpots();
