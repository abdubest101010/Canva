'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Rows,
  TextInput,
  SearchIcon,
  Text,
  Masonry,
  MasonryItem,
  ImageIcon,
  MusicIcon,
  PlayFilledIcon,
  MoreHorizontalIcon,
  Button,
  Pill,
  SearchInputMenu,
  MenuItem,
  XIcon,
} from '@canva/app-ui-kit';
import { upload } from '@canva/asset';
import { addElementAtPoint } from '@canva/design';

// --- Interfaces ---
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
  width: number;
  height: number;
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

  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const loaderRef = useRef<HTMLDivElement>(null);

  // --- MIME type helper ---
  const getMimeType = (
    type: 'image' | 'video' | 'audio',
    contentType: string,
    format?: string
  ): string => {
    if (contentType && contentType !== 'application/octet-stream') return contentType;

    const map: Record<string, Record<string, string>> = {
      image: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif' },
      video: { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', avi: 'video/x-msvideo' },
      audio: { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' }
    };
    const assetType = type.toLowerCase() as 'image' | 'video' | 'audio';
    return map[assetType]?.[format?.toLowerCase() || ''] || 'application/octet-stream';
  };

  // --- Search logic ---
  const searchAssets = useCallback(
    async (query: string, cursor?: string, reset = false) => {
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
        const nextCursor = reset ? null : (cursor || assets.length.toString());
        const response = await fetch('http://localhost:5001/api/findResources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchText: query, cursor: nextCursor }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data: SearchResponse = await response.json();

        if (data.type === 'SUCCESS') {
          setAssets((prev) => (reset ? data.resources : [...prev, ...data.resources]));
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
    },
    [loading, assets.length]
  );

  // --- Input handler ---
  const handleInputChange = (value: string) => {
    setSearchText(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchAssets(value, undefined, true), 500);
  };

  // --- Initial load ---
  useEffect(() => {
    searchAssets('', undefined, true);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // --- Infinite scroll ---
  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading || assets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          searchAssets(searchText);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, searchText, searchAssets]);

  // --- Close panel on outside click ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        selectedAsset &&
        !target.closest(`[data-asset-id="${selectedAsset.id}"]`) &&
        !target.closest('.asset-info-panel')
      ) {
        setSelectedAsset(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedAsset]);

  // --- Add to Canva ---
  const addToDesign = async (asset: CloudinaryAsset) => {
    let uploadType: 'image' | 'video' | 'audio' = 'image';
    if (asset.type === 'VIDEO') uploadType = 'video';
    if (asset.type === 'AUDIO') uploadType = 'audio';

    const mimeType = getMimeType(uploadType, asset.contentType, asset.format);
    const assetName = asset.name || `${uploadType} asset`;

    try {
      const uploadedAsset = await upload({
        type: uploadType,
        mimeType,
        url: asset.url,
        thumbnailUrl: asset.preview || asset.thumbnail,
        aiDisclosure: 'none',
      });

      await addElementAtPoint({
        type: uploadType,
        ref: uploadedAsset.ref,
        altText: { text: assetName, decorative: false },
      });
      console.log(`✅ Added ${uploadType}: ${assetName}`);
      setSelectedAsset(null);
    } catch (error) {
      console.error('❌ Failed to add asset:', error);
      alert(`Failed to add asset: ${(error as Error).message}`);
    }
  };

  // --- Handle three-dot click (select only) ---
  const handleSelectAsset = (event: React.MouseEvent, asset: CloudinaryAsset) => {
    event.preventDefault();
    event.stopPropagation(); // Prevent parent handlers
    setSelectedAsset(asset);
  };

  // --- Asset Card Component ---
  const AssetCard = ({ asset }: { asset: CloudinaryAsset }) => {
    const isSelected = selectedAsset?.id === asset.id;
    const [isHovered, setIsHovered] = useState(false);

    const renderContent = () => {
      if (asset.type === 'IMAGE' || asset.type === 'VIDEO') {
        return (
          <img
            src={asset.preview || asset.thumbnail}
            alt={asset.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        );
      } else {
        let IconComponent = ImageIcon;
        let color: 'primary' | 'critical' | 'info' = 'info';
        if (asset.type === 'AUDIO') {
          IconComponent = MusicIcon;
          color = 'primary';
        } else if (asset.type === 'VIDEO') {
          IconComponent = PlayFilledIcon;
          color = 'critical';
        }

        return (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--canva-color-fill-tertiary)',
            }}
          >
            <IconComponent size="xlarge" color={color} />
            <Text variant="small" tone="tertiary" style={{ marginTop: '4px' }}>
              {asset.type}
            </Text>
          </div>
        );
      }
    };

    return (
      <div
        data-asset-id={asset.id}
        onClick={() => addToDesign(asset)} // ← Only this adds to design
        style={{
          cursor: 'pointer',
          borderRadius: '0px',
          overflow: 'hidden',
          height: '100%',
          position: 'relative',
          boxShadow: 'var(--canva-shadow-card-default)',
          backgroundColor: 'var(--canva-color-fill-secondary)',
          filter: isSelected ? 'none' : selectedAsset ? 'blur(2px)' : 'none',
          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
          zIndex: isSelected ? 10 : 1,
          transition: 'filter 0.3s ease, transform 0.2s ease',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {renderContent()}

        {/* Three-dot menu (only for image/video) */}
        {(asset.type === 'IMAGE' || asset.type === 'VIDEO') && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              pointerEvents: isHovered ? 'auto' : 'none',
            }}
          >
            <MoreHorizontalIcon
              size="small"
              color="tertiary"
              onClick={(e) => {
                e.stopPropagation(); // ✅ CRITICAL: prevents addToDesign
                handleSelectAsset(e, asset);
              }}
            />
          </div>
        )}

        {/* Info Panel */}
        {isSelected && (
          <div
            className="asset-info-panel"
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              background: 'white',
              padding: '12px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxWidth: '260px',
              zIndex: 20,
              fontSize: '13px',
            }}
          >
            <Text variant="small" weight="bold" style={{ marginBottom: '4px' }}>
              {asset.name || 'Untitled'}
            </Text>
            <Text variant="xsmall" tone="tertiary" style={{ marginBottom: '8px' }}>
              From Cloudinary • {asset.public_id?.split('/')[0] || 'Unknown'}
            </Text>

            {asset.tags && asset.tags.length > 0 && (
              <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {asset.tags.slice(0, 5).map((tag, idx) => (
                  <Pill key={idx} size="small" tone="info">
                    {tag}
                  </Pill>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button size="small" variant="tertiary" onClick={() => setSelectedAsset(null)}>
                Close
              </Button>
              <Button
                size="small"
                variant="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  addToDesign(asset);
                }}
              >
                Add to Design
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Loading placeholders ---
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
        let w = 400, h = 300;
        if (index % 3 === 0) h = 500;
        else if (index % 5 === 0) { w = 350; h = 350; }
        return (
          <MasonryItem targetWidthPx={w} targetHeightPx={h} key={`loading-${index}`}>
            <LoadingPlaceholderCard />
          </MasonryItem>
        );
      })}
    </Masonry>
  );

  // --- Render ---
return (
  <Rows spacing="2u" style={{ height: '100vh', padding: '12px' }}>
        <div style={{ marginTop: '8px' }}>

    <SearchInputMenu
      placeholder="Search images, videos, audio..."
      value={searchText}
      onChange={(value) => handleInputChange(value)}
      onClear={() => {
        setSearchText('');
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => searchAssets('', undefined, true), 500);
      }}
    />
    </div>
    <Rows spacing="1u" style={{ flex: 1, overflow: 'auto' }}>
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
              <AssetCard asset={asset} />
            </MasonryItem>
          ))}
        </Masonry>
      )}

      {hasMore && !loading && assets.length > 0 && (
        <div ref={loaderRef} style={{ height: '1px' }} />
      )}

      {loading && assets.length > 0 && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Text tone="secondary">Loading more media...</Text>
        </div>
      )}
    </Rows>
  </Rows>
);
}