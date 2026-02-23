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
  title = 'Landscape 360 | Navigate, Track, Explore',
  description = 'Your ultimate companion for outdoor adventures. Advanced 3D land navigation, real-time GPS tracking, and reliable offline maps for hikers, climbers, and explorers.',
  keywords = 'land navigation, real-time tracking, offline maps, 3d terrain, hiking maps, mountaineering, orienteering, outdoor exploration, gps tracker, topographic map, contour lines, slope analysis, route planner, wilderness navigation, peta gunung indonesia, pendaki gunung, makopala, landscape 360, custom basemaps, offline gps, broadcast location, team monitoring, sar tool, search and rescue',
  image = 'https://landscape360.jcdigital.co.id/og-image.jpg',
  url = 'https://landscape360.jcdigital.co.id/',
  type = 'website',
}) => {
  const siteTitle = title === 'Landscape 360 | Navigate, Track, Explore' ? title : `${title} | Landscape 360`;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Landscape 360",
      "operatingSystem": "Web",
      "applicationCategory": "GeospatialApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "IDR"
      },
      "description": description,
      "image": image,
      "url": url,
      "author": {
        "@type": "Person",
        "name": "Rizky Ajie Kurniawan",
        "url": "https://github.com/rizkyajie"
      },
      "contributor": {
        "@type": "Organization",
        "name": "Makopala Universitas Budi Luhur",
        "url": "https://makopala.budiluhur.ac.id"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Jendela Cakra Digital",
        "url": "https://jcdigital.co.id"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "120"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Landscape 360",
      "url": "https://landscape360.jcdigital.co.id/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://landscape360.jcdigital.co.id/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ];

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={url} />
      <meta name="author" content="Rizky Ajie Kurniawan" />
      <meta name="theme-color" content="#0f172a" />
      <meta name="robots" content="index, follow" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Landscape 360" />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content="Landscape 360 Application Interface" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:creator" content="@jcdigital" />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};
