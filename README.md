# Landscape 360 - Professional Terrain Visualization Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-green.svg)
![Status](https://img.shields.io/badge/status-production-orange.svg)

**Landscape 360** is a high-performance, web-based geospatial analysis platform designed for professionals. It combines precision 3D mapping, real-time contour generation, and advanced survey tools into a seamless browser experience.

## 🚀 Key Features

### 🌍 Advanced Visualization
- **Dual-View Engine**: Seamlessly switch between **2D Topographic** and **3D Terrain** modes.
- **Dynamic Contours**: Real-time client-side contour generation using `Turf.js` based on viewport elevation data.
- **Multi-Style Maps**: Switch between **Streets** (Vector), **Outdoors** (Topo), and **Satellite Streets** (Imagery) for versatile context.
- **Split-Screen Mode**: Compare 2D and 3D perspectives side-by-side with synchronized camera movement.

### 📍 Navigation & Survey
- **Instant Geolocation**: "Start Here" feature with pre-emptive GPS fetching and zero-delay jump logic.
- **Navigator Mode**: Precision plotting tools with real-time **Distance**, **Azimuth**, and **Slope** calculations.
- **Optimized Controls**:
  - **Desktop**: Smooth scroll zoom (1/600 rate), inertia-based panning, and orbit controls.
  - **Mobile**: Touch-optimized with pinch-to-zoom centering, stable rotation, and simplified 2D gestures.

### ⚡ Performance First
- **Mobile Optimization**:
  - Adaptive pixel ratio (max 1.5x) for battery saving.
  - Reduced polygon count and simplified shaders for 3D markers on mobile devices.
  - Optimized `backdrop-blur` effects to reduce GPU load.
- **State Persistence**: User preferences (Map Style, View Mode, Camera Position) are automatically saved via `Zustand` middleware.

## 🛠️ Tech Stack

- **Core**: React 18, TypeScript, Vite
- **Mapping**: Mapbox GL JS, Three.js (Custom Layer Integration)
- **Geospatial Analysis**: Turf.js
- **State Management**: Zustand (with Persist middleware)
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Backend/Data**: Supabase (PostgreSQL + PostGIS)

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/landscape-360.git
    cd landscape-360
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory:
    ```env
    VITE_MAPBOX_TOKEN=your_pk.eyJ...
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_key
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

5.  **Build for Production**:
    ```bash
    npm run build
    ```

## 📱 Mobile Support

Landscape 360 is fully responsive and optimized for mobile devices. It automatically detects the device type to adjust rendering quality, ensuring smooth performance even on mid-range smartphones.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Developed by <strong>Rizky Ajie Kurniawan</strong> • Jakarta, Indonesia
</p>
