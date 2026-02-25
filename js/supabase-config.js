import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase configuration
const supabaseUrl = 'https://msgmhlcfkngtgqlalonn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ21obGNma25ndGdxbGFsb25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzQ1MzQsImV4cCI6MjA4NjU1MDUzNH0.56Oq5TXSYMnP49_FTHRoaHfRX8vOR_n1QVhUXsiF2No'

export const supabase = createClient(supabaseUrl, supabaseKey)
