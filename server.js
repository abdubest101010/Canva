const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = 5001;

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dbt1fvc6l',
  api_key: '539446682367313',
  api_secret: '94ge8qHtK0QwyX6ZohNgsfBLzFM'
});

console.log('🔐 Cloudinary Config Check:');
console.log('   Cloud Name:', cloudinary.config().cloud_name);
console.log('   API Key:', cloudinary.config().api_key ? '✅ Set' : '❌ Missing');
console.log('   API Secret:', cloudinary.config().api_secret ? '✅ Set' : '❌ Missing');

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Search endpoint for all asset types
app.post('/api/findResources', async (req, res) => {
  try {
    const { searchText, cursor } = req.body;
    const query = (searchText || '').trim().toLowerCase();

    console.log(`🔍 Search request: "${query || 'all'}"`);

    let result;

    if (query && query !== 'all') {
      const searchExpression = [
        `public_id:${query}*`,
        `tags:${query}`,
      ].join(' OR ');

      result = await cloudinary.search
        .expression(searchExpression)
        .max_results(50)
        .next_cursor(cursor)
        .execute();
    } else {
      // ✅ Better search for all media types
      result = await cloudinary.search
        .expression('resource_type:image OR resource_type:video OR resource_type:raw')
        .max_results(50)
        .next_cursor(cursor)
        .execute();
    }

    // Debug: Log what Cloudinary actually returned
    console.log('📋 Raw Cloudinary results:');
    result.resources.forEach(asset => {
      console.log(`   - ${asset.public_id} | type: ${asset.resource_type} | format: ${asset.format}`);
    });

    const counts = { image: 0, video: 0, audio: 0 };
    const tagStats = { totalTags: 0, uniqueTags: new Set() };

    const resources = result.resources.map((asset) => {
      // 🔊 Improved audio detection
      let type = 'IMAGE';
      const format = asset.format?.toLowerCase() || '';
      const audioFormats = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
      
      if (asset.resource_type === 'image') {
        type = 'IMAGE';
        counts.image++;
      } else if (asset.resource_type === 'video' || asset.resource_type === 'raw') {
        if (audioFormats.includes(format)) {
          type = 'AUDIO';
          counts.audio++;
        } else if (asset.resource_type === 'video') {
          type = 'VIDEO';
          counts.video++;
        } else {
          type = 'FILE';
          counts.image++; // or track separately
        }
      }

      // Collect tags
      const tags = asset.tags || [];
      tags.forEach(tag => tagStats.uniqueTags.add(tag));
      tagStats.totalTags += tags.length;

      // For audio files, use a different approach for thumbnails
      let thumbnailUrl, previewUrl;
      if (type === 'AUDIO') {
        // ✅ Use a real, working placeholder image URL
        thumbnailUrl = 'https://via.placeholder.com/200x150/4A90E2/FFFFFF?text=Audio';
        previewUrl = 'https://via.placeholder.com/400x300/4A90E2/FFFFFF?text=Audio+File';
      } else {
        thumbnailUrl = cloudinary.url(asset.public_id, {
          width: 200,
          height: 150,
          crop: 'fill',
          quality: 'auto',
          format: 'jpg',
          secure: true,
          resource_type: asset.resource_type
        });
      
        previewUrl = cloudinary.url(asset.public_id, {
          width: 400,
          height: 300,
          crop: 'fill',
          quality: 'auto',
          format: 'jpg',
          secure: true,
          resource_type: asset.resource_type
        });
      }

      return {
        id: asset.asset_id || asset.public_id,
        name: asset.public_id.split('/').pop() || asset.public_id,
        url: asset.secure_url,
        type,
        contentType: getContentType(asset.resource_type, asset.format),
        format: asset.format,
        tags: tags,
        thumbnail: thumbnailUrl,
        preview: previewUrl,
        resource_type: asset.resource_type, // Include for debugging
        public_id: asset.public_id // Include for debugging
      };
    });

    console.log(`📦 Found ${resources.length} total assets:`);
    console.log(`   🖼️  Images: ${counts.image}`);
    console.log(`   🎥 Videos: ${counts.video}`);
    console.log(`   🎵 Audio:   ${counts.audio}`);
    console.log(`   🏷️  Total Tags: ${tagStats.totalTags}`);
    console.log(`   🧩 Unique Tags: ${Array.from(tagStats.uniqueTags).join(', ')}`);

    res.json({
      type: 'SUCCESS',
      resources,
      continuation: result.next_cursor
    });

  } catch (error) {
    console.error('❌ Search error:', error.message);
    res.status(500).json({
      type: 'ERROR',
      resources: [],
      continuation: null,
      message: 'Search failed: ' + error.message
    });
  }
});

// Test endpoint for your specific audio file
app.get('/api/test-audio', async (req, res) => {
  try {
    // Search specifically for your audio file
    const result = await cloudinary.search
      .expression('public_id:Surah_Nuh_Noreen_Mohamed_Siddiq_mp3_cya7wm')
      .execute();
    
    console.log('🎵 Audio file search result:', result);
    
    if (result.resources.length > 0) {
      const audio = result.resources[0];
      console.log('Audio details:', {
        public_id: audio.public_id,
        resource_type: audio.resource_type,
        format: audio.format,
        secure_url: audio.secure_url
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Audio test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function for MIME types
function getContentType(type, format) {
  const formatLower = format?.toLowerCase() || '';
  const types = {
    image: {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'webp': 'image/webp', 'svg': 'image/svg+xml', 'avif': 'image/avif', 'tiff': 'image/tiff'
    },
    video: {
      'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'webm': 'video/webm', 'flv': 'video/x-flv'
    },
    raw: {
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'm4a': 'audio/mp4', 'flac': 'audio/flac', 'aac': 'audio/aac'
    }
  };
  return types[type]?.[formatLower] || 'application/octet-stream';
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} — Last updated: Wednesday, October 22, 2025`);
});