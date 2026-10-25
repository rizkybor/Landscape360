import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  /** Extra JSON-LD for this page (e.g. FAQPage, real AggregateRating) */
  structuredData?: Record<string, unknown>[];
}

const SITE = 'https://landscape360.jcdigital.co.id';

export const SEO: React.FC<SEOProps> = ({
  title = 'Landscape 360 | Explore without Limits',
  description = 'Your ultimate companion for outdoor adventures. Advanced 3D land navigation, real-time GPS tracking, and reliable offline maps for hikers, climbers, and explorers.',
  keywords = 'land navigation, real-time tracking, offline maps, 3d terrain, hiking maps, mountaineering, orienteering, outdoor exploration, gps tracker, topographic map, contour lines, slope analysis, route planner, wilderness navigation, peta gunung indonesia, pendaki gunung, makopala, landscape 360, custom basemaps, offline gps, broadcast location, team monitoring, sar tool, search and rescue',
  image = 'https://landscape360.jcdigital.co.id/og-image.jpg',
  url = `${SITE}/`,
  type = 'website',
  structuredData: extra = [],
}) => {
  const siteTitle = title === 'Landscape 360 | Explore without Limits' ? title : `${title} | Landscape 360`;

  // Only facts Google can verify on the site: no made-up ratings or site search. Pages
  // that have real data (FAQ, reviews) add their own blocks through `structuredData`.
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#app`,
      "name": "Landscape 360",
      "alternateName": "Landscape360",
      "operatingSystem": "Web, Android, iOS",
      "applicationCategory": "TravelApplication",
      "browserRequirements": "Requires JavaScript and WebGL",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "IDR"
      },
      "description": description,
      "image": image,
      "url": `${SITE}/`,
      "inLanguage": "en",
      "featureList": [
        "2D and 3D terrain maps with contour lines",
        "Offline maps",
        "GPS tracking and track recording (GPX)",
        "Marked locations with sharing",
        "Route planner and weather",
        "Custom GeoTIFF / PDF basemaps",
        "S.O.S emergency screen"
      ],
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
      "publisher": { "@id": "https://jcdigital.co.id/#org" }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://jcdigital.co.id/#org",
      "name": "Jendela Cakra Digital",
      "url": "https://jcdigital.co.id",
      "logo": `${SITE}/android-chrome-512x512.png`,
      "email": "contact@jcdigital.co.id",
      "sameAs": ["https://instagram.com/jcdigital.co.id"]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      "name": "Landscape 360",
      "url": `${SITE}/`,
      "publisher": { "@id": "https://jcdigital.co.id/#org" },
      "inLanguage": "en"
    },
    ...extra,
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
      <meta property="og:image:alt" content="Landscape 360: 3D terrain map with contour lines" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:locale:alternate" content="id_ID" />

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
