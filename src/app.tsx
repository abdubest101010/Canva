'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as CanvaUI from '@canva/app-ui-kit';
import { upload } from '@canva/asset';
import { addElementAtCursor, addElementAtPoint, addNativeElement } from '@canva/design';

interface CloudinaryAsset {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  preview?: string;
  contentType: string;
  type: 'IMAGE';
  tags?: string[];
  format?: string;
}

interface SearchResponse {
  type: 'SUCCESS' | 'ERROR';
  resources: CloudinaryAsset[];
  continuation: string | null;
  message?: string;
}

export default function CloudinarySearch() {
  const [assets, setAssets] = useState<CloudinaryAsset[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    searchAssets('');
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchAssets = async (query: string, cursor?: string) => {
    if (!cursor) {
      setLoading(true);
      setAssets([]);
      setHasMore(true);
    }

    try {
      const response = await fetch('http://localhost:5001/api/findResources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchText: query, cursor })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SearchResponse = await response.json();

      if (data.type === 'SUCCESS') {
        setAssets(prev => cursor ? [...prev, ...data.resources] : data.resources);
        setHasMore(!!data.continuation);
        
        // Debug: Log the first asset to check thumbnail URL
        if (data.resources.length > 0) {
          console.log('First asset:', {
            name: data.resources[0].name,
            thumbnail: data.resources[0].thumbnail,
            preview: data.resources[0].preview
          });
        }
      } else {
        console.error('Search failed:', data.message);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchText(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchAssets(value);
    }, 500);
  };

  const loadMore = useCallback(() => {
    if (!loading && hasMore && assets.length > 0) {
      searchAssets(searchText);
    }
  }, [loading, hasMore, assets, searchText]);

  const addToDesign = async (asset: CloudinaryAsset) => {
    try {
      // Map content type to proper MIME type
      const getMimeType = (contentType: string, format?: string): string => {
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        
        if (contentType && contentType.startsWith('image/')) {
          return contentType;
        }
        
        return mimeMap[format?.toLowerCase() || ''] || 'image/jpeg';
      };
  
      const mimeType = getMimeType(asset.contentType, asset.format);
  
      // Upload the asset to Canva with proper AI disclosure
      const uploadedAsset = await upload({
        type: 'image',
        mimeType,
        url: asset.url, // Use original URL for upload
        thumbnailUrl: asset.preview || asset.thumbnail, // Use preview for better thumbnail
        aiDisclosure: 'none' // Updated to string format for non-AI assets
      });
  
      // Add to design at center (omit top/left/width/height to default to center)
      await addElementAtPoint({
        type: 'image',
        ref: uploadedAsset.ref,
        altText: {
          text: asset.name || 'Imported image',
          decorative: false
        }
      });
  
      console.log('✅ Successfully added image to design');
    } catch (error) {
      console.error('❌ Failed to add image to design:', error);
    }
  };

  const AssetGrid = () => {
    if (loading && assets.length === 0) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: '32px'
        }}>
          <CanvaUI.LoadingIndicator />
        </div>
      );
    }

    if (assets.length === 0 && !loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: '32px',
          color: '#666'
        }}>
          <CanvaUI.Text tone="tertiary">No images found. Try a different search term.</CanvaUI.Text>
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
          padding: '12px 0'
        }}
      >
        {assets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => addToDesign(asset)}
            style={{
              padding: '8px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              height: 'fit-content'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Image Container */}
            <div style={{
              width: '100%',
              height: '140px',
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: '#f1f3f4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={asset.preview || asset.thumbnail}
                alt={asset.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }}
                loading="lazy"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
                      <span>No preview</span>
                    </div>
                  `;
                }}
              />
            </div>
            
            {/* Text Content */}
            <div style={{ padding: '0 4px' }}>
              <CanvaUI.Text
                size="small"
                tone="primary"
                alignment="center"
                lineClamp={2}
                style={{ 
                  fontWeight: '500',
                  marginBottom: '4px'
                }}
              >
                {asset.name}
              </CanvaUI.Text>
              
              {asset.tags && asset.tags.length > 0 && (
                <CanvaUI.Text
                  size="xsmall"
                  tone="tertiary"
                  alignment="center"
                  lineClamp={1}
                >
                  {asset.tags.slice(0, 2).join(', ')}
                  {asset.tags.length > 2 ? '...' : ''}
                </CanvaUI.Text>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ 
      padding: '12px', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'white'
    }}>
      {/* Search Header */}
      <div style={{ paddingBottom: '12px' }}>
        <CanvaUI.TextInput
          placeholder="Search images by name or tags..."
          value={searchText}
          onChange={handleInputChange}
        />
      </div>

      {/* Results Area */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        minHeight: 0
      }}>
        <AssetGrid />
        
        {/* Loading More Indicator */}
        {loading && assets.length > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: '20px'
          }}>
            <CanvaUI.LoadingIndicator />
            <CanvaUI.Text style={{ marginLeft: '8px' }} tone="secondary">Loading more...</CanvaUI.Text>
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && assets.length > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            padding: '16px'
          }}>
            <CanvaUI.Button
              variant="secondary"
              onClick={loadMore}
            >
              Load More Images
            </CanvaUI.Button>
          </div>
        )}
      </div>
    </div>
  );
}