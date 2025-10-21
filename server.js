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

// Enable CORS
app.use(cors());
app.use(express.json());

// Search endpoint for images
app.post('/api/findResources', async (req, res) => {
  try {
    const { searchText, cursor } = req.body;
    const query = (searchText || '').trim().toLowerCase();

    console.log(`🔍 Image search request: "${query || 'all'}"`);

    let result;
    if (query && query !== 'all') {
      // Use Cloudinary Search API for name/tag-based search
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
      // Fallback to all images
      result = await cloudinary.api.resources({
        type: 'upload',
        resource_type: 'image',
        max_results: 50,
        next_cursor: cursor
      });
    }

    console.log(`📦 Found ${result.resources?.length || 0} images`);

    const resources = result.resources.map((asset) => {
      // Generate proper thumbnail URL
      const thumbnailUrl = cloudinary.url(asset.public_id, {
        width: 200,
        height: 150,
        crop: 'fill',
        quality: 'auto',
        format: 'jpg', // Force format for consistency
        secure: true
      });

      // Generate optimized preview URL (larger than thumbnail)
      const previewUrl = cloudinary.url(asset.public_id, {
        width: 400,
        height: 300,
        crop: 'fill',
        quality: 'auto',
        format: 'jpg',
        secure: true
      });

      return {
        id: asset.asset_id || asset.public_id,
        name: asset.public_id.split('/').pop() || asset.public_id,
        url: asset.secure_url,
        type: 'IMAGE',
        contentType: getContentType(asset.resource_type, asset.format),
        format: asset.format,
        tags: asset.tags || [],
        thumbnail: thumbnailUrl,
        preview: previewUrl // Add preview for better quality
      };
    });

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

// Helper for content types
function getContentType(type, format) {
  const formatLower = format?.toLowerCase() || '';
  const types = {
    image: {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'webp': 'image/webp', 'svg': 'image/svg+xml', 'avif': 'image/avif', 'tiff': 'image/tiff'
    }
  };
  return types[type]?.[formatLower] || 'image/jpeg';
}

app.listen(PORT, () => {
  console.log(`🚀 Server on http://localhost:${PORT}`);
});