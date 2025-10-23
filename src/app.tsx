'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Rows,
  TextInput,
  SearchIcon,
  Text,
  Masonry,
  MasonryItem,
  // Corrected icon imports based on available exports
  ImageIcon,
  MusicIcon,
  PlayFilledIcon,
} from '@canva/app-ui-kit';
import { upload } from '@canva/asset';
import { addElementAtPoint } from '@canva/design';

// --- Interfaces (Unchanged) ---
interface CloudinaryAsset {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  preview?: string;
  contentType: string; // Used as the calculated MIME type from the server
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  tags?: string[];
  format?: string;
  resource_type?: string;
  public_id?: string;
  width: number;
  height: number;
}

interface SearchResponse {
  type: 'SUCCESS' | 'ERROR';
  resources: CloudinaryAsset[];
  continuation: string | null;
  message?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  asset: CloudinaryAsset;
  anchorElement: HTMLElement;
}


export default function CloudinarySearch() {
  const [assets, setAssets] = useState<CloudinaryAsset[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const loaderRef = useRef<HTMLDivElement>(null);

  // --- Utility Functions (Simplified - relies on server to provide correct contentType) ---
  // Keeps the MIME type fallback logic for robustness
  const getMimeType = (type: 'image' | 'video' | 'audio', contentType: string, format?: string): string => {
    // If server already provided a full MIME type, use it.
    if (contentType && contentType !== 'application/octet-stream') return contentType;

    // Fallback logic (should rarely be hit if server.js is correct)
    const map: Record<string, Record<string, string>> = {
      image: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif' },
      video: { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', avi: 'video/x-msvideo' },
      audio: { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' }
    };
    const assetType = type.toLowerCase() as 'image' | 'video' | 'audio';
    return map[assetType]?.[format?.toLowerCase() || ''] || 'application/octet-stream';
  };

  // --- Core Fetch Logic (Updated for new cursor format) ---
  const searchAssets = useCallback(async (query: string, cursor?: string, reset = false) => {
    if (loading && !reset) return;

    if (reset) {
      setLoading(true);
      setAssets([]);
      setHasMore(true);
      setContinuation(null);
    } else {
      setLoading(true);
    }

    try {
        // *** FIX: If loading next page, use the current length as the cursor index ***
        const nextCursor = reset ? null : (cursor || assets.length.toString());

        const response = await fetch('http://localhost:5001/api/findResources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchText: query, cursor: nextCursor }),
        });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SearchResponse = await response.json();

      if (data.type === 'SUCCESS') {
        setAssets(prev => reset ? data.resources : [...prev, ...data.resources]);
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
  }, [loading, continuation, assets.length]); // Added assets.length to dependencies

  // --- Handlers & Effects (Unchanged) ---
  const handleInputChange = (value: string) => {
    setSearchText(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchAssets(value, undefined, true);
    }, 500);
  };

  useEffect(() => {
    searchAssets('', undefined, true);
    return () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
    };
  }, []);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading || assets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) { // Removed 'continuation' check here as it's handled in searchAssets
          searchAssets(searchText); // Let searchAssets determine the next cursor (based on assets.length)
        }
      },
      { rootMargin: '200px' }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loaderRef, hasMore, loading, searchText, searchAssets]);

  const handleContextMenu = (event: React.MouseEvent, asset: CloudinaryAsset) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      asset,
      anchorElement: event.currentTarget as HTMLElement
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // --- Asset Upload (Unchanged) ---
  const addToDesign = async (asset: CloudinaryAsset) => {
    let uploadType: 'image' | 'video' | 'audio' = 'image';
    if (asset.type === 'VIDEO') uploadType = 'video';
    if (asset.type === 'AUDIO') uploadType = 'audio';

    // IMPORTANT: Get the most accurate MIME type using both server-provided content type and format
    const mimeType = getMimeType(uploadType, asset.contentType, asset.format);
    const assetName = asset.name || `${uploadType} asset`;

    if (mimeType === 'application/octet-stream') {
        console.warn(`Could not determine specific MIME type for ${asset.name}. Falling back to default.`);
    }

    try {
      const uploadedAsset = await upload({
        type: uploadType,
        mimeType, // This must be correct, e.g., 'image/gif'
        url: asset.url,
        thumbnailUrl: asset.preview || asset.thumbnail,
        aiDisclosure: 'none',
      });

      await addElementAtPoint({
        type: uploadType,
        ref: uploadedAsset.ref,
        altText: {
          text: assetName,
          decorative: false,
        },
      });
      console.log(`✅ Successfully added ${uploadType} (${assetName}) to design`);
    } catch (error) {
      console.error('❌ Failed to add asset to design:', error);
      alert(`Failed to add asset: ${(error as Error).message}. Mime Type used: ${mimeType}. Please check server CORS settings.`);
    }
  };

  // --- Remaining Components (Unchanged) ---
  const AspectRatioCard = ({ asset, onClick, onContextMenu }: {
    asset: CloudinaryAsset,
    onClick: () => void,
    onContextMenu: (e: React.MouseEvent) => void
  }) => {
    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{
                cursor: 'pointer',
                borderRadius: '0px',
                overflow: 'hidden',
                height: '100%',
                position: 'relative',
                boxShadow: 'var(--canva-shadow-card-default)',
                transition: 'box-shadow 0.1s ease-in-out',
                backgroundColor: 'var(--canva-color-fill-secondary)'
            }}
            onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--canva-shadow-card-hover)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = 'var(--canva-shadow-card-default)'}
        >
            <img
                src={asset.preview || asset.thumbnail}
                alt={asset.name}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain', // Show full image, letterbox if needed
                }}
            />
        </div>
    );
  };

  const PlaceholderIcon = ({ assetType }: { assetType: string }) => {
    let IconComponent;
    let color;
    switch (assetType) {
      case 'AUDIO':
        IconComponent = MusicIcon;
        color = 'primary';
        break;
      case 'VIDEO':
        IconComponent = PlayFilledIcon;
        color = 'critical';
        break;
      case 'IMAGE':
      case 'FILE':
      default:
        IconComponent = ImageIcon;
        color = 'info';
    }

    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--canva-color-fill-tertiary)'
        }}>
        <IconComponent size="xlarge" color={color} />
        <Text variant="small" tone="tertiary" style={{ marginTop: '4px' }}>
            {assetType}
        </Text>
      </div>
    );
  };

  const LoadingPlaceholderCard = () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--canva-color-fill-tertiary)',
        borderRadius: '8px',
        animation: 'pulse 1.5s infinite ease-in-out',
      }}
    />
  );

  const LoadingPlaceholderGrid = () => (
    <Masonry targetRowHeightPx={120} spacing="2u">
      {Array.from({ length: 18 }).map((_, index) => {
        let placeholderWidth = 400;
        let placeholderHeight = 300; 

        if (index % 3 === 0) { 
            placeholderHeight = 500;
        } else if (index % 5 === 0) { 
            placeholderWidth = 350;
            placeholderHeight = 350;
        }
        return (
          <MasonryItem
            targetWidthPx={placeholderWidth}
            targetHeightPx={placeholderHeight}
            key={`loading-${index}`}
          >
            <LoadingPlaceholderCard />
          </MasonryItem>
        );
      })}
    </Masonry>
  );


  return (
    <Rows spacing="2u" style={{ height: '100vh', padding: '12px' }}>
      {/* Search Bar */}
      <TextInput
        placeholder="Search images, videos, audio..."
        startIcon={<SearchIcon />}
        value={searchText}
       onChange={(value) => handleInputChange(value)}      />

      <Rows spacing="1u" style={{ flex: 1, overflow: 'auto' }}>
        {/* Loading/Empty State */}
        {loading && assets.length === 0 ? (
          <LoadingPlaceholderGrid />
        ) : assets.length === 0 && !loading ? (
          <Text tone="tertiary" alignment="center" style={{ padding: '32px' }}>
            No media found. Try a different search term.
          </Text>
        ) : (
          <Masonry targetRowHeightPx={120} spacing="2u">
            {assets.map((asset) => (
              <MasonryItem
                targetWidthPx={asset.width}
                targetHeightPx={asset.height}
                key={asset.id}
              >
                {asset.type === 'IMAGE' || asset.type === 'VIDEO' ? (
                    <AspectRatioCard
                        asset={asset}
                        onClick={() => addToDesign(asset)}
                        onContextMenu={(e) => handleContextMenu(e, asset)}
                    />
                ) : (
                    <div
                        onClick={() => addToDesign(asset)}
                        onContextMenu={(e) => handleContextMenu(e, asset)}
                        style={{
                            cursor: 'pointer',
                            borderRadius: '0px',
                            overflow: 'hidden',
                            height: '100%',
                            border: '1px solid var(--canva-color-border-default)'
                        }}
                    >
                        <PlaceholderIcon assetType={asset.type} />
                    </div>
                )}
              </MasonryItem>
            ))}
          </Masonry>
        )}

        {/* IntersectionObserver Target */}
        {hasMore && !loading && assets.length > 0 && <div ref={loaderRef} style={{ height: '1px' }} />}


        {/* Loading Indicator for subsequent pages (below the grid) */}
        {loading && assets.length > 0 && (
            <div style={{ padding: '16px', textAlign: 'center' }}>
                <Text tone="secondary">Loading more media...</Text>
            </div>
        )}
      </Rows>

    </Rows>
  );
}