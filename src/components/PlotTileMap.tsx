import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { ManagerPlot } from '../types/managerDashboard';
import type { Plot as FarmerPlot } from '../types/owner';
import {
  boundsFromPlot,
  layersFromPlot,
  type LatLngBoundsTuple,
  type PlotLayerKey,
} from '../utils/plotTiles';
import 'leaflet/dist/leaflet.css';

const OVERLAY_PANE = 'eeOverlay';

function EnsureOverlayPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane(OVERLAY_PANE)) {
      const pane = map.createPane(OVERLAY_PANE);
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
  }, [map]);
  return null;
}

function FitBounds({ bounds }: { bounds: LatLngBoundsTuple }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 });
  }, [bounds, map]);
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 50);
    const t2 = window.setTimeout(() => map.invalidateSize(), 300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map]);
  return null;
}

function OverlayWatcher({
  tileHostHint,
  onTileError,
  onTileLoad,
}: {
  tileHostHint: string;
  onTileError: () => void;
  onTileLoad: () => void;
}) {
  useMapEvents({
    tileerror: (e) => {
      const src = (e.tile as HTMLImageElement | undefined)?.src || '';
      if (tileHostHint && src.includes(tileHostHint)) onTileError();
    },
    tileload: (e) => {
      const src = (e.tile as HTMLImageElement | undefined)?.src || '';
      if (tileHostHint && src.includes(tileHostHint)) onTileLoad();
    },
  });
  return null;
}

function hostHintFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'earthengine';
  }
}

export function PlotTileMap({
  plot,
  farmerPlot,
}: {
  plot: ManagerPlot;
  farmerPlot?: FarmerPlot | null;
}) {
  const layers = useMemo(() => layersFromPlot(plot), [plot]);
  const bounds = useMemo(() => boundsFromPlot(plot, farmerPlot), [plot, farmerPlot]);
  const [active, setActive] = useState<PlotLayerKey | null>(null);
  const [overlayFailed, setOverlayFailed] = useState(false);
  const [overlayLoaded, setOverlayLoaded] = useState(false);

  useEffect(() => {
    setActive(layers[0]?.key ?? null);
  }, [plot.plot_name, layers]);

  const activeLayer = layers.find((l) => l.key === active) ?? layers[0] ?? null;

  useEffect(() => {
    setOverlayFailed(false);
    setOverlayLoaded(false);
  }, [activeLayer?.tileUrl, plot.plot_name]);

  const metaBits = [
    activeLayer?.imageDate ? `image ${activeLayer.imageDate}` : null,
    activeLayer?.imageCount != null ? `${activeLayer.imageCount} image(s)` : null,
  ].filter(Boolean);

  if (layers.length === 0) {
    return (
      <section className="plot-map-panel">
        <div className="plot-map-head">
          <h3 className="section-title">Field tiles</h3>
          <p className="muted">No tile_url in this plot’s API response.</p>
        </div>
      </section>
    );
  }

  if (!bounds) {
    return (
      <section className="plot-map-panel">
        <div className="plot-map-head">
          <h3 className="section-title">Field tiles</h3>
          <p className="muted">
            tile_url is present for {layers.map((l) => l.label).join(', ')}, but plot boundary /
            geometry is missing from the API — map cannot be positioned without endpoint AOI.
          </p>
        </div>
        <div className="plot-layer-tabs plot-layer-tabs-pad" role="tablist" aria-label="Map layers">
          {layers.map((layer) => (
            <span key={layer.key} className={`plot-layer-tab plot-layer-${layer.key}`}>
              {layer.label}
              {layer.imageDate ? ` · ${layer.imageDate}` : ''}
            </span>
          ))}
        </div>
      </section>
    );
  }

  const center: [number, number] = [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];

  const boundaryGeoJson = farmerPlot?.boundary
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: farmerPlot.boundary,
      }
    : null;

  const tileHint = activeLayer ? hostHintFromUrl(activeLayer.tileUrl) : '';

  return (
    <section className="plot-map-panel">
      <div className="plot-map-head">
        <div>
          <h3 className="section-title">Field tiles</h3>
          <p className="muted">
            Plot {plot.plot_name}
            {metaBits.length ? ` · ${metaBits.join(' · ')}` : ''}
          </p>
        </div>
        <div className="plot-layer-tabs" role="tablist" aria-label="Map layers">
          {layers.map((layer) => (
            <button
              key={layer.key}
              type="button"
              role="tab"
              aria-selected={activeLayer?.key === layer.key}
              className={`plot-layer-tab plot-layer-${layer.key} ${
                activeLayer?.key === layer.key ? 'active' : ''
              }`}
              onClick={() => setActive(layer.key)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {overlayFailed && !overlayLoaded ? (
        <div className="plot-map-alert" role="status">
          Response tile_url did not load tiles for this view. The map id may have expired — reload
          the farmer report.
        </div>
      ) : null}

      <div className="plot-map-frame">
        <MapContainer
          key={`${plot.plot_name}-${center[0].toFixed(5)}-${center[1].toFixed(5)}`}
          center={center}
          zoom={16}
          className="plot-map"
          scrollWheelZoom
          maxZoom={20}
        >
          <EnsureOverlayPane />
          {/* Basemap is context only — heatmap colors come only from API tile_url rasters */}
          <TileLayer
            attribution="Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            opacity={0.4}
            maxZoom={20}
            className="basemap-tiles"
          />
          {activeLayer ? (
            <TileLayer
              key={activeLayer.tileUrl}
              url={activeLayer.tileUrl}
              pane={OVERLAY_PANE}
              opacity={1}
              maxZoom={20}
              maxNativeZoom={20}
              className="ee-overlay-tiles"
            />
          ) : null}
          {boundaryGeoJson ? (
            <GeoJSON
              key={`aoi-${plot.plot_name}`}
              data={boundaryGeoJson}
              style={{
                color: '#0f3d2e',
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0,
              }}
            />
          ) : null}
          <FitBounds bounds={bounds} />
          <InvalidateSize />
          {activeLayer ? (
            <OverlayWatcher
              tileHostHint={tileHint}
              onTileError={() => setOverlayFailed(true)}
              onTileLoad={() => {
                setOverlayLoaded(true);
                setOverlayFailed(false);
              }}
            />
          ) : null}
        </MapContainer>
      </div>
    </section>
  );
}
