// QB BrandOS — OG image generator
// Renders a 1200×630 share card for "I just discovered my brand archetype" social posts.
// Usage: /api/og?brand=Verne&archetype=The%20Magician%20%2B%20The%20Sage&tool=Compass
// Powered by @vercel/og (Edge runtime).

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand     = (searchParams.get('brand')     || 'Your Brand').slice(0, 60);
  const archetype = (searchParams.get('archetype') || '').slice(0, 80);
  const tool      = (searchParams.get('tool')      || 'Brand Profile').slice(0, 40);
  const tagline   = (searchParams.get('tagline')   || '').slice(0, 140);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          color: '#ffffff',
          padding: '72px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle radial accent */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '60%',
            height: '70%',
            background:
              'radial-gradient(circle at center, rgba(74,222,128,0.18) 0%, rgba(74,222,128,0) 60%)',
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontFamily: 'monospace',
            fontSize: '16px',
            letterSpacing: '0.22em',
            color: '#4ade80',
            marginBottom: '36px',
            textTransform: 'uppercase',
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
          QUANTUM BRANDING · {tool.toUpperCase()}
        </div>

        {/* Brand name */}
        <div
          style={{
            display: 'flex',
            fontSize: brand.length > 24 ? '64px' : '84px',
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginBottom: '28px',
            color: '#ffffff',
          }}
        >
          {brand}
        </div>

        {/* Archetype line */}
        {archetype && (
          <div
            style={{
              display: 'flex',
              fontSize: '34px',
              lineHeight: 1.3,
              color: 'rgba(255,255,255,0.78)',
              marginBottom: '20px',
              fontStyle: 'italic',
              fontWeight: 400,
            }}
          >
            {archetype}
          </div>
        )}

        {/* Optional tagline */}
        {tagline && (
          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.55)',
              maxWidth: '880px',
            }}
          >
            {tagline}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '20px',
            color: 'rgba(255,255,255,0.42)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '24px',
          }}
        >
          <div style={{ display: 'flex' }}>quantumbranding.ai</div>
          <div style={{ display: 'flex', fontStyle: 'italic' }}>From idea to orbit.</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}
