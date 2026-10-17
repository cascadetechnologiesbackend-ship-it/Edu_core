"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface BusLiveMapProps {
  busPosition: { lat: number; lng: number; speed?: number } | null;
  studentStop: { lat: number; lng: number; name: string } | null;
  routeStops?: Array<{ id: string; lat: number; lng: number; name: string; stopOrder: number }>;
  height?: string;
  zoom?: number;
  interactive?: boolean;
}

// Auto-recenter / fit bounds between bus and student stop
function MapBoundsUpdater({
  busPos,
  stopPos,
}: {
  busPos: [number, number] | null;
  stopPos: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    try {
      if (busPos && stopPos) {
        const bounds = L.latLngBounds([busPos, stopPos]);
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      } else if (busPos) {
        map.setView(busPos, 14);
      } else if (stopPos) {
        map.setView(stopPos, 14);
      }
    } catch {
      // Map may be unmounting
    }
  }, [map, busPos?.[0], busPos?.[1], stopPos?.[0], stopPos?.[1]]);

  return null;
}

// SVG Bus Marker with animated pulse
const createBusIcon = (speedKmh: number = 0) =>
  L.divIcon({
    className: "custom-bus-live-icon",
    html: `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.35);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #059669;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"></path>
            <path d="M16 6v6"></path>
            <path d="M2 12h20"></path>
            <path d="M4 18h16"></path>
            <rect width="18" height="16" x="3" y="3" rx="2"></rect>
            <path d="M6 18v2"></path>
            <path d="M18 18v2"></path>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

// Student Designated Stop Marker
const createStudentStopIcon = () =>
  L.divIcon({
    className: "custom-student-stop-icon",
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1e40af;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

// General Stop Icon
const createNumberedStopIcon = (order: number) =>
  L.divIcon({
    className: "custom-numbered-stop-icon",
    html: `
      <div style="
        background: #64748b;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 10px;
        border: 1.5px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      ">
        ${order}
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

export default function BusLiveMap({
  busPosition,
  studentStop,
  routeStops = [],
  height = "180px",
  zoom = 13,
  interactive = true,
}: BusLiveMapProps) {
  const defaultCenter: [number, number] = [
    busPosition?.lat || studentStop?.lat || 28.6139,
    busPosition?.lng || studentStop?.lng || 77.209,
  ];

  const busLatLng: [number, number] | null = busPosition
    ? [busPosition.lat, busPosition.lng]
    : null;
  const stopLatLng: [number, number] | null = studentStop
    ? [studentStop.lat, studentStop.lng]
    : null;

  // Build route polyline from stops that have valid coordinates
  const polylineCoords: [number, number][] = routeStops
    .filter((s) => s.lat != null && s.lng != null)
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .map((s) => [s.lat, s.lng]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={interactive}
        scrollWheelZoom={interactive}
        dragging={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route Polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            color="#059669"
            weight={3}
            opacity={0.65}
            dashArray="6, 8"
          />
        )}

        {/* Regular Route Stops */}
        {routeStops.map((stop) => {
          if (!stop.lat || !stop.lng) return null;
          const isStudentStop = studentStop && Math.abs(stop.lat - studentStop.lat) < 0.0001;
          if (isStudentStop) return null; // Rendered with dedicated student stop icon

          return (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createNumberedStopIcon(stop.stopOrder)}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">
                    Stop {stop.stopOrder}: {stop.name}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Student Stop Marker */}
        {stopLatLng && (
          <Marker position={stopLatLng} icon={createStudentStopIcon()}>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold text-blue-700">Your Child&apos;s Stop</div>
                <div className="text-slate-600">{studentStop?.name}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Bus Marker */}
        {busLatLng && (
          <Marker position={busLatLng} icon={createBusIcon(busPosition?.speed)}>
            <Popup>
              <div className="text-xs">
                <div className="font-bold text-emerald-700">School Bus</div>
                <div className="text-slate-600">
                  Speed: {Math.round(busPosition?.speed || 0)} km/h
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Bounds updater */}
        <MapBoundsUpdater busPos={busLatLng} stopPos={stopLatLng} />
      </MapContainer>
    </div>
  );
}
