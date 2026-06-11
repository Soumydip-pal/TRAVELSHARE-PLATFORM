import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const DEFAULT_CENTER = [22.5726, 88.3639];
const DEFAULT_ZOOM = 12;
const placeCache = new Map();

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function RoutingLayer({ origin, destination, onRoute }) {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (!origin?.lat || !destination?.lat) return undefined;

    if (controlRef.current) map.removeControl(controlRef.current);

    const control = L.Routing.control({
      waypoints: [L.latLng(origin.lat, origin.lng), L.latLng(destination.lat, destination.lng)],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      lineOptions: {
        styles: [{ color: "#0084ff", weight: 5, opacity: 0.82 }],
      },
      createMarker: () => null,
    }).addTo(map);

    control.on("routesfound", (event) => {
      const route = event.routes?.[0];
      if (!route) return;
      const coordinates = route.coordinates.map((point) => [point.lng, point.lat]);
      onRoute({
        distanceKm: Math.round((route.summary.totalDistance / 1000) * 10) / 10,
        durationMin: Math.max(1, Math.round(route.summary.totalTime / 60)),
        routeLine: { type: "LineString", coordinates },
      });
    });

    controlRef.current = control;
    return () => {
      if (controlRef.current) {
        controlRef.current.off();
        map.removeControl(controlRef.current);
      }
      controlRef.current = null;
    };
  }, [map, origin, destination, onRoute]);

  return null;
}

function ClickHandler({ activePoint, onPick }) {
  useMapEvents({
    click(event) {
      onPick(activePoint, event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

async function reverseGeocode(lat, lng) {
  const key = `rev:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
  );
  const data = await res.json();
  const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  placeCache.set(key, address);
  return address;
}

async function searchPlace(query, city) {
  const key = `search:${query.trim().toLowerCase()}:${city || ""}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(`${query}, ${city || ""}`)}`
  );
  const data = await res.json();
  if (!data?.[0]) return null;
  const place = {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    address: data[0].display_name,
  };
  placeCache.set(key, place);
  return place;
}

export default function RouteMapPicker({ city, value, onChange, compact = false }) {
  const [activePoint, setActivePoint] = useState("origin");
  const [searching, setSearching] = useState(false);
  const mapCenter = useMemo(() => {
    if (value?.origin?.lat) return [value.origin.lat, value.origin.lng];
    return DEFAULT_CENTER;
  }, [value?.origin?.lat, value?.origin?.lng]);

  const setPoint = async (point, lat, lng, address) => {
    const nextAddress = address || await reverseGeocode(lat, lng).catch(() => `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    onChange({
      ...value,
      [point]: { lat, lng, address: nextAddress },
    });
  };

  const handleSearch = async (point) => {
    const query = value?.[point]?.address;
    if (!query?.trim()) return;
    setSearching(true);
    try {
      const place = await searchPlace(query, city);
      if (place) await setPoint(point, place.lat, place.lng, place.address);
    } finally {
      setSearching(false);
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setPoint(activePoint, pos.coords.latitude, pos.coords.longitude);
    });
  };

  return (
    <div className="route-picker">
      <div className="route-fields">
        {["origin", "destination"].map((point) => (
          <div className="form-group" key={point}>
            <label>{point === "origin" ? "Origin" : "Destination"}</label>
            <div className={`location-input ${activePoint === point ? "active" : ""}`}>
              <input
                value={value?.[point]?.address || ""}
                onFocus={() => setActivePoint(point)}
                onChange={(event) => onChange({ ...value, [point]: { ...(value?.[point] || {}), address: event.target.value } })}
                placeholder={point === "origin" ? "Search pickup location" : "Search drop location"}
                required
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSearch(point)} disabled={searching}>
                Search
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={compact ? "route-map compact" : "route-map"}>
        <MapContainer center={mapCenter} zoom={DEFAULT_ZOOM} scrollWheelZoom className="leaflet-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler activePoint={activePoint} onPick={setPoint} />
          {value?.origin?.lat && (
            <Marker
              position={[value.origin.lat, value.origin.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{ dragend: (event) => {
                const p = event.target.getLatLng();
                setPoint("origin", p.lat, p.lng);
              } }}
            />
          )}
          {value?.destination?.lat && (
            <Marker
              position={[value.destination.lat, value.destination.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{ dragend: (event) => {
                const p = event.target.getLatLng();
                setPoint("destination", p.lat, p.lng);
              } }}
            />
          )}
          <RoutingLayer origin={value?.origin} destination={value?.destination} onRoute={(route) => onChange({ ...value, ...route })} />
        </MapContainer>
        <div className="map-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={locateMe}>Use current location</button>
          <span>{activePoint === "origin" ? "Picking origin" : "Picking destination"}</span>
        </div>
      </div>

      {(value?.distanceKm || value?.durationMin) && (
        <div className="route-summary">
          <span>{value.distanceKm || "--"} km</span>
          <span>{value.durationMin || "--"} min</span>
        </div>
      )}
    </div>
  );
}
