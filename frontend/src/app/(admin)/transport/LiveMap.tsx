"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface RouteStop {
  id: string;
  stopName: string;
  stopOrder: number;
  gpsLatitude?: string | null;
  gpsLongitude?: string | null;
  estimatedArrivalTime?: string | null;
}

interface LiveMapProps {
  stops: RouteStop[];
  busPosition: { lat: number; lng: number; speed?: number } | null;
  center?: [number, number];
  zoom?: number;
  height?: string;
}

// Custom Leaflet Icons using DivIcon for modern SVG styling
const createStopIcon = (order: number) =>
  L.divIcon({
    className: "custom-stop-icon",
    html: `
      <div style="
        background: #4f46e5;
        color: white;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        ${order}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const busIcon = L.divIcon({
  className: "custom-bus-icon",
  html: `
    <div style="position: relative; width: 38px; height: 38px;">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.3);
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative;
        background: #ef4444;
        color: white;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(239,68,68,0.4);
      ">
        🚌
      </div>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

// Component to dynamically re-center map when bus position changes
function MapRecenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (position && !isNaN(position[0]) && !isNaN(position[1])) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

export default function LiveMap({
  stops,
  busPosition,
  center = [18.5204, 73.8567], // Pune/Indian default fallback
  zoom = 13,
  height = "460px",
}: LiveMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ height }}
        className="w-full rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-sm font-medium"
      >
        Initializing OpenStreetMap...
      </div>
    );
  }

  // Filter valid stop coords
  const validStops = stops.filter(
    (s) =>
      s.gpsLatitude &&
      s.gpsLongitude &&
      !isNaN(parseFloat(s.gpsLatitude)) &&
      !isNaN(parseFloat(s.gpsLongitude))
  );

  const polylinePositions: [number, number][] = validStops.map((s) => [
    parseFloat(s.gpsLatitude!),
    parseFloat(s.gpsLongitude!),
  ]);

  // Determine initial center
  const initialCenter: [number, number] = busPosition
    ? [busPosition.lat, busPosition.lng]
    : polylinePositions[0] ?? center;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-lg">
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {busPosition && (
          <MapRecenter position={[busPosition.lat, busPosition.lng]} />
        )}

        {/* Route Path Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#4f46e5",
              weight: 5,
              opacity: 0.85,
              dashArray: "8, 6",
            }}
          />
        )}

        {/* Stops Markers */}
        {validStops.map((stop) => (
          <Marker
            key={stop.id}
            position={[
              parseFloat(stop.gpsLatitude!),
              parseFloat(stop.gpsLongitude!),
            ]}
            icon={createStopIcon(stop.stopOrder)}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-gray-900">
                  Stop #{stop.stopOrder}: {stop.stopName}
                </div>
                {stop.estimatedArrivalTime && (
                  <div className="text-indigo-600 font-semibold">
                    ETA: {stop.estimatedArrivalTime}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live Bus Marker */}
        {busPosition && (
          <Marker
            position={[busPosition.lat, busPosition.lng]}
            icon={busIcon}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-red-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Live Bus Position
                </div>
                {busPosition.speed != null && (
                  <div className="text-gray-700">
                    Speed: {busPosition.speed.toFixed(1)} km/h
                  </div>
                )}
                <div className="text-[10px] text-gray-400">
                  Updated just now
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
