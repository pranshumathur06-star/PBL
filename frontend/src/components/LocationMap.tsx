import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

interface Props {
  position: { lat: number; lng: number } | null;
  onSelect: (lat: number, lng: number) => void;
}

const icon = L.divIcon({
  className: "",
  html: '<div style="background:#ef4444;width:20px;height:20px;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #000"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapClick({ onSelect }: { onSelect: Props["onSelect"] }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

function MapUpdater({ position }: { position: Props["position"] }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], 15);
    }
  }, [position, map]);

  return null;
}

export default function LocationMap({ position, onSelect }: Props) {
  const center: [number, number] = position
    ? [position.lat, position.lng]
    : [30.3165, 78.0322];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "300px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClick onSelect={onSelect} />
        <MapUpdater position={position} />

        {position && (
          <Marker position={[position.lat, position.lng]} icon={icon} />
        )}
      </MapContainer>
    </div>
  );
}
