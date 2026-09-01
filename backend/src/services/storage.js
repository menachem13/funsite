const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// The stored extension/media-type are derived from this map (keyed by the
// *validated* mimetype set by middleware/upload.js's fileFilter), never from
// the client-supplied original filename — see the comment that used to sit
// on this map in upload.js for why that distinction matters.
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

function mediaTypeFor(mimetype) {
  return mimetype.startsWith('video/') ? 'video' : 'image';
}

const client =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } })
    : null;

// Local-disk fallback, used only when Supabase Storage isn't configured —
// config.js only allows that outside production. Files written here do NOT
// survive a Render redeploy; this path exists purely so local dev works
// without every contributor needing their own Supabase Storage bucket.
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!client) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });

/**
 * Persists one uploaded file and returns the URL to store on the
 * listing_media row. Uploads to Supabase Storage (public bucket) when
 * configured; otherwise writes to local disk under /uploads.
 */
async function saveListingMedia({ listingId, buffer, mimetype }) {
  const ext = MIME_EXTENSIONS[mimetype];
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  if (client) {
    const objectPath = `${listingId}/${filename}`;
    const { error } = await client.storage
      .from(config.supabaseStorageBucket)
      .upload(objectPath, buffer, { contentType: mimetype, upsert: false });
    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
    const { data } = client.storage.from(config.supabaseStorageBucket).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

module.exports = { saveListingMedia, mediaTypeFor, MIME_EXTENSIONS };
