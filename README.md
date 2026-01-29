# JCD Lineginery - High-Performance Contour & Terrain Visualization

This project is a high-performance Contour & Terrain Visualization Web App built with React (Vite), Tailwind CSS, Mapbox GL JS, Three.js, Turf.js, and Zustand.

## Features

- **State Management (Zustand)**: Synchronized global GIS states (center, zoom, pitch, bearing, contour interval).
- **2D/3D Dual-View Engine**:
  - **2D View**: Topographic base map with dynamic contours generated via Turf.js.
  - **3D View**: Mapbox 3D terrain with Three.js custom layer integration.
- **Contour Logic**: Dynamic contour generation based on viewport and elevation data.
- **Three.js Integration**: Custom layer rendering 3D objects synchronized with Mapbox camera.
- **Split-Screen Mode**: Side-by-side comparison of 2D and 3D views.
- **Telemetry Overlay**: Real-time display of coordinates, elevation, and slope.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Mapbox Token**:
    This app requires a Mapbox Access Token.
    Create a `.env` file in the root directory:
    ```
    VITE_MAPBOX_TOKEN=your_mapbox_token_here
    ```
    Or replace the placeholder in `src/components/MapBoxContainer.tsx`.

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Build**:
    ```bash
    npm run build
    ```

## Architecture

- `src/store/useMapStore.ts`: Global state management.
- `src/components/MapBoxContainer.tsx`: Main map component handling 2D/3D modes and sync.
- `src/components/ContourLayer.tsx`: Component for generating and rendering contours.
- `src/components/ThreeScene.tsx`: Three.js custom layer implementation.
- `src/utils/TurfContourProvider.ts`: Utility for generating contours using Turf.js.
