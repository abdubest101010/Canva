const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = 5001;

cloudinary.config({
  cloud_name: 'dbt1fvc6l',
  api_key: '539446682367313',
  api_secret: '94ge8qHtK0QwyX6ZohNgsfBLzFM'
});

app.use(cors());
app.use(express.json());


let assetCache = [];
let cacheInitialized = false;
const ASSETS_PER_PAGE = 50;

function getContentType(type, format) {
  const formatLower = format?.toLowerCase() || '';
  const types = {
    image: {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'gif': 'image/gif', 
      'webp': 'image/webp', 'svg': 'image/svg+xml', 'avif': 'image/avif', 'tiff': 'image/tiff'
    },
    video: {
      'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'webm': 'video/webm', 'flv': 'video/x-flv'
    },
    audio: {
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'm4a': 'audio/mp4', 'flac': 'audio/flac', 'aac': 'audio/aac'
    }
  };

  if (type === 'image' && types.image[formatLower]) return types.image[formatLower];
  if (type === 'video' && types.video[formatLower]) return types.video[formatLower];
  if (type === 'raw' && types.audio[formatLower]) return types.audio[formatLower];

  return 'application/octet-stream';
}

async function updateAssetCache() {
    let next_cursor = null;
    let allResources = [];
    const audioFormats = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];


    try {
        do {
            const result = await cloudinary.search
                .expression('resource_type:image OR resource_type:video OR resource_type:raw')
                .with_field('tags')
                .max_results(500) // Fetch maximum per call
                .next_cursor(next_cursor)
                .execute();

            const mappedResources = result.resources.map((asset) => {
                let type = 'IMAGE';
                const format = asset.format?.toLowerCase() || '';
                let assetResourceType = asset.resource_type;
                
                if (assetResourceType === 'image') {
                    type = 'IMAGE';
                } else if (assetResourceType === 'video') {
                    type = 'VIDEO';
                } else if (assetResourceType === 'raw' && audioFormats.includes(format)) {
                    type = 'AUDIO';
                    assetResourceType = 'audio';
                } else {
                    type = 'FILE';
                }

                const assetWidth = asset.width || 400;
                const assetHeight = asset.height || 300;
                const finalContentType = getContentType(assetResourceType, asset.format);

                const previewOptions = {
                    width: 400, 
                    height: 300,
                    crop: 'limit',
                    quality: 'auto:low', // Use low quality for previews to save bandwidth
                    fetch_format: 'auto',
                    secure: true,
                    resource_type: asset.resource_type
                };
                
                let thumbnailUrl = cloudinary.url(asset.public_id, {...previewOptions, width: 200, height: 150});
                let previewUrl = cloudinary.url(asset.public_id, previewOptions);
                
                if (type === 'AUDIO') {
                    thumbnailUrl = 'https://via.placeholder.com/200x150/4A90E2/FFFFFF?text=Audio';
                    previewUrl = 'https://via.placeholder.com/400x300/4A90E2/FFFFFF?text=Audio+File';
                }
                
                const originalAssetUrl = cloudinary.url(asset.public_id, {
                    secure: true,
                    resource_type: asset.resource_type,
                });

                return {
                    id: asset.asset_id || asset.public_id,
                    name: asset.public_id.split('/').pop() || asset.public_id,
                    url: originalAssetUrl, // Full-size URL for upload
                    type,
                    contentType: finalContentType,
                    format: asset.format,
                    tags: asset.tags || [],
                    thumbnail: thumbnailUrl,
                    preview: previewUrl,
                    width: assetWidth,
                    height: assetHeight,
                    searchable: `${asset.public_id} ${asset.tags?.join(' ')} ${type} ${format}`.toLowerCase()
                };
            });

            allResources.push(...mappedResources);
            next_cursor = result.next_cursor;
            
        } while (next_cursor);

        assetCache = allResources;
        cacheInitialized = true;

    } catch (error) {
        console.error('❌ Failed to initialize asset cache from Cloudinary:', error.message);
        cacheInitialized = true; 
    }
}


app.post('/api/findResources', async (req, res) => {
    if (!cacheInitialized) {
        return res.status(503).json({
            type: 'ERROR',
            resources: [],
            continuation: null,
            message: 'Asset cache is not yet initialized. Please wait a moment.'
        });
    }

    try {
        const { searchText, cursor } = req.body;
        const query = (searchText || '').trim();

        let filteredAssets;
        if (query) {
            const searchTerms = query.toLowerCase().split(/\s+/);

            filteredAssets = assetCache.filter(asset => {
                return searchTerms.every(term => asset.searchable.includes(term));
            });
        } else {
            filteredAssets = assetCache;
        }

        const startIndex = cursor ? parseInt(cursor) : 0;
        const endIndex = startIndex + ASSETS_PER_PAGE;
        
        const resources = filteredAssets.slice(startIndex, endIndex);
        const nextCursor = endIndex < filteredAssets.length ? endIndex.toString() : null;

        res.json({
            type: 'SUCCESS',
            resources,
            continuation: nextCursor
        });

    } catch (error) {
        console.error('❌ Local Search error:', error.message);
        res.status(500).json({
            type: 'ERROR',
            resources: [],
            continuation: null,
            message: 'Local search failed: ' + error.message
        });
    }
});

app.listen(PORT, () => {
    updateAssetCache(); 
});
