import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export const SEO: React.FC<SEOProps> = ({
  title = 'Landscape 360 - Jelajahi Indonesia dalam 3D',
  description = 'Jelajahi keindahan alam Indonesia, gunung, dan lokasi wisata dalam tampilan 3D interaktif. Temukan lokasi favoritmu dengan Landscape 360.',
  keywords = 'peta 3d, indonesia, wisata indonesia, gunung indonesia, landscape 360, peta interaktif, virtual tour',
  image = '/og-image.jpg', // Ensure you have this image in public folder
  url = 'https://landscape360.app', // Replace with actual domain
  type = 'website',
}) => {
  const siteTitle = title === 'Landscape 360 - Jelajahi Indonesia dalam 3D' ? title : `${title} | Landscape 360`;

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};
