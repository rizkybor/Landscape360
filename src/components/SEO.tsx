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
  title = 'Landscape 360 - Precision in Every Dimension',
  description = 'Explore the beauty of Indonesia, mountains, and tourist destinations in 3D. Find your favorite locations with Landscape 360.',
  keywords = '3d map, Indonesia, tourist destinations, mountains, landscape 360, interactive map, virtual tour',
  image = '/og-image.jpg', // Ensure you have this image in public folder
  url = 'https://landscape360.app', // Replace with actual domain
  type = 'website',
}) => {
  const siteTitle = title === 'Landscape 360 - Precision in Every Dimension' ? title : `${title} | Landscape 360`;

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
