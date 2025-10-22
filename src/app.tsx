'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as CanvaUI from '@canva/app-ui-kit';
import { upload } from '@canva/asset';
import { addElementAtPoint } from '@canva/design';

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
  const [selectedAsset, setSelectedAsset] = useState<CloudinaryAsset | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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

  const showAssetDetails = (asset: CloudinaryAsset) => {
    setSelectedAsset(asset);
    setShowDetailsModal(true);
  };

  const handleContextMenu = (asset: CloudinaryAsset, event: React.MouseEvent) => {
    event.preventDefault();
    showAssetDetails(asset);
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
            onContextMenu={(e) => handleContextMenu(asset, e)}
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
            {/* Three dots menu button */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 1,
                opacity: 0,
                transition: 'opacity 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0';
              }}
            >
              <CanvaUI.Button
                variant="tertiary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  showAssetDetails(asset);
                }}
                aria-label="More options"
              >
                ⋮
              </CanvaUI.Button>
            </div>

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
            <div style={{ padding: '0 4px', textAlign: 'center' as const }}>
              <div style={{ 
                fontWeight: 500,
                marginBottom: '4px',
                fontSize: '14px',
                lineHeight: '1.4',
                maxHeight: '2.8em',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {asset.name}
              </div>
              
              {asset.tags && asset.tags.length > 0 && (
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  lineHeight: '1.4',
                  maxHeight: '1.4em',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}>
                  {asset.tags.slice(0, 2).join(', ')}
                  {asset.tags.length > 2 ? '...' : ''}
                </div>
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
            <span style={{ marginLeft: '8px', color: '#666', fontSize: '14px' }}>Loading more...</span>
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

      {/* Asset Details Modal */}
      {showDetailsModal && selectedAsset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <CanvaUI.Text variant="bold" size="large">{selectedAsset.name}</CanvaUI.Text>
              <CanvaUI.Button
                variant="tertiary"
                onClick={() => setShowDetailsModal(false)}
                aria-label="Close"
              >
                ×
              </CanvaUI.Button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <img
                src={selectedAsset.preview || selectedAsset.thumbnail}
                alt={selectedAsset.name}
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  backgroundColor: '#f5f5f5'
                }}
              />
            </div>
            
            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
              <div>
                <CanvaUI.Text variant="bold">Name</CanvaUI.Text>
                <CanvaUI.Text>{selectedAsset.name}</CanvaUI.Text>
              </div>
              
              <div>
                <CanvaUI.Text variant="bold">Type</CanvaUI.Text>
                <CanvaUI.Text>
                  {selectedAsset.type} • {selectedAsset.format?.toUpperCase()}
                </CanvaUI.Text>
              </div>
              
              {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                <div>
                  <CanvaUI.Text variant="bold">Tags</CanvaUI.Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {selectedAsset.tags.map((tag, index) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor: '#e9ecef',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <CanvaUI.Text variant="bold">Cloudinary ID</CanvaUI.Text>
                <CanvaUI.Text tone="tertiary" size="small">
                  {selectedAsset.public_id}
                </CanvaUI.Text>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <CanvaUI.Button
                variant="secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </CanvaUI.Button>
              <CanvaUI.Button
                variant="primary"
                onClick={() => {
                  addToDesign(selectedAsset);
                  setShowDetailsModal(false);
                }}
              >
                Add to Design
              </CanvaUI.Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}