import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase configuration
const supabaseUrl = 'https://msgmhlcfkngtgqlalonn.supabase.co'
// SERVICE_ROLE_KEY is needed to create buckets via API if standard key fails permissions, 
// but we only have ANON key. 
// We will try to list buckets first to see what's going on.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ21obGNma25ndGdxbGFsb25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzQ1MzQsImV4cCI6MjA4NjU1MDUzNH0.56Oq5TXSYMnP49_FTHRoaHfRX8vOR_n1QVhUXsiF2No'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugStorage() {
    console.log("Checking storage buckets...");
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("Error listing buckets:", error);
        document.body.innerHTML += `<p style="color:red">Error: ${error.message}</p>`;
    } else {
        console.log("Buckets found:", data);
        const names = data.map(b => b.name).join(", ");
        document.body.innerHTML += `<p style="color:green">Buckets found: ${names || "None"}</p>`;

        const found = data.find(b => b.name === 'wardrobe_images');
        if (!found) {
            document.body.innerHTML += `<p style="color:orange">Bucket 'wardrobe_images' NOT found. Please create it in dashboard.</p>`;
        } else {
            document.body.innerHTML += `<p style="color:blue">Bucket 'wardrobe_images' EXISTS.</p>`;
        }
    }
}

debugStorage();
