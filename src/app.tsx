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
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  tags?: string[];
  format?: string;
  resource_type?: string;
  public_id?: string;
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
  const [continuation, setContinuation] = useState<string | null>(null);
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
      setContinuation(null);
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
        setContinuation(data.continuation);
        
        // Debug: Log asset types
        console.log('Asset types received:', data.resources.map(asset => ({
          name: asset.name,
          type: asset.type,
          resource_type: asset.resource_type,
          format: asset.format
        })));
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
    if (!loading && hasMore && continuation) {
      searchAssets(searchText, continuation);
    }
  }, [loading, hasMore, continuation, searchText]);

  const addToDesign = async (asset: CloudinaryAsset) => {
    try {
      console.log('Adding asset to design:', {
        name: asset.name,
        type: asset.type,
        contentType: asset.contentType,
        format: asset.format
      });

      // Handle different asset types
      switch (asset.type) {
        case 'IMAGE':
          await addImageToDesign(asset);
          break;
        case 'VIDEO':
          await addVideoToDesign(asset);
          break;
        case 'AUDIO':
          await addAudioToDesign(asset);
          break;
        default:
          console.warn('Unsupported asset type:', asset.type);
          // Try to handle as image as fallback
          await addImageToDesign(asset);
      }
    } catch (error) {
      console.error('❌ Failed to add asset to design:', error);
    }
  };

  const addImageToDesign = async (asset: CloudinaryAsset) => {
    const getMimeType = (contentType: string, format?: string): string => {
      const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'avif': 'image/avif',
        'tiff': 'image/tiff'
      };
      
      if (contentType && contentType.startsWith('image/')) {
        return contentType;
      }
      
      return mimeMap[format?.toLowerCase() || ''] || 'image/jpeg';
    };

    const mimeType = getMimeType(asset.contentType, asset.format);

    const uploadedAsset = await upload({
      type: 'image',
      mimeType,
      url: asset.url,
      thumbnailUrl: asset.preview || asset.thumbnail,
      aiDisclosure: 'none'
    });

    await addElementAtPoint({
      type: 'image',
      ref: uploadedAsset.ref,
      altText: {
        text: asset.name || 'Imported image',
        decorative: false
      }
    });

    console.log('✅ Successfully added image to design');
  };

  const addVideoToDesign = async (asset: CloudinaryAsset) => {
    const getMimeType = (contentType: string, format?: string): string => {
      const mimeMap: Record<string, string> = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm'
      };
      
      if (contentType && contentType.startsWith('video/')) {
        return contentType;
      }
      
      return mimeMap[format?.toLowerCase() || ''] || 'video/mp4';
    };

    const mimeType = getMimeType(asset.contentType, asset.format);

    const uploadedAsset = await upload({
      type: 'video',
      mimeType,
      url: asset.url,
      thumbnailUrl: asset.preview || asset.thumbnail,
      aiDisclosure: 'none'
    });

    await addElementAtPoint({
      type: 'video',
      ref: uploadedAsset.ref,
      altText: {
        text: asset.name || 'Imported video',
        decorative: false
      }
    });

    console.log('✅ Successfully added video to design');
  };

  const addAudioToDesign = async (asset: CloudinaryAsset) => {
    const getMimeType = (contentType: string, format?: string): string => {
      const mimeMap: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'flac': 'audio/flac'
      };
      
      if (contentType && contentType.startsWith('audio/')) {
        return contentType;
      }
      
      return mimeMap[format?.toLowerCase() || ''] || 'audio/mpeg';
    };

    const mimeType = getMimeType(asset.contentType, asset.format);

    const uploadedAsset = await upload({
      type: 'audio',
      mimeType,
      url: asset.url,
      thumbnailUrl: asset.preview || asset.thumbnail,
      aiDisclosure: 'none'
    });

    await addElementAtPoint({
      type: 'audio',
      ref: uploadedAsset.ref,
      altText: {
        text: asset.name || 'Imported audio',
        decorative: false
      }
    });

    console.log('✅ Successfully added audio to design');
  };

  const getAssetTypeBadge = (type: string) => {
    const badges = {
      'IMAGE': { label: 'Image', color: '#10b981' },
      'VIDEO': { label: 'Video', color: '#ef4444' },
      'AUDIO': { label: 'Audio', color: '#8b5cf6' },
      'FILE': { label: 'File', color: '#6b7280' }
    };

    const badge = badges[type as keyof typeof badges] || badges.FILE;

    return (
      <div
        style={{
          backgroundColor: badge.color,
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 1
        }}
      >
        {badge.label}
      </div>
    );
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
          <CanvaUI.Text tone="tertiary">No media found. Try a different search term.</CanvaUI.Text>
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
              height: 'fit-content',
              position: 'relative'
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
            {/* Type Badge */}
            {getAssetTypeBadge(asset.type)}

            {/* Media Container */}
            <div style={{
              width: '100%',
              height: '140px',
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: '#f1f3f4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
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
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; padding: 8px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 8px;">
                        ${asset.type === 'AUDIO' ? '🎵' : asset.type === 'VIDEO' ? '🎥' : '📄'}
                      </div>
                      <span style="font-size: 12px; font-weight: 500;">${asset.type}</span>
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
          placeholder="Search images, videos, audio..."
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
              Load More Media
            </CanvaUI.Button>
          </div>
        )}
      </div>
    </div>
  );
}