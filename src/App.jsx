import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import 'leaflet/dist/leaflet.css';
import './App.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { GeoJSON } from 'react-leaflet';
import karnatakaDistricts from './assets/karnataka_districts.json';
import { GEOJSON_TO_DB_NAME } from './utils/districtNameMap';
import { useLangStrings } from './translations';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import LoginPage from './LoginPage';
import { ShieldCheck, BadgeCheck, MapPin, Building2, LogOut, ChevronDown } from 'lucide-react';
const ROLE_CONFIG = {
  Admin: { tabs: ['dashboard', 'priority', 'network', 'knowledge', 'patrol'] },
  Administrator: { tabs: ['dashboard', 'priority', 'network', 'knowledge', 'patrol'] },
  'Police Officer': { tabs: ['dashboard', 'priority', 'network', 'knowledge', 'patrol'] },
  'Crime Analyst': { tabs: ['dashboard', 'priority', 'network'] },
  Investigator: { tabs: ['dashboard', 'priority', 'network', 'knowledge', 'patrol'] },
  Analyst: { tabs: ['dashboard', 'priority', 'network'] },
  Supervisor: { tabs: ['dashboard', 'priority', 'network', 'knowledge', 'patrol'] },
  Policymaker: { tabs: ['dashboard', 'priority'] },
};
const FUNCTIONS_BASE = 'https://ksp-fir-platform-60073928681.development.catalystserverless.in/server';

const STATUS_COLORS = {
  'Under Investigation': '#D9A441',
  'Chargesheeted': '#4A7FB5',
  'Closed': '#5FA88C'
};
const SUGGESTED_QUESTIONS = [
  'How many theft cases are there in Bengaluru Urban?',
  'Compare Mysuru and Mangaluru crime statistics',
  'Which areas need CCTV cameras the most?',
  'How many cases are still under investigation?',
  'ಗದಗದಲ್ಲಿ ಎಷ್ಟು ಕಳ್ಳತನ ಪ್ರಕರಣಗಳಿವೆ?'
];
const KARNATAKA_BOUNDS = [
  [11.5, 74.0],
  [18.5, 78.6]
];

const RISK_HIGH = '#D94F4F';
const RISK_MED = '#E08A3E';
const RISK_LOW = '#5FA88C';
const CASE_NODE_COLOR = '#4A7FB5';
const FADE_COLOR = 'rgba(139, 150, 170, 0.12)';
const FADE_LINK_COLOR = 'rgba(139, 150, 170, 0.06)';

const AI_STAGES = [
  'Connecting to AI...',
  'Searching crime database...',
  'Analyzing patterns...',
  'Generating recommendations...'
];

function getRiskColor(riskScore) {
  if (riskScore >= 80) return RISK_HIGH;
  if (riskScore >= 50) return RISK_MED;
  return RISK_LOW;
}

const DB_TO_GEOJSON_NAME = Object.fromEntries(
  Object.entries(GEOJSON_TO_DB_NAME).map(([geoName, dbName]) => [dbName, geoName])
);

function ClusterLayer({ cases }) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true
    });

    cases.forEach(c => {
      if (!c.latitude || !c.longitude) return;
      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius: 8,
        color: STATUS_COLORS[c.status] || '#8B96AA',
        fillColor: STATUS_COLORS[c.status] || '#8B96AA',
        fillOpacity: 0.7
      });
      marker.bindPopup(
        `<div class="mono">${c.firNumber}</div><div>${c.crimeType}</div><div>${c.status}</div><div>${c.dateOfFIR}</div><button onclick="window.viewCourtHistory('${c.rowId}')" style="margin-top:6px;padding:4px 8px;cursor:pointer;">View Court History</button>`
      );
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [cases, map]);

  return null;
}
function DistrictBoundaries({ selectedDistrictName }) {
  const map = useMap();

  const style = (feature) => {
    const isSelected = feature.properties.district_name === selectedDistrictName;
    return {
      color: isSelected ? '#D9A441' : '#4A7FB5',
      weight: isSelected ? 3 : 1,
      fillOpacity: isSelected ? 0.15 : 0.02,
      fillColor: isSelected ? '#D9A441' : '#4A7FB5'
    };
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties.district_name === selectedDistrictName) {
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    }
  };

  return (
    <GeoJSON
      key={selectedDistrictName || 'all'}
      data={karnatakaDistricts}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
// Adaptive density clustering, shared by the map's HotspotZoneLayer and the
// Top Hotspots ranked list — so both always agree on what counts as a hotspot.
function computeCrimeClusters(cases, options = {}) {
  const {
    MIN_CELL_SIZE_KM = 0.8,
    MAX_CELL_SIZE_KM = 4.0,
    MIN_CASES_PER_HOTSPOT = 5,
    MAX_HOTSPOT_RADIUS_KM = 6
  } = options;

  const points = (cases || []).filter(c => c.latitude && c.longitude);
  if (points.length === 0) return [];

  const toRad = d => d * Math.PI / 180;
  const distKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const lats = points.map(c => c.latitude), lons = points.map(c => c.longitude);
  const latSpanKm = distKm(Math.min(...lats), 0, Math.max(...lats), 0);
  const lonSpanKm = distKm(0, Math.min(...lons), 0, Math.max(...lons));
  const areaKm2 = Math.max(1, latSpanKm * lonSpanKm);
  const density = points.length / areaKm2;

  const rawCellSizeKm = 2.2 / Math.sqrt(Math.max(density, 0.02));
  const cellSizeKm = Math.min(MAX_CELL_SIZE_KM, Math.max(MIN_CELL_SIZE_KM, rawCellSizeKm));
  const cellSizeDeg = cellSizeKm / 111;

  const cellOf = (lat, lon) => ({ row: Math.floor(lat / cellSizeDeg), col: Math.floor(lon / cellSizeDeg) });
  const cellStats = new Map();
  points.forEach(c => {
    const { row, col } = cellOf(c.latitude, c.longitude);
    const key = `${row}|${col}`;
    if (!cellStats.has(key)) {
      cellStats.set(key, { row, col, count: 0, latSum: 0, lonSum: 0, points: [] });
    }
    const cell = cellStats.get(key);
    cell.count += 1;
    cell.latSum += c.latitude;
    cell.lonSum += c.longitude;
    cell.points.push(c);
  });

  const visited = new Set();
  const clusters = [];
  for (const cell of cellStats.values()) {
    const key = `${cell.row}|${cell.col}`;
    if (visited.has(key)) continue;
    const cluster = { count: cell.count, latSum: cell.latSum, lonSum: cell.lonSum, points: [...cell.points] };
    visited.add(key);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nKey = `${cell.row + dr}|${cell.col + dc}`;
        if (visited.has(nKey)) continue;
        const neighbor = cellStats.get(nKey);
        if (!neighbor) continue;
        cluster.count += neighbor.count;
        cluster.latSum += neighbor.latSum;
        cluster.lonSum += neighbor.lonSum;
        cluster.points.push(...neighbor.points);
        visited.add(nKey);
      }
    }
    if (cluster.count >= MIN_CASES_PER_HOTSPOT) {
      const centroidLat = cluster.latSum / cluster.count;
      const centroidLon = cluster.lonSum / cluster.count;
      const clusterPoints = cluster.points.filter(p => distKm(centroidLat, centroidLon, p.latitude, p.longitude) <= MAX_HOTSPOT_RADIUS_KM);
      const maxDistKm = Math.min(
        MAX_HOTSPOT_RADIUS_KM,
        Math.max(0.3, ...clusterPoints.map(p => distKm(centroidLat, centroidLon, p.latitude, p.longitude)))
      );
      clusters.push({
        count: cluster.count,
        centroidLat,
        centroidLon,
        radiusKm: maxDistKm,
        points: clusterPoints
      });
    }
  }

  return clusters;
}

function HotspotZoneLayer({ cases, selectedDistrict, showHotspotZones }) {
  const map = useMap();

  useEffect(() => {
    if (document.getElementById('hotspot-zone-styles')) return;
    const style = document.createElement('style');
    style.id = 'hotspot-zone-styles';
    style.textContent = `
      .hotspot-zone-ring {
        transform-box: fill-box;
        transform-origin: center;
        pointer-events: none;
        filter: blur(6px);
      }
      .hotspot-zone-ring--outer { animation: hotspot-pulse 3s ease-out infinite; }
      .hotspot-zone-ring--mid   { animation: hotspot-pulse 3s ease-out infinite; animation-delay: 0.6s; }
      @keyframes hotspot-pulse {
        0%   { transform: scale(0.9); opacity: 0.85; }
        70%  { transform: scale(1.1); opacity: 0.25; }
        100% { transform: scale(1.2); opacity: 0.1; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
   if (!showHotspotZones || !selectedDistrict || !cases || cases.length === 0) return;
  const clusters = computeCrimeClusters(cases);

  if (clusters.length === 0) return;

  const layerGroup = L.layerGroup();
  const maxCount = Math.max(...clusters.map(c => c.count));

    clusters.forEach(cluster => {
    const radiusM = Math.max(300, cluster.radiusKm * 1000 * 1.15);
    const intensity = Math.min(1, cluster.count / Math.max(10, maxCount));
    const color = `rgb(${Math.round(255 - intensity * 45)}, ${Math.round(90 - intensity * 60)}, ${Math.round(70 - intensity * 55)})`;
    const latlng = [cluster.centroidLat, cluster.centroidLon];

    [
      { mult: 1.0, opacity: 0.10 + intensity * 0.08, cls: 'hotspot-zone-ring hotspot-zone-ring--outer' },
      { mult: 0.7, opacity: 0.16 + intensity * 0.12, cls: 'hotspot-zone-ring hotspot-zone-ring--mid' },
      { mult: 0.45, opacity: 0.22 + intensity * 0.16, cls: 'hotspot-zone-ring' },
      { mult: 0.22, opacity: 0.30 + intensity * 0.2, cls: 'hotspot-zone-ring' }
    ].forEach(ring => {
      L.circle(latlng, {
        radius: radiusM * ring.mult,
        weight: 0,
        fillColor: color,
        fillOpacity: ring.opacity,
        className: ring.cls,
        interactive: false
      }).addTo(layerGroup);
    });
  });

  layerGroup.addTo(map);
  return () => { map.removeLayer(layerGroup); };
}, [cases, selectedDistrict, showHotspotZones, map]);
  return null;
}

function SelectedHotspotBoundary({ hotspot }) {
  const map = useMap();
  useEffect(() => {
    if (!hotspot) return;
    const circle = L.circle([hotspot.centroidLat, hotspot.centroidLon], {
      radius: hotspot.radiusKm * 1000,
      color: '#D9A441',
      weight: 2,
      dashArray: '8, 6',
      fill: false,
      interactive: false
    }).addTo(map);
    return () => { map.removeLayer(circle); };
  }, [hotspot, map]);
  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.centroidLat, target.centroidLon], 12, { duration: 1.2 });
  }, [target, map]);
  return null;
}

function NoCctvAreasLayer({ cctvData }) {
  const map = useMap();

  useEffect(() => {
    const noCctvUnits = (cctvData?.hotspots || []).filter(
      u => !u.hasCCTV && isFinite(u.centroidLat) && isFinite(u.centroidLon)
    );

    if (noCctvUnits.length === 0) return;

    const markers = noCctvUnits.map(u => {
      const marker = L.circleMarker([u.centroidLat, u.centroidLon], {
        radius: 9,
        color: '#fff',
        weight: 1.5,
        fillColor: '#D94F4F',
        fillOpacity: 0.85
      });
      marker.bindPopup(
        `<div class="mono" style="font-weight:bold;">No CCTV Coverage</div><div>${u.caseCount} case(s) recorded</div><div>Severity score: ${u.severityScore}</div>`
      );
      return marker;
    });

    const group = L.layerGroup(markers).addTo(map);

    // Fit the map to exactly these markers so the investigator sees them
    // immediately, without disturbing the rest of the map's normal state.
    const bounds = L.latLngBounds(noCctvUnits.map(u => [u.centroidLat, u.centroidLon]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    return () => {
      map.removeLayer(group);
    };
  }, [cctvData, map]);

  return null;
}

function CctvLayer({ cctvData, showCctv, showRecommendations, activeCameras, showActiveCameras }) {
 const map = useMap();

  useEffect(() => {
    const layerGroup = L.layerGroup();

        const PRIORITY_ICON_COLORS = { High: '#A6231F', Low: '#4A7FB5' };

    function makeRecommendIcon(priority) {
      const color = PRIORITY_ICON_COLORS[priority] || '#4A7FB5';
      return L.divIcon({
        html: `<div class="cctv-recommend-marker" style="width:34px;height:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
          <svg width="34" height="34" viewBox="0 0 40 40">
            <path d="M20 2 L36 8 V18 C36 28 29 35 20 38 C11 35 4 28 4 18 V8 Z" fill="${color}" stroke="white" stroke-width="1.5"/>
            <g transform="translate(11, 13)">
              <rect x="0" y="3" width="14" height="9" rx="1.5" fill="white"/>
              <circle cx="7" cy="7.5" r="3" fill="${color}"/>
              <rect x="5.5" y="0" width="3" height="3" rx="0.5" fill="white"/>
            </g>
          </svg>
        </div>`,
        className: '',
        iconSize: L.point(34, 34),
        iconAnchor: [17, 17]
      });
    }

    const recommendClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 35,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 11,
	chunkedLoading: true,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#C1443C;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:bold;border:2px solid white;">${count}</div>`,
          className: 'recommend-cluster-icon',
          iconSize: L.point(36, 36)
        });
      }
    });

    if (showRecommendations && cctvData?.topRecommendations) {
      cctvData.topRecommendations.forEach(u => {
        const marker = L.marker([u.centroidLat, u.centroidLon], { icon: makeRecommendIcon(u.priority) });
        const priorityColor = PRIORITY_ICON_COLORS[u.priority] || '#4A7FB5';
        marker.bindPopup(
          `<div style="min-width:220px;">
            <div class="mono" style="font-weight:bold;font-size:13px;">CCTV Recommendation</div>
            <div style="display:inline-block;background:${priorityColor};color:white;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:bold;margin:4px 0;">${u.priority} Priority</div>
            <div style="margin-top:6px;">Risk Score: <strong>${u.riskScore}/100</strong></div>
            <div>Crime Density: <strong>${u.caseCount} cases</strong> (${u.highSeverityCount} high-severity)</div>
            <div>Existing CCTV Count: <strong>${u.cameraCount}</strong></div>
            <div>Recommended Cameras: <strong>${u.recommendedCameraCount}</strong></div>
            <div>Expected Coverage Improvement: <strong>${u.expectedCoverageImprovementPct}%</strong></div>
            <div style="margin-top:6px;font-style:italic;font-size:12px;color:#8B96AA;">${u.reason}</div>
          </div>`
        );
        recommendClusterGroup.addLayer(marker);
      });
    }

    const cameraClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 35,
      spiderfyOnMaxZoom: true,
	
      disableClusteringAtZoom: 11,
     iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#2C3E50;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:bold;border:2px solid white;">${count}</div>`,
          className: 'camera-cluster-icon',
          iconSize: L.point(36, 36)
        });
      }
    });

    const cameraIcon = L.divIcon({
      html: `<div style="background:#2C3E50;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.6);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      </div>`,
      className: 'camera-marker-icon',
      iconSize: L.point(22, 22),
      iconAnchor: [11, 11]
    });

    if (showActiveCameras && activeCameras?.cameras) {
      activeCameras.cameras.forEach(cam => {
        const marker = L.marker([cam.latitude, cam.longitude], { icon: cameraIcon });
        marker.bindPopup(
          `<div class="mono">${cam.cameraName}</div><div>Status: ${cam.status}</div>`
        );
        cameraClusterGroup.addLayer(marker);
      });
    }

    map.addLayer(layerGroup);
    map.addLayer(cameraClusterGroup);
    map.addLayer(recommendClusterGroup);

    return () => {
      map.removeLayer(layerGroup);
      map.removeLayer(cameraClusterGroup);
      map.removeLayer(recommendClusterGroup);
    };
  }, [cctvData, showCctv, showRecommendations, activeCameras, showActiveCameras, map]);

  return null;
}

function formatMonthLabel(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function AnalyticsDrawer({ cases, kpis, selectedDistrict, districts }) {
  const crimeTrend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), count: 0 });
    }
    const monthIndex = {};
    months.forEach((m, i) => { monthIndex[m.key] = i; });

    cases.forEach(c => {
      if (!c.dateOfFIR) return;
      const d = new Date(c.dateOfFIR);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthIndex[key] !== undefined) months[monthIndex[key]].count += 1;
    });
    return months;
  }, [cases]);

  const topHotspots = useMemo(() => {
    const counts = {};
    cases.forEach(c => {
      const name = c.unitName || 'Unknown Station';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([unitName, count]) => ({ unitName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [cases]);

  const resolution = useMemo(() => {
    const total = cases.length;
    const resolved = cases.filter(c => c.status === 'Chargesheeted' || c.status === 'Closed').length;
    const pending = total - resolved;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, pending, rate };
  }, [cases]);

  const insightText = useMemo(() => {
    if (cases.length === 0) return 'No cases match the current filters, so no insight can be generated yet.';

    const typeCounts = {};
    cases.forEach(c => { if (c.crimeType) typeCounts[c.crimeType] = (typeCounts[c.crimeType] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const topTypePct = topType ? Math.round((topType[1] / cases.length) * 100) : 0;

    const scopeLabel = selectedDistrict
      ? (districts.find(d => d.rowId === selectedDistrict)?.districtName || 'the selected district')
      : 'the state overall';

    const topStation = topHotspots[0];

    const parts = [];
    if (topType) {
      parts.push(`In ${scopeLabel}, ${topType[0]} is the most frequent crime type in the current selection, accounting for ${topTypePct}% of cases (${topType[1]} of ${cases.length}).`);
    }
    if (topStation) {
      parts.push(`${topStation.unitName} has recorded the highest case volume in this view, with ${topStation.count} case${topStation.count === 1 ? '' : 's'}.`);
    }
    parts.push(`${resolution.rate}% of cases in the current selection have been resolved (chargesheeted or closed); ${resolution.pending} case${resolution.pending === 1 ? '' : 's'} remain under investigation.`);

    return parts.join(' ');
  }, [cases, topHotspots, resolution, selectedDistrict, districts]);

  return (
     <div className="analytics-drawer-grid">
      <div className="chart-panel">
        <h4>📈 Crime Trend (Last 12 Months)</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={crimeTrend}>
            <XAxis dataKey="label" tick={{ fill: '#8B96AA', fontSize: 10 }} angle={-30} textAnchor="end" height={45} />
            <YAxis tick={{ fill: '#8B96AA', fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1A2438', border: '1px solid #232D42', fontSize: 12 }} />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-panel">
        <h4>🔥 Top Crime Hotspots (Top 5 Stations)</h4>
        {topHotspots.length === 0 ? (
          <div className="text-muted" style={{ padding: 16, fontSize: 12 }}>No station data available for the current selection.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topHotspots} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fill: '#8B96AA', fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="unitName" tick={{ fill: '#8B96AA', fontSize: 10 }} width={110} />
              <Tooltip contentStyle={{ background: '#1A2438', border: '1px solid #232D42', fontSize: 12 }} />
              <Bar dataKey="count" fill="#E08A3E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-panel">
        <h4>Case Resolution Rate</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 180 }}>
          <ResponsiveContainer width="50%" height={140}>
            <PieChart>
              <Pie
                data={[{ name: 'Resolved', value: resolution.resolved }, { name: 'Pending', value: resolution.pending }]}
                dataKey="value"
                nameKey="name"
                innerRadius={32}
                outerRadius={55}
              >
                <Cell fill="var(--status-closed)" />
                <Cell fill="var(--status-investigation)" />
              </Pie>
              <Tooltip contentStyle={{ background: '#1A2438', border: '1px solid #232D42', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#E8ECF3' }}>{resolution.rate}%</div>
            <div style={{ fontSize: 11, color: '#8B96AA' }}>{resolution.resolved} resolved / {resolution.total} total</div>
            <div style={{ fontSize: 11, color: '#8B96AA' }}>{resolution.pending} pending</div>
          </div>
        </div>
      </div>

      <div className="chart-panel">
        <h4>AI Crime Insights</h4>
        <div style={{ fontSize: 13, color: '#C7CEDA', lineHeight: 1.6, padding: '8px 4px' }}>{insightText}</div>
      </div>
    </div>
  );
}



function App() {
    const [showProfileCard, setShowProfileCard] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem('ksp-user')) || null;
  } catch {
    return null;
  }
});
const allowedTabs = ROLE_CONFIG[currentUser?.role]?.tabs || ['dashboard'];
console.log("CURRENT USER:", currentUser);
console.log("CURRENT ROLE:", currentUser?.role);
console.log("ALLOWED TABS:", allowedTabs);
const handleLogout = () => {
  setCurrentUser(null);
  localStorage.removeItem('ksp-user');
};
  const [kpis, setKpis] = useState(null);
  const [cases, setCases] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCrimeType, setSelectedCrimeType] = useState('');
    const [selectedDateRange, setSelectedDateRange] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [language, setLanguage] = useState('en');
  const pdfExportRef = useRef(null);

  const SAMPLE_QUESTIONS = {
    en: [
      { category: 'Location', icon: '1', text: 'Show crime cases in Bengaluru.' },
      { category: 'Location', icon: '1', text: 'Show theft cases in Mysuru.' },
      { category: 'Location', icon: '1', text: 'Which district has the highest crime rate?' },
      { category: 'Crime', icon: '2', text: 'Show all cyber crime cases.' },
      { category: 'Crime', icon: '2', text: 'Show pending investigation cases.' },
      { category: 'Crime', icon: '2', text: 'Show high severity crimes.' },
      { category: 'AI Insights', icon: '3', text: 'Which areas need more CCTV cameras?' },
      { category: 'AI Insights', icon: '3', text: "Predict tomorrow's crime hotspots." },
      { category: 'AI Insights', icon: '3', text: 'Which police stations have the highest workload?' },
      { category: 'Analytics', icon: '4', text: 'Compare crime trends between Bengaluru and Mysuru.' },
      { category: 'Analytics', icon: '4', text: 'Show crime trend for the last 30 days.' },
      { category: 'Analytics', icon: '4', text: 'Which crime type is increasing the most?' }
    ],
    kn: [
      { category: 'Kannada', icon: '5', text: 'A' },
      { category: 'Kannada', icon: '5', text: 'B' },
      { category: 'Kannada', icon: '5', text: 'C' },
      { category: 'Kannada', icon: '5', text: 'D' }
    ]
  };

  const orderedQuestions = language === 'kn'
    ? [...SAMPLE_QUESTIONS.kn, ...SAMPLE_QUESTIONS.en]
    : [...SAMPLE_QUESTIONS.en, ...SAMPLE_QUESTIONS.kn];

  const handleSampleQuestionClick = (text) => {
    setAiQuestion(text);
    setTimeout(() => handleAskAI(), 0);
  };  
  const [showHistory, setShowHistory] = useState(false);
    
    const [viewingHistoryItem, setViewingHistoryItem] = useState(null);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const responseTopRef = useRef(null);
  const responseAreaRef = useRef(null);
const [lang, setLang] = useState('en');
const t = useLangStrings(lang);
const [isListening, setIsListening] = useState(false);
const [isSpeaking, setIsSpeaking] = useState(false);
const recognitionRef = useRef(null);

  useEffect(() => {
    if (currentAnswer && responseAreaRef.current) {
      responseAreaRef.current.scrollTop = 0;
    }
  }, [currentAnswer]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [cctvData, setCctvData] = useState(null);
  const [showCctv, setShowCctv] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [recommendationLimit, setRecommendationLimit] = useState('20');
  const [activeCameras, setActiveCameras] = useState(null);
  const [showActiveCameras, setShowActiveCameras] = useState(false);
const [showNoCctvOnly, setShowNoCctvOnly] = useState(false);
    const [showHotspotZones, setShowHotspotZones] = useState(true);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [courtHistoryModal, setCourtHistoryModal] = useState(null);
useEffect(() => {
  window.viewCourtHistory = (caseId) => {
    setCourtHistoryModal({ loading: true, cases: [] });
    fetch(`${FUNCTIONS_BASE}/case-court-history-function/?caseId=${caseId}`)
      .then(res => res.json())
      .then(data => setCourtHistoryModal({ loading: false, cases: data.cases || [] }))
      .catch(err => { console.error('Court history fetch error:', err); setCourtHistoryModal({ loading: false, cases: [], error: true }); });
  };
}, []);
const [theme, setTheme] = useState(() => localStorage.getItem('ksp-theme') || 'dark');

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ksp-theme', theme);
}, [theme]);
    const districtCounts = districts.map(d => ({
    name: d.districtName,
    count: cases.filter(c => c.districtId === d.rowId).length
  }));

  // Top state-wide hotspots, ranked by case count, for the sidebar list.
  // Only computed when no district is selected (state overview view),
  // to avoid redundant work while a district is already drilled into.
        const topStateHotspots = useMemo(() => {
    if (selectedDistrict || !cases || cases.length === 0) return [];
        const clusters = computeCrimeClusters(cases, { MIN_CASES_PER_HOTSPOT: 8 });
    const districtNameById = {};
    districts.forEach(d => { districtNameById[d.rowId] = d.districtName; });
    return clusters
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
            .map((c, i) => {
        // Label the cluster with whichever district most of its cases belong to,
        // and whichever police station (finer-grained than district) is most
        // common, so hotspots in the same district are still distinguishable.
        const districtVotes = {};
        const unitVotes = {};
        c.points.forEach(p => {
          const dName = districtNameById[p.districtId];
          if (dName) districtVotes[dName] = (districtVotes[dName] || 0) + 1;
          if (p.unitName) unitVotes[p.unitName] = (unitVotes[p.unitName] || 0) + 1;
        });
        const districtName = Object.entries(districtVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unnamed area';
        const stationName = Object.entries(unitVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const dominantCrime = (() => {
          const crimeVotes = {};
          c.points.forEach(p => { if (p.crimeType) crimeVotes[p.crimeType] = (crimeVotes[p.crimeType] || 0) + 1; });
          return Object.entries(crimeVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        })();
                return { ...c, rank: i + 1, districtName, stationName, dominantCrime };
      });
  }, [cases, selectedDistrict, districts]);
 const startVoiceInput = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice input is not supported in this browser. Try Chrome.');
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => setIsListening(true);
  recognition.onend = () => setIsListening(false);
  recognition.onerror = (event) => {
    setIsListening(false);
    console.error('Speech recognition error:', event.error, event);
    const errorMessages = {
      'language-not-supported': lang === 'kn'
        ? 'Kannada voice input is not supported by this browser/device.'
        : 'This language is not supported for voice input.',
      'no-speech': 'No speech was detected. Please try again.',
      'not-allowed': 'Microphone access was denied. Please allow microphone permissions.',
      'network': 'A network error occurred during voice recognition.',
      'audio-capture': 'No microphone was found. Please check your device.'
    };
    alert(errorMessages[event.error] || `Voice input error: ${event.error}`);
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    setAiQuestion(transcript);
  };

  recognitionRef.current = recognition;
  recognition.start();
};

const stopVoiceInput = () => {
  recognitionRef.current?.stop();
  setIsListening(false);
};
function getVoicesAsync() {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  });
}

const speakAnswer = async (text) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const isKannadaText = /[\u0C80-\u0CFF]/.test(text);
  const voices = await getVoicesAsync();
  const kannadaVoice = voices.find(v => v.lang.toLowerCase().startsWith('kn'));

  if (isKannadaText && !kannadaVoice) {
    alert("This device/browser has no Kannada voice installed, so it can't read this aloud. The text response above is still fully in Kannada.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  if (isKannadaText) {
    utterance.voice = kannadaVoice;   // explicit voice object -- setting .lang alone isn't reliable
    utterance.lang = kannadaVoice.lang;
  } else {
    utterance.lang = 'en-IN';
  }
  utterance.onstart = () => setIsSpeaking(true);
  utterance.onend = () => setIsSpeaking(false);
  utteranceRef.current = utterance; // Chrome has a known bug where the utterance gets
                                     // garbage-collected mid-speech if nothing holds a
                                     // reference to it -- this prevents that
  window.speechSynthesis.speak(utterance);
};

const stopSpeaking = () => {
  window.speechSynthesis.cancel();
  setIsSpeaking(false);
};
const exportChatHistoryPDF = async () => {
  if (chatHistory.length === 0) {
    alert('No conversation history to export yet.');
    return;
  }
  if (!pdfExportRef.current) return;
  await document.fonts.ready;
  const canvas = await html2canvas(pdfExportRef.current, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true
  });
  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    doc.addPage();
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  doc.save(`ksp-ai-conversation-${Date.now()}.pdf`);
};

  const handleAskAI = () => {
    const question = aiQuestion.trim();
    if (!question) return;

    setCurrentQuestion(question);
    setCurrentAnswer(null);
    setAiQuestion('');
    setAiLoading(true);
    setLoadingStageIndex(0);

    let stageIndex = 0;
    const stageInterval = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, AI_STAGES.length - 1);
      setLoadingStageIndex(stageIndex);
    }, 4000);

    fetch(`${FUNCTIONS_BASE}/ask-ai-function/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    })
      .then(res => res.json())
      .then(data => {
        clearInterval(stageInterval);
        setCurrentAnswer(data);
        setChatHistory(prev => [...prev, { question, answer: data }]);
        setAiLoading(false);

        const action = data.dashboardAction;
        if (!action || action.type === 'none') return;

        if (action.type === 'filterDistrict' && action.district) {
          const match = districts.find(d => d.districtName.toLowerCase() === action.district.toLowerCase());
          if (match) setSelectedDistrict(match.rowId);
        } else if (action.type === 'filterCrimeType' && action.crimeType) {
          setSelectedCrimeType(action.crimeType);
        } else if (action.type === 'filterStatus' && action.status) {
          setSelectedStatus(action.status);
        } else if (action.type === 'showHotspots') {
          setShowRecommendations(true);
          if (action.district) {
            const match = districts.find(d => d.districtName.toLowerCase() === action.district.toLowerCase());
            if (match) setSelectedDistrict(match.rowId);
          }
        } else if (action.type === 'showCCTV') {
          setShowActiveCameras(true);
        }
      })
      .catch(err => {
        clearInterval(stageInterval);
        const fallback = { insight: 'Something went wrong. Please try again.', reasoning: [], recommendation: '', confidence: 0 };
        setCurrentAnswer(fallback);
        setChatHistory(prev => [...prev, { question, answer: fallback }]);
        setAiLoading(false);
        console.error('AI query error:', err);
      });
  };

  useEffect(() => {
    fetch(`${FUNCTIONS_BASE}/dashboard-function/`)
      .then(res => res.json())
      .then(setKpis)
      .catch(err => console.error('KPI fetch error:', err));

    fetch(`${FUNCTIONS_BASE}/map-data-function/?type=districts`)
      .then(res => res.json())
      .then(data => setDistricts(data.districts || []))
      .catch(err => console.error('Districts fetch error:', err));

    fetch(`${FUNCTIONS_BASE}/cctv-recommend-function/?mode=active`)
      .then(res => res.json())
      .then(setActiveCameras)
      .catch(err => console.error('Active camera fetch error:', err));
  }, []);
  useEffect(() => {
    fetch(`${FUNCTIONS_BASE}/cctv-recommend-function/?limit=${recommendationLimit}`)
      .then(res => res.json())
      .then(setCctvData)
      .catch(err => console.error('CCTV data fetch error:', err));
  }, [recommendationLimit]);    useEffect(() => {
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedCrimeType) params.append('crimeType', selectedCrimeType);
      if (selectedDateRange) params.append('dateRange', selectedDateRange);

      const casesUrl =
        `${FUNCTIONS_BASE}/map-data-function/?${params.toString()}`;

      fetch(casesUrl)
        .then(async res => {
          const text = await res.text();

          console.log('[CASES DEBUG] status:', res.status);
          console.log('[CASES DEBUG] url:', casesUrl);
          console.log('[CASES DEBUG] response length:', text.length);

          if (!res.ok) {
            throw new Error(`Cases request failed: ${res.status}`);
          }

          if (!text.trim()) {
            console.warn('[CASES DEBUG] Empty response from map-data-function');
            return { cases: [] };
          }

          try {
            return JSON.parse(text);
          } catch (parseError) {
            console.error('[CASES DEBUG] Invalid JSON response:', text.slice(0, 500));
            throw parseError;
          }
        })
        .then(data => {
          setCases(Array.isArray(data.cases) ? data.cases : []);
          setLoading(false);
        })
        .catch(err => {
          console.error('Cases fetch error:', err);
          setCases([]);
          setLoading(false);
        });
    }, [selectedDistrict, selectedStatus, selectedCrimeType, selectedDateRange]);

if (!currentUser) {
    return (
      <LoginPage
        onAuthenticated={(user) => {
          setCurrentUser(user);
          localStorage.setItem('ksp-user', JSON.stringify(user));
        }}
      />
    );
  }

  return (
    <div className="app-shell">
            <header className="top-bar">
                <img src="/apple-touch-icon.png" alt="KSP Logo" className="ksp-header-logo" />
                <h1>{t.appTitle}</h1>
        <span className="mono top-bar-sub">{t.appSubtitle}</span>
        <nav className="top-bar-tabs">
<button
  className="lang-toggle-btn"
  onClick={() => setLang(prev => (prev === 'en' ? 'kn' : 'en'))}
>
 🌐 {t.langToggle}
</button>
<button className="lang-toggle-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? '☀️' : '🌙'}
</button>

                                        {allowedTabs.includes('dashboard') && <button className={activeTab === 'dashboard' ? 'tab-active' : ''} onClick={() => setActiveTab('dashboard')}>{t.tabDashboard}</button>}
{allowedTabs.includes('priority') && <button className={activeTab === 'priority' ? 'tab-active' : ''} onClick={() => setActiveTab('priority')}>{t.tabPriority}</button>}
                    {allowedTabs.includes('network') && <button className={activeTab === 'network' ? 'tab-active' : ''} onClick={() => setActiveTab('network')}>{t.tabNetwork}</button>}
                    
                                        {allowedTabs.includes('knowledge') && <button className={activeTab === 'knowledge' ? 'tab-active' : ''} onClick={() => setActiveTab('knowledge')}>{t.tabKnowledge}</button>}
          
                   {allowedTabs.includes('patrol') && <button className={activeTab === 'patrol' ? 'tab-active' : ''} onClick={() => setActiveTab('patrol')}>{t.tabPatrol}</button>}
<div className="profile-widget" style={{ position: 'relative' }}>
  <button
    className="profile-trigger"
    onClick={() => setShowProfileCard(v => !v)}
    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(217,164,65,0.06)', border: '1px solid rgba(217,164,65,0.25)', borderRadius: 20, padding: '4px 12px 4px 4px', cursor: 'pointer', color: '#E8ECF3', transition: 'background 0.15s' }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,164,65,0.12)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(217,164,65,0.06)'}
  >
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #1A2438, #0F1523)', border: '1.5px solid #D9A441', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#D9A441', flexShrink: 0 }}>
      {(currentUser?.fullName || currentUser?.username || '?').charAt(0).toUpperCase()}
    </div>
    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{currentUser?.fullName || currentUser?.username}</span>
    <ChevronDown size={14} style={{ color: '#8B96AA', transform: showProfileCard ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
  </button>

  {showProfileCard && (
    <div
      style={{ position: 'absolute', top: '120%', right: 0, width: 280, background: '#111827', border: '1px solid rgba(217,164,65,0.3)', borderRadius: 10, overflow: 'hidden', zIndex: 50, boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(217,164,65,0.05)' }}
      onMouseLeave={() => setShowProfileCard(false)}
    >
      <div style={{ background: 'linear-gradient(135deg, #1A2438 0%, #0F1523 100%)', padding: '18px 16px', position: 'relative', borderBottom: '2px solid #D9A441' }}>
        <div style={{ position: 'absolute', top: 10, right: 12, opacity: 0.15 }}>
          <ShieldCheck size={38} color="#D9A441" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #2A3652, #1A2438)', border: '2px solid #D9A441', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#D9A441', flexShrink: 0, boxShadow: '0 0 12px rgba(217,164,65,0.25)' }}>
            {(currentUser?.fullName || currentUser?.username || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F3F8' }}>{currentUser?.fullName || currentUser?.username}</div>
            <div style={{ fontSize: 11.5, color: '#D9A441', fontWeight: 600, marginTop: 1 }}>{currentUser?.designation || currentUser?.role}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {currentUser?.badgeNumber && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BadgeCheck size={15} color="#8B96AA" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <span style={{ color: '#8B96AA' }}>Badge No. </span>
              <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{currentUser.badgeNumber}</span>
            </div>
          </div>
        )}
        {currentUser?.postedUnit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={15} color="#8B96AA" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#E8ECF3' }}>{currentUser.postedUnit}</div>
          </div>
        )}
        {currentUser?.postedDistrict && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={15} color="#8B96AA" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#E8ECF3' }}>{currentUser.postedDistrict} District</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={15} color="#8B96AA" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: '#E8ECF3' }}>{currentUser?.role}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <button
          className="logout-btn"
          onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: 'rgba(217,79,79,0.08)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 6, color: '#E88686', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,79,79,0.16)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(217,79,79,0.08)'}
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </div>
  )}
</div>
   
<div
  ref={pdfExportRef}
  style={{
    position: 'fixed',
    top: -99999,
    left: -99999,
    width: 700,
    background: '#ffffff',
    color: '#111827',
    padding: 24,
    fontFamily: "'Noto Sans Kannada', 'Noto Sans', sans-serif"
  }}
>
  <h2 style={{ marginBottom: 4 }}>KSP Crime Intelligence Platform AI Conversation Log</h2>
  <div style={{ fontSize: 11, color: '#555', marginBottom: 16 }}>Exported: {new Date().toLocaleString()}</div>
  {chatHistory.map((item, idx) => (
    <div key={idx} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #ddd' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Q{idx + 1}: {item.question}</div>
      {item.answer?.insight && <div style={{ marginBottom: 6 }}><strong>Insight:</strong> {item.answer.insight}</div>}
      {Array.isArray(item.answer?.reasoning) && item.answer.reasoning.length > 0 && (
        <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
          {item.answer.reasoning.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      {item.answer?.recommendation && <div style={{ marginBottom: 6 }}><strong>Recommendation:</strong> {item.answer.recommendation}</div>}
      {typeof item.answer?.confidence === 'number' && <div><strong>Confidence:</strong> {item.answer.confidence}%</div>}
    </div>
  ))}
</div>
        </nav>
      </header>
      {activeTab === 'dashboard' && (
      <>
      <div className="kpi-strip">
                <KpiCard label={t.kpiTotalCases} value={kpis?.totalCases ?? '-'} />
        <KpiCard label={t.kpiUnderInvestigation} value={kpis?.underInvestigation ?? '-'} color="var(--status-investigation)" />
        <KpiCard label={t.kpiChargesheeted} value={kpis?.chargesheeted ?? '-'} color="var(--status-chargesheeted)" />
        <KpiCard label={t.kpiClosed} value={kpis?.closed ?? '-'} color="var(--status-closed)" />
                <KpiCard label={t.kpiChargesheetRate} value={kpis?.chargesheetRate ?? '-'} />
      </div>

      <div className="main-layout">
        <aside className="filter-rail">
                   <h3>{t.filtersTitle}</h3>
          <label className="filter-label">{t.filterDistrict}</label>
          <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}>
            <option value="">{t.filterAllDistricts}</option>
            {districts.map(d => (
              <option key={d.rowId} value={d.rowId}>{d.districtName}</option>
            ))}
          </select>

                                                          <label className="filter-label">{t.filterStatus}</label>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="">{t.filterAllStatuses}</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Chargesheeted">Chargesheeted</option>
            <option value="Closed">Closed</option>
          </select>
          <label className="filter-label">Date Range</label>
          <select value={selectedDateRange} onChange={e => setSelectedDateRange(e.target.value)}>
            <option value="">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last 1 Year</option>
          </select>

                    <label className="filter-label">{t.filterCrimeType}</label>
          <select value={selectedCrimeType} onChange={e => setSelectedCrimeType(e.target.value)}>
            <option value="">{t.filterAllCrimeTypes}</option>
            <option value="Theft">Theft</option>
            <option value="Burglary">Burglary</option>
            <option value="Cybercrime">Cybercrime</option>
            <option value="Assault">Assault</option>
            <option value="Robbery">Robbery</option>
            <option value="Domestic Violence">Domestic Violence</option>
            <option value="Fraud">Fraud</option>
            <option value="Chain Snatching">Chain Snatching</option>
            <option value="Vehicle Theft">Vehicle Theft</option>
            <option value="Extortion">Extortion</option>
          </select>
         <div className="case-count mono">{loading ? 'Loading...' : `${cases.length} cases shown`}</div>

                    <div className="layer-toggles">
            <label className="toggle-label">
              <input type="checkbox" checked={showRecommendations} onChange={e => setShowRecommendations(e.target.checked)} />
              {t.layerAiRecommendations}
            </label>
            {showRecommendations && (
              <select
                className="recommendation-limit-select"
                value={recommendationLimit}
                onChange={e => setRecommendationLimit(e.target.value)}
              >
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
                <option value="all">All ({cctvData?.totalRecommendationsAvailable ?? '...'})</option>
              </select>
            )}
            <label className="toggle-label">
              <input type="checkbox" checked={showActiveCameras} onChange={e => setShowActiveCameras(e.target.checked)} />
              {t.layerCctvCameras}
            </label>
            <label className="toggle-label">
              <input type="checkbox" checked={showHotspotZones} onChange={e => setShowHotspotZones(e.target.checked)} />
              {t.layerHotspots}
            </label>
          </div>

                    {cctvData && (
            <div
              className={`cctv-summary mono ${showNoCctvOnly ? 'cctv-summary-active' : ''}`}
              onClick={() => setShowNoCctvOnly(v => !v)}
              role="button"
              tabIndex={0}
              title={showNoCctvOnly ? 'Click to return to normal map view' : 'Click to show only areas without CCTV'}
            >
                           <div>{cctvData.unitsWithoutCCTV} {t.areasWithoutCctv}</div>
            </div>
          )}

          {!selectedDistrict && topStateHotspots.length > 0 && (
            <div className="top-hotspots-panel">
                           <h4 style={{ margin: '16px 0 8px', fontSize: 12, color: '#8B96AA', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.topHotspots}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {topStateHotspots.map(h => (
                  <div
                    key={h.rank}
                    onClick={() => setSelectedHotspot(h)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: selectedHotspot?.rank === h.rank ? '#1A2438' : '#111827', border: selectedHotspot?.rank === h.rank ? '1px solid #D9A441' : '1px solid #232D42', borderRadius: 6, cursor: 'pointer' }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: h.count >= 200 ? '#A6231F' : h.count >= 100 ? '#E0792B' : '#4A7FB5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {h.rank}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#E8ECF3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.districtName}</div>
                      <div style={{ fontSize: 10, color: '#8B96AA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.stationName || `${h.count} cases`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
        <div className="map-container">
          {!loading && cases.length === 0 && (
            <div className="empty-state">
              <p>No cases match the selected filters.</p>
              <p className="text-muted">Try a different district or status combination.</p>
            </div>
          )}
          <MapContainer
            center={[15.3173, 75.7139]}
            zoom={7}
            minZoom={7}
            maxBounds={KARNATAKA_BOUNDS}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            <DistrictBoundaries selectedDistrictName={DB_TO_GEOJSON_NAME[districts.find(d => d.rowId === selectedDistrict)?.districtName] || null} />
                        <ClusterLayer cases={cases} />
            <CctvLayer cctvData={cctvData} showCctv={showCctv} showRecommendations={showRecommendations} activeCameras={activeCameras} showActiveCameras={showActiveCameras} />
            {showNoCctvOnly && <NoCctvAreasLayer cctvData={cctvData} />}
                        <HotspotZoneLayer cases={cases} selectedDistrict={selectedDistrict} showHotspotZones={showHotspotZones} />
                        <MapFlyTo target={selectedHotspot} />
            <SelectedHotspotBoundary hotspot={selectedHotspot} />
          </MapContainer>
    <MapLegend showRecommendations={showRecommendations} showActiveCameras={showActiveCameras} t={t} />
      {selectedHotspot && (
        <div style={{ position: 'absolute', top: 16, right: 16, width: 300, background: '#111827', border: '1px solid rgba(217,164,65,0.3)', borderRadius: 10, padding: 16, zIndex: 1000, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E8ECF3' }}>{selectedHotspot.districtName}</div>
              {selectedHotspot.stationName && <div style={{ fontSize: 11, color: '#8B96AA', marginTop: 2 }}>{selectedHotspot.stationName}</div>}
            </div>
            <button onClick={() => setSelectedHotspot(null)} style={{ background: 'none', border: 'none', color: '#8B96AA', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>&times;</button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: selectedHotspot.count >= 200 ? '#A6231F' : selectedHotspot.count >= 100 ? '#E0792B' : '#4A7FB5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0
            }}>
              {selectedHotspot.count >= 200 ? 'High' : selectedHotspot.count >= 100 ? 'Med' : 'Low'}
            </div>
            <div style={{ fontSize: 11, color: '#8B96AA' }}>
              Risk level based on<br />case density in this area
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#8B96AA' }}>Total Cases</span>
              <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{selectedHotspot.count}</span>
            </div>
            {selectedHotspot.dominantCrime && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#8B96AA' }}>Primary Crime</span>
                <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{selectedHotspot.dominantCrime}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#8B96AA' }}>Cluster Radius</span>
              <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{selectedHotspot.radiusKm?.toFixed(1)} km</span>
            </div>
          </div>
        </div>
      )}
                 </div>

      <aside className="side-panel">
        <div className="side-panel-header">
                <h3>{t.aiPanelTitle}</h3>
          <button
            className="history-btn"
            onClick={() => setShowHistory(true)}
            disabled={chatHistory.length === 0}
          >
           📜 History

          </button>
        </div>
        <p className="disclaimer">This assistant never references caste or religion data, which is excluded from the system by design.</p>

        <div className="ai-response-area" ref={responseAreaRef}>
          {!currentQuestion && !aiLoading && (
  <div className="ai-welcome-screen">
    <div className="ai-welcome-icon">🤖</div>
    <h2 className="ai-welcome-title">AI Crime Assistant</h2>
    <p className="ai-welcome-subtitle">
      Ask about crime trends, districts, and hotspots in English or Kannada.
    </p>
    <div className="ai-welcome-questions">
      {SUGGESTED_QUESTIONS.map((q, i) => (
        <button
          key={i}
          className="ai-welcome-question-card"
          style={{ animationDelay: `${i * 60}ms` }}
          onClick={() => {
            setAiQuestion(q);
            setTimeout(() => handleAskAI(), 0);
          }}
        >
          {q}
        </button>
      ))}
    </div>
  </div>
)}

          {currentQuestion && (
  <div className="analysis-card analysis-card-enter" ref={responseTopRef}>
              <div className="analysis-question">
                <span className="ai-section-label">Question</span>
                <div>{currentQuestion}</div>
              </div>

              {aiLoading && (
                <div className="ai-loading-state">
                  <div className="ai-loading-title">🤖 AI is analyzing...</div>
                  <div className="ai-loading-sub">This may take 30–60 seconds.</div>
                  <ul className="loading-checklist">
                    {AI_STAGES.map((s, i) => (
                      <li
                        key={s}
                        className={i < loadingStageIndex ? 'done' : i === loadingStageIndex ? 'active' : 'pending'}
                      >
                        <span className="checklist-icon">
                          {i < loadingStageIndex ? '✓' : i === loadingStageIndex ? '●' : '○'}
                        </span>
                        {s}

                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!aiLoading && currentAnswer && (
                <div className="analysis-body">
<button
   className="speak-btn"
  onClick={() => (isSpeaking ? stopSpeaking() : speakAnswer(currentAnswer.insight + ' ' + (currentAnswer.recommendation || '')))}
>
  {isSpeaking ? `⏹ ${t.aiStopSpeak}` : `🔊 ${t.aiSpeak}`}
</button>
                  {currentAnswer.insight && (
                    <div className="ai-section">
                      <span className="ai-section-label">📊 Insight</span>
                      <div className="ai-insight">{currentAnswer.insight}</div>
                    </div>
                  )}
                 {currentAnswer.reasoning && (
  <div className="ai-section">
    <span className="ai-section-label">🧠 Reasoning</span>
    {Array.isArray(currentAnswer.reasoning) ? (
      <ul className="ai-reasoning">
        {currentAnswer.reasoning.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    ) : (
      <div className="ai-insight">{String(currentAnswer.reasoning)}</div>
    )}
  </div>
)}
                  {currentAnswer.recommendation && (
                    <div className="ai-section">
                      <span className="ai-section-label">✅ Recommendation</span>
                      <div className="ai-recommendation">{currentAnswer.recommendation}</div>
                    </div>
                  )}

                  {typeof currentAnswer.confidence === 'number' && (
                    <div className="ai-section">
                      <span className="ai-section-label">🎯 Confidence</span>
                      <div className="ai-confidence">{currentAnswer.confidence}%</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="chat-input-bar">
          <textarea
            className="ai-input"
                       placeholder={t.aiPlaceholder}
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskAI();
              }
            }}
            rows={2}
          />
          <button
  className={`mic-btn ${isListening ? 'mic-active' : ''}`}
  type="button"
  title={isListening ? t.aiListening : 'Voice input'}
  onClick={isListening ? stopVoiceInput : startVoiceInput}
>
  {isListening ? '🔴' : '🎤'}
</button>
          <button className="ai-submit" onClick={handleAskAI} disabled={aiLoading || !aiQuestion.trim()}>
            {aiLoading ? '...' : 'Ask'}
          </button>
        </div>

        {showHistory && (
                   <div className="history-drawer-overlay" onClick={() => { setShowHistory(false); setViewingHistoryItem(null); }}>
            <div className="history-drawer" onClick={e => e.stopPropagation()}>
             <div className="history-drawer-header">
                {viewingHistoryItem ? (
                  <button className="history-export-btn" onClick={() => setViewingHistoryItem(null)}>&larr; Back</button>
                ) : (
                  <h4>Previous Questions</h4>
                )}
                <button className="history-export-btn" onClick={exportChatHistoryPDF}>Export PDF</button>
                <button className="history-close" onClick={() => { setShowHistory(false); setViewingHistoryItem(null); }}>&times;</button>
              </div>
              <div className="history-drawer-body">
                {!viewingHistoryItem && (
                  <>
                    {chatHistory.length === 0 && <div className="text-muted">No previous questions yet.</div>}
                    {[...chatHistory].reverse().map((item, i) => (
                      <div
                        key={i}
                        className="history-item"
                        onClick={() => setViewingHistoryItem(item)}
                      >
                        <div className="history-item-q">{item.question}</div>
                        {item.answer?.insight && <div className="history-item-a">{item.answer.insight}</div>}
                      </div>
                    ))}
                  </>
                )}
                {viewingHistoryItem && (
                  <div className="analysis-card">
                    <div className="analysis-question">
                      <span className="ai-section-label">Question</span>
                      <div>{viewingHistoryItem.question}</div>
                    </div>
                    {viewingHistoryItem.answer?.insight && (
                      <div style={{ marginBottom: 12 }}>
                        <span className="ai-section-label">Insight</span>
                        <div className="ai-insight">{viewingHistoryItem.answer.insight}</div>
                      </div>
                    )}
                    {viewingHistoryItem.answer?.reasoning && (
                      <div style={{ marginBottom: 12 }}>
                        <span className="ai-section-label">Reasoning</span>
                        <ul className="ai-reasoning">
                          {(Array.isArray(viewingHistoryItem.answer.reasoning)
                            ? viewingHistoryItem.answer.reasoning
                            : [viewingHistoryItem.answer.reasoning]
                          ).map((r, idx) => <li key={idx}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {viewingHistoryItem.answer?.recommendation && (
                      <div style={{ marginBottom: 12 }}>
                        <span className="ai-section-label">Recommendation</span>
                        <div>{viewingHistoryItem.answer.recommendation}</div>
                      </div>
                    )}
                    {typeof viewingHistoryItem.answer?.confidence === 'number' && (
                      <div>
                        <span className="ai-section-label">Confidence</span>
                        <div>{viewingHistoryItem.answer.confidence}%</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
{courtHistoryModal && (
  <div className="court-modal-overlay" onClick={() => setCourtHistoryModal(null)}>
    <div className="court-modal" onClick={e => e.stopPropagation()}>
      <div className="court-modal-header">
        <h4>⚖️ Court History</h4>
        <button className="court-modal-close" onClick={() => setCourtHistoryModal(null)}>&times;</button>
      </div>
      <div className="court-modal-body">
        {courtHistoryModal.loading && <div className="text-muted">Loading...</div>}
        {!courtHistoryModal.loading && courtHistoryModal.cases.length === 0 && (
          <div className="text-muted">No court records found for this case.</div>
        )}
        {courtHistoryModal.cases.map(c => (
          <div key={c.caseId} className="court-case-card">
            <div className="court-case-title">
              {c.firNumber} — {c.crimeType}
              <span className="court-status-badge" style={{ background: STATUS_COLORS[c.status] || '#8B96AA', color: '#0F1523' }}>
                {c.status}
              </span>
            </div>

            {c.hearings.length === 0 && (
              <div className="court-empty-note">No court hearings recorded yet — case is {c.status.toLowerCase()}.</div>
            )}

            {c.hearings.length > 0 && (
              <div className="court-timeline">
                {c.hearings.map((h, i) => (
                  <div key={i} className="court-timeline-item">
                    <div className="court-timeline-date">{h.hearingDate}</div>
                    <div><span className="court-timeline-purpose">{h.purpose}</span> — {h.outcome}</div>
                    <div style={{ color: '#8B96AA', fontSize: 11 }}>{h.courtName} · {h.judgeName}</div>
                  </div>
                ))}
              </div>
            )}

            {c.disposition && (
              <div className={`court-disposition-box ${c.disposition.dispositionType === 'Convicted' ? 'convicted' : c.disposition.dispositionType === 'Acquitted' ? 'acquitted' : 'other'}`}>
                <strong>{c.disposition.dispositionType}</strong> on {c.disposition.dispositionDate}
                {c.disposition.sentenceDetails && <div style={{ marginTop: 4 }}>{c.disposition.sentenceDetails}</div>}
                <div style={{ color: '#8B96AA', marginTop: 4 }}>{c.disposition.courtName}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
)}
      </aside>
      </div>

      <div className="analytics-toggle-row">
        <button className="analytics-toggle-btn" onClick={() => setShowAnalytics(v => !v)}>
          📊 Analytics {showAnalytics ? '▲' : '▼'}
        </button>
      </div>

      {showAnalytics && (
        <AnalyticsDrawer cases={cases} kpis={kpis} selectedDistrict={selectedDistrict} districts={districts} />
      )}
      </>
      )}

{activeTab === 'priority' && (
  <PriorityActionPanel functionsBase={FUNCTIONS_BASE} onNavigateTab={setActiveTab} />
)}

                  {activeTab === 'network' && (
        <div className="network-tab-content">
          <NetworkGraphPanel functionsBase={FUNCTIONS_BASE} />
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="kb-tab-content">
          <KnowledgeBasePanel functionsBase={FUNCTIONS_BASE} lang={lang} />
        </div>
      )}
     
{activeTab === 'patrol' && (
      <div className="patrol-tab-content">
          <PatrolRecommendationPanel functionsBase={FUNCTIONS_BASE} districts={districts} initialDistrictId={selectedDistrict} />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value mono" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function PatrolRecommendationPanel({ functionsBase, districts, initialDistrictId }) {
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrictId || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedDistrict) params.append('district', selectedDistrict);
    params.append('limit', '30');
    fetch(`${functionsBase}/patrol-recommend-function/?${params.toString()}`)
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Patrol recommendation fetch error:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priorityColor = (p) => p === 'High' ? '#A6231F' : '#4A7FB5';

  return (
    <div className="patrol-panel">
      <div className="patrol-panel-header">
        <h3>AI Patrol Recommendation</h3>
        <div className="patrol-panel-controls">
          <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}>
            <option value="">All Districts</option>
            {(districts || []).map(d => (
              <option key={d.rowId} value={d.rowId}>{d.districtName}</option>
            ))}
          </select>
          <button className="patrol-generate-btn" onClick={fetchRecommendations} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Patrol Plan'}
          </button>
        </div>
      </div>

      {loading && <div className="patrol-panel-loading mono">Analyzing crime data and generating patrol recommendations...</div>}

      {!loading && data && (
        <>
          <div className="patrol-summary-strip">
            <StatCard label="Total Hotspots" value={data.totalHotspots ?? 0} />
            <StatCard label="High Priority" value={data.highPriorityCount ?? 0} />
            <StatCard label="Low Priority" value={data.lowPriorityCount ?? 0} />
          </div>

          <div className="patrol-cards-list">
            {(data.recommendations || []).map(r => (
              <div key={r.unitId} className="patrol-card">
                <div className="patrol-card-header">
                  <div>
                    <div className="patrol-card-area">{r.areaName}</div>
                    <div className="patrol-card-district mono">{r.district}</div>
                  </div>
                  <div className="patrol-card-badges">
                    <span className="patrol-priority-badge" style={{ background: priorityColor(r.priority) }}>
                      {r.priority} Priority
                    </span>
                    <span className="patrol-ai-badge">{r.badge}</span>
                  </div>
                </div>

                <div className="patrol-card-stats">
                  <div className="patrol-stat">
                    <span className="patrol-stat-label">Recommended Officers</span>
                    <span className="patrol-stat-value">{r.recommendedOfficers}</span>
                  </div>
                  <div className="patrol-stat">
                    <span className="patrol-stat-label">Suggested Patrol Time</span>
                    <span className="patrol-stat-value">{r.suggestedPatrolTime}</span>
                  </div>
                  <div className="patrol-stat">
                    <span className="patrol-stat-label">Nearby CCTV</span>
                    <span className="patrol-stat-value">{r.nearbyCCTVCount} camera(s){r.nearestCameraKm !== null ? ` (${r.nearestCameraKm} km)` : ''}</span>
                  </div>
                  <div className="patrol-stat">
                    <span className="patrol-stat-label">Recent Crime Count</span>
                    <span className="patrol-stat-value">{r.recentCrimeCount}</span>
                  </div>
                  <div className="patrol-stat">
                    <span className="patrol-stat-label">Confidence</span>
                    <span className="patrol-stat-value">{r.confidence}%</span>
                  </div>
                </div>

                <div className="patrol-card-explanation">{r.explanation}</div>
              </div>
            ))}
          </div>

          {(!data.recommendations || data.recommendations.length === 0) && (
            <div className="patrol-panel-empty">
              <p>No patrol recommendations for the selected filter.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function StatCard({ label, value }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function DetailRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: valueColor || 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
function MapLegend({ showRecommendations, showActiveCameras, t }) {
  return (
    <div className="map-legend">
            <div className="map-legend-title">{t.legendTitle}</div>

      <div className="map-legend-section">
        <div className="map-legend-section-label">Crime Cases</div>
        <LegendRow color={STATUS_COLORS['Under Investigation']} label="Under Investigation" />
        <LegendRow color={STATUS_COLORS['Chargesheeted']} label="Chargesheeted" />
        <LegendRow color={STATUS_COLORS['Closed']} label="Closed" />
      </div>

      {showRecommendations && (
        <div className="map-legend-section">
          <div className="map-legend-section-label">CCTV Recommendation Markers</div>
          <LegendRow color="#A6231F" label="High Priority" shape="shield" />
          <LegendRow color="#4A7FB5" label="Low Priority" shape="shield" />
        </div>
      )}

      {showActiveCameras && (
        <div className="map-legend-section">
          <div className="map-legend-section-label">Existing CCTV</div>
          <div className="map-legend-icon-row">
                       <span className="map-legend-icon-badge map-legend-icon-active" dangerouslySetInnerHTML={{ __html: '&#128247;' }} />
            <span>Active camera</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label, line, dashed, shape }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)', padding: '3px 0' }}>
      {line ? (
        <div style={{ width: 20, height: 0, borderTop: dashed ? `2px dashed ${color}` : `2px solid ${color}` }} />
      ) : shape === 'shield' ? (
        <svg width="16" height="16" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
          <path d="M20 2 L36 8 V18 C36 28 29 35 20 38 C11 35 4 28 4 18 V8 Z" fill={color} stroke="white" strokeWidth="1.5" />
          <g transform="translate(11, 13)">
            <rect x="0" y="3" width="14" height="9" rx="1.5" fill="white" />
            <circle cx="7" cy="7.5" r="3" fill={color} />
            <rect x="5.5" y="0" width="3" height="3" rx="0.5" fill="white" />
          </g>
        </svg>
      ) : (
        <div style={{ width: 10, height: 10, borderRadius: shape === 'square' ? 2 : '50%', background: color, flexShrink: 0 }} />
      )}
      <span>{label}</span>
    </div>
  );
}
function ResizeHandle({ currentWidth, setWidth, min, max, direction, defaultWidth }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = currentWidth;
    const handleMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const raw = direction === 'grow-right' ? startWidth + delta : startWidth - delta;
      setWidth(Math.min(max, Math.max(min, raw)));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={() => setWidth(defaultWidth)}
      title="Drag to resize, double-click to reset"
      style={{ width: 10, flexShrink: 0, cursor: 'col-resize', alignSelf: 'stretch', position: 'relative' }}
    >
      <div style={{ position: 'absolute', left: 4, top: 0, bottom: 0, width: 2, background: '#232D42', borderRadius: 2 }} />
    </div>
  );
}

const MUTED_MARKER_COLOR = '#3A4356';

function OffenderMapLayer({
  graphData,
  primaryId,
  associateIds,
  completeAssociates,
  linkMode,
  onPrimarySelect,
  onAssociateSelect,
  onBackgroundClick
}) {
  const map = useMap();

  useEffect(() => {
    const baseOffenderNodesWithCoords = graphData.nodes.filter(
      n => n.type === 'offender' && typeof n.centroidLat === 'number' && typeof n.centroidLon === 'number'
    );

    const completeAssociateNodes = (
      primaryId &&
      completeAssociates &&
      completeAssociates.aadhaar &&
      Array.isArray(completeAssociates.associates)
    )
      ? completeAssociates.associates
          .filter(a =>
            typeof a.centroidLat === 'number' &&
            typeof a.centroidLon === 'number'
          )
          .map(a => ({
            id: a.id,
            type: 'offender',
            label: a.name || 'Unknown',
            aadhaar: a.aadhaar || null,
            riskScore: a.riskScore ?? 0,
            caseCount: a.caseCount ?? 0,
            centroidLat: a.centroidLat,
            centroidLon: a.centroidLon
          }))
      : [];

    const nodesById = new Map(
      [...baseOffenderNodesWithCoords, ...completeAssociateNodes]
        .map(n => [n.id, n])
    );

    const offenderNodesWithCoords = [...nodesById.values()];
    const coordById = {};
    offenderNodesWithCoords.forEach(n => { coordById[n.id] = [n.centroidLat, n.centroidLon]; });

    const backendAssociateLinks =
      primaryId &&
      completeAssociates &&
      completeAssociates.aadhaar &&
      Array.isArray(completeAssociates.associates)
        ? completeAssociates.associates
            .filter(a => nodesById.has(a.id))
            .map(a => ({
              source: primaryId,
              target: a.id,
              type: 'offender-link',
              strength: a.strength || 'weak',
              reason: a.reason || 'Known association',
              sharedCaseCount: a.sharedCaseCount ?? 0
            }))
        : [];

    console.log('[MAP DEBUG]', {
      primaryId,
      backendAssociates: completeAssociates?.associates?.length || 0,
      completeAssociateNodes: completeAssociateNodes.length,
      backendAssociateLinks: backendAssociateLinks.length,
      mappedCoordinates: completeAssociateNodes.filter(
        n => typeof n.centroidLat === 'number' &&
             typeof n.centroidLon === 'number'
      ).length
    });

    const allOffenderLinks = [
      ...graphData.links.filter(l => l.type === 'offender-link'),
      ...backendAssociateLinks
    ];

    const linkKeys = new Set();

    const offenderLinksWithCoords = allOffenderLinks.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;

      if (!coordById[sourceId] || !coordById[targetId]) return false;

      const key = [sourceId, targetId].sort().join('|');

      if (linkKeys.has(key)) return false;

      linkKeys.add(key);
      return true;
    });

    const linkColorFor = (strength) => strength === 'strong'
      ? 'rgba(224, 138, 62, 0.9)'
      : strength === 'medium'
        ? 'rgba(74, 127, 181, 0.65)'
        : 'rgba(139, 150, 170, 0.35)';

    // Cluster offender markers -- same library already used for the Dashboard
    // map's case markers. Without this, 400+ overlapping circles at state
    // zoom are unreadable.
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#8B96AA;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#0F1523;font-weight:700;font-size:13px;border:2px solid white;">${count}</div>`,
          className: 'offender-cluster-icon',
          iconSize: L.point(38, 38)
        });
      }
    });

    offenderNodesWithCoords.forEach(n => {
      const isPrimary = n.id === primaryId;
      const isAssociate =
        !!primaryId &&
        !!associateIds &&
        associateIds.has(n.id);
      const isDimmed = primaryId && !isPrimary && !isAssociate;

      const baseColor = getRiskColor(n.riskScore || 0);
      const marker = L.circleMarker([n.centroidLat, n.centroidLon], {
        radius: isPrimary
          ? Math.min(9 + (n.caseCount || 1) * 1.2, 26)
          : Math.min(6 + (n.caseCount || 1) * 1.2, 20),
        color: isPrimary ? '#F2C14E' : '#fff',
        weight: isPrimary ? 3 : 1,
        fillColor: isDimmed ? MUTED_MARKER_COLOR : baseColor,
        fillOpacity: isDimmed ? 0.45 : 0.85
      });
      // No popup bound here anymore -- clicking drives the compact
      // info/relationship cards instead of a Leaflet popup.
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (primaryId && isAssociate) {
          onAssociateSelect(n);
        } else {
          onPrimarySelect(n);
        }
      });
      clusterGroup.addLayer(marker);
    });

    // Link drawing:
    // Direct Associates = only connections from the selected offender.
    // All Connections = every available offender relationship.
    //
    // IMPORTANT: associateIds comes from the complete backend /associates
    // response, so mapped associates that are not present in the trimmed
    // graph are still shown and connected.

    const linksToDraw = linkMode === 'all'
      ? offenderLinksWithCoords
      : primaryId
        ? [
            ...offenderLinksWithCoords.filter(l => {
              const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
              const targetId = typeof l.target === 'object' ? l.target.id : l.target;

              return sourceId === primaryId || targetId === primaryId;
            }),

            // Add relationships from the complete backend associate response.
            // These may not exist in the trimmed graphData.links.
            ...backendAssociateLinks.filter(l => {
              const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
              const targetId = typeof l.target === 'object' ? l.target.id : l.target;

              return sourceId === primaryId || targetId === primaryId;
            })
          ]
        : [];

    // Remove duplicate relationships before drawing.
    const uniqueLinksToDraw = [];
    const drawnLinkKeys = new Set();

    linksToDraw.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;

      const key = [sourceId, targetId].sort().join('|');

      if (drawnLinkKeys.has(key)) return;

      drawnLinkKeys.add(key);
      uniqueLinksToDraw.push(l);
    });

    const linkLayerGroup = L.layerGroup();
    uniqueLinksToDraw.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      const line = L.polyline([coordById[sourceId], coordById[targetId]], {
        color: linkColorFor(l.strength),
        weight: l.strength === 'strong' ? 2.5 : l.strength === 'medium' ? 1.5 : 1,
        dashArray: l.strength === 'weak' ? '4,4' : undefined
      });
      linkLayerGroup.addLayer(line);
    });

    // "Associates + Cases" mode: also plot the primary offender's own linked
    // case markers (real case coordinates, not fabricated) and connect them.
    const caseMarkerGroup = L.layerGroup();
    if (linkMode === 'cases' && primaryId) {
      const caseNodeById = {};
      graphData.nodes.forEach(n => { if (n.type === 'case') caseNodeById[n.id] = n; });

      const primaryCaseLinks = graphData.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return l.type === 'case-link' && (sourceId === primaryId || targetId === primaryId);
      });

      primaryCaseLinks.forEach(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const caseId = sourceId === primaryId ? targetId : sourceId;
        const caseNode = caseNodeById[caseId];
        if (!caseNode) return;
        const lat = caseNode.centroidLat ?? caseNode.latitude;
        const lon = caseNode.centroidLon ?? caseNode.longitude;
        if (typeof lat !== 'number' || typeof lon !== 'number') return;

        const caseMarker = L.marker([lat, lon], {
          icon: L.divIcon({
            html: `<div style="width:12px;height:12px;background:#4A7FB5;border:1.5px solid white;transform:rotate(45deg);"></div>`,
            className: '',
            iconSize: L.point(12, 12)
          })
        });
        caseMarker.bindPopup(
          `<div style="font-size:12px;"><strong>${caseNode.crimeType || 'Case'}</strong><br/>${caseNode.dateOfFIR || ''}<br/>${caseNode.district || ''}</div>`
        );
        caseMarkerGroup.addLayer(caseMarker);

        const primaryCoord = coordById[primaryId];
        if (primaryCoord) {
          caseMarkerGroup.addLayer(L.polyline([primaryCoord, [lat, lon]], {
            color: 'rgba(74, 127, 181, 0.5)',
            weight: 1.5,
            dashArray: '2,4'
          }));
        }
      });
    }

    map.addLayer(clusterGroup);
    map.addLayer(linkLayerGroup);
    map.addLayer(caseMarkerGroup);

    // Auto-fit to the primary offender and whatever is currently visible
    // around them (associates for direct/all modes, cases for cases mode).
    if (primaryId && coordById[primaryId]) {
      const fitCoords = [coordById[primaryId]];
      if (linkMode === 'cases') {
        caseMarkerGroup.eachLayer(layer => {
          if (layer.getLatLng) fitCoords.push([layer.getLatLng().lat, layer.getLatLng().lng]);
        });
      } else if (associateIds) {
        associateIds.forEach(id => { if (coordById[id]) fitCoords.push(coordById[id]); });
      }
      const bounds = L.latLngBounds(fitCoords);
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 12, duration: 0.8 });
      }
    }

    function handleMapClick() {
      onBackgroundClick();
    }
    map.on('click', handleMapClick);

    return () => {
      map.removeLayer(clusterGroup);
      map.removeLayer(linkLayerGroup);
      map.removeLayer(caseMarkerGroup);
      map.off('click', handleMapClick);
    };
  }, [graphData, primaryId, associateIds, linkMode, onPrimarySelect, onAssociateSelect, onBackgroundClick, map]);

  return null;
}
function CrossDistrictLinksTable({ graphData, selectedOffenderId }) {
  const rows = useMemo(() => {
    if (!selectedOffenderId) return null;
    const nodeById = {};
    graphData.nodes.forEach(n => { nodeById[n.id] = n; });
    const selected = nodeById[selectedOffenderId];
    if (!selected) return [];

    const selectedDistricts = selected.districts || [];

        const strengthRank = { strong: 0, medium: 1, weak: 2 };
    const byOtherId = {};

    graphData.links
      .filter(l => l.type === 'offender-link')
      .forEach(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        if (sourceId !== selectedOffenderId && targetId !== selectedOffenderId) return;
        const otherId = sourceId === selectedOffenderId ? targetId : sourceId;
        const other = nodeById[otherId];
        if (!other) return;

        // A pair can have more than one real edge (e.g. both "same case" and
        // "same crime pattern"). Keep only the strongest one per person,
        // rather than showing the same associate multiple times.
        const existing = byOtherId[otherId];
        if (existing && strengthRank[existing.strength] <= strengthRank[l.strength]) return;

               const otherDistricts = other.districts || [];
        const shared = selectedDistricts.filter(d => otherDistricts.includes(d));
        const isCrossDistrict = shared.length === 0 && selectedDistricts.length && otherDistricts.length;
        const hasLocation = typeof other.centroidLat === 'number' && typeof other.centroidLon === 'number';

        byOtherId[otherId] = {
          key: otherId,
          id: otherId,
          name: other.label,
          sharedDistricts: shared.length ? shared.join(', ') : (otherDistricts.join(', ') || 'Unknown'),
          strength: l.strength,
          crossDistrict: isCrossDistrict,
          hasLocation
        };
      });

    return Object.values(byOtherId)
      .sort((a, b) => strengthRank[a.strength] - strengthRank[b.strength]);
  }, [graphData, selectedOffenderId]);

  if (rows === null) {
    return (
      <div style={{ padding: 12, color: '#8B96AA', fontSize: 12, textAlign: 'center', background: '#111827', border: '1px solid #232D42', borderRadius: 8 }}>
        Click an offender on the map to see their real associates and which districts they operate in.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 12, color: '#8B96AA', fontSize: 12, textAlign: 'center', background: '#111827', border: '1px solid #232D42', borderRadius: 8 }}>
        This offender has no recorded associates in the current data.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #232D42', borderRadius: 8, background: '#111827' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <thead style={{ position: 'sticky', top: 0, background: '#1A2438' }}>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#8B96AA' }}>Associate</th>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#8B96AA' }}>Districts</th>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#8B96AA' }}>Strength</th>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#8B96AA' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} style={{ borderTop: '1px solid #1A2438' }}>
                                <td style={{ padding: '5px 10px', color: '#E8ECF3' }}>
                    {r.name}
                    {!r.hasLocation && (
                      <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: 'rgba(139,150,170,0.15)', color: '#8B96AA' }} title="This associate's cases have no recorded coordinates, so they can't be shown on the map">
                        Not mapped
                      </span>
                    )}
                  </td>
              <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{r.districts}</td>
              <td style={{ padding: '5px 10px' }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                  background: r.strength === 'strong' ? 'rgba(224,138,62,0.15)' : r.strength === 'medium' ? 'rgba(74,127,181,0.15)' : 'rgba(139,150,170,0.15)',
                  color: r.strength === 'strong' ? '#E08A3E' : r.strength === 'medium' ? '#4A7FB5' : '#8B96AA'
                }}>{r.strength}</span>
              </td>
              <td style={{ padding: '5px 10px' }}>
                {r.crossDistrict && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'rgba(217,164,65,0.15)', color: '#D9A441' }}>
                    Cross-District
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OffenderMapView({ graphData, onViewHistory, externalSelectedNode, completeAssociates }) {  const offenderNodesWithCoords = graphData.nodes.filter(
    n => n.type === 'offender' && typeof n.centroidLat === 'number' && typeof n.centroidLon === 'number'
  );
  const [primaryNode, setPrimaryNode] = useState(null);
  const [associateNode, setAssociateNode] = useState(null);
  const [linkMode, setLinkMode] = useState('direct'); // 'direct' | 'cases' | 'all'

  // Sync with search selection from the parent panel, so searching by name
  // isolates that offender's connections here too, not just in Graph view.
  useEffect(() => {
    if (externalSelectedNode && externalSelectedNode.type === 'offender') {
      setPrimaryNode(externalSelectedNode);
      setAssociateNode(null);
    }
  }, [externalSelectedNode]);

  // Real direct associates of the primary offender (offender-link edges only
  // -- never fabricated). Also keeps the connecting edge so the relationship
  // card can show real strength/reason.
  const { associateIds, edgeByAssociateId } = useMemo(() => {
    if (!primaryNode) {
      return {
        associateIds: new Set(),
        edgeByAssociateId: new Map()
      };
    }

    const ids = new Set();
    const edgeMap = new Map();

    // When the complete backend associate list is available, use it as
    // the authoritative source for the selected offender.
    if (
      completeAssociates &&
      completeAssociates.aadhaar === primaryNode.aadhaar &&
      Array.isArray(completeAssociates.associates)
    ) {
      completeAssociates.associates.forEach(a => {
        if (!a.id) return;

        ids.add(a.id);

        edgeMap.set(a.id, {
          source: primaryNode.id,
          target: a.id,
          type: 'offender-link',
          strength: a.strength || 'weak',
          reason: a.reason || 'Known association',
          sharedCaseCount: a.sharedCaseCount ?? 0,
          sharedCaseIds: a.sharedCaseIds || []
        });
      });

      return {
        associateIds: ids,
        edgeByAssociateId: edgeMap
      };
    }

    // Fallback to the currently loaded graph while the complete request
    // is still loading.
    graphData.links.forEach(l => {
      if (l.type !== 'offender-link') return;

      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;

      if (sourceId === primaryNode.id) {
        ids.add(targetId);
        edgeMap.set(targetId, l);
      } else if (targetId === primaryNode.id) {
        ids.add(sourceId);
        edgeMap.set(sourceId, l);
      }
    });

    return {
      associateIds: ids,
      edgeByAssociateId: edgeMap
    };
  }, [graphData, primaryNode, completeAssociates]);
  const handlePrimarySelect = (node) => {
    setPrimaryNode(node);
    setAssociateNode(null);
  };
  const handleAssociateSelect = (node) => setAssociateNode(node);
  const handleBackgroundClick = () => {
    setPrimaryNode(null);
    setAssociateNode(null);
  };

  if (offenderNodesWithCoords.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B96AA', fontSize: 12, textAlign: 'center', padding: 24 }}>
        None of the offenders currently shown have linked cases with real coordinates, so they can't be placed on the map.
      </div>
    );
  }

  const totalAssociateCount = primaryNode
    ? graphData.links.filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return l.type === 'offender-link' && (s === primaryNode.id || t === primaryNode.id);
      }).length
    : 0;
  const mappedAssociateCount = primaryNode
    ? offenderNodesWithCoords.filter(n => associateIds.has(n.id)).length
    : 0;
  const associateEdge = associateNode ? edgeByAssociateId.get(associateNode.id) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 6px', gap: 8, flexWrap: 'wrap' }}>
        {primaryNode && totalAssociateCount > 0 ? (
          <div style={{ fontSize: 11, color: '#8B96AA' }}>
            Showing {mappedAssociateCount} of {totalAssociateCount} associates on the map
          </div>
        ) : <div />}

        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'direct', label: 'Direct Associates' },
            { key: 'all', label: 'All Connections' }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setLinkMode(opt.key)}
              style={{
                padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: linkMode === opt.key ? 'var(--accent)' : '#111827',
                color: linkMode === opt.key ? '#fff' : '#8B96AA',
                border: '1px solid #232D42'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        <MapContainer
          center={[15.3173, 75.7139]}
          zoom={7}
          minZoom={6}
          maxBounds={KARNATAKA_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <OffenderMapLayer
            graphData={graphData}
            primaryId={primaryNode?.id || null}
            associateIds={primaryNode ? associateIds : null}
            completeAssociates={primaryNode ? completeAssociates : null}
            linkMode={linkMode}
            onPrimarySelect={handlePrimarySelect}
            onAssociateSelect={handleAssociateSelect}
            onBackgroundClick={handleBackgroundClick}
          />
                </MapContainer>

        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {primaryNode && (
          <div style={{
            width: 240, background: '#111827',
            border: '1px solid #D9A441', borderRadius: 8, padding: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F3F8' }}>{primaryNode.label}</div>
              <button onClick={handleBackgroundClick} style={{ background: 'none', border: 'none', color: '#8B96AA', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>&times;</button>
            </div>
            <div style={{ fontSize: 11, color: '#D9A441', fontWeight: 600, marginTop: 2 }}>Risk {primaryNode.riskScore}/100</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B96AA' }}>Linked Cases</span>
                <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{primaryNode.caseCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B96AA' }}>Associates</span>
                <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{primaryNode.associateCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B96AA' }}>Districts</span>
                <span style={{ color: '#E8ECF3', fontWeight: 600, textAlign: 'right' }}>{(primaryNode.districts || []).join(', ') || 'Unknown'}</span>
              </div>
            </div>
            <button
              onClick={() => onViewHistory(primaryNode, completeAssociates)}
              style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              View History
            </button>
          </div>
        )}

                {associateNode && (
          <div style={{
            width: 220, background: '#111827',
            border: '1px solid #4A7FB5', borderRadius: 8, padding: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F0F3F8' }}>{associateNode.label}</div>
              <button onClick={() => setAssociateNode(null)} style={{ background: 'none', border: 'none', color: '#8B96AA', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>&times;</button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B96AA' }}>Connection Strength</span>
                <span style={{ color: '#E8ECF3', fontWeight: 600, textTransform: 'capitalize' }}>{associateEdge?.strength || 'Unknown'}</span>
              </div>
              {associateEdge?.reason && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: '#8B96AA' }}>Reason</span>
                  <span style={{ color: '#E8ECF3', fontWeight: 600, textAlign: 'right' }}>{associateEdge.reason}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8B96AA' }}>Linked Cases</span>
                                <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{associateNode.caseCount}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <CrossDistrictLinksTable graphData={graphData} selectedOffenderId={primaryNode?.id || null} />
      </div>
    </div>
  );
}
const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function getPriorityLinkAction(linkType) {
  const lt = (linkType || '').toLowerCase();
  if (lt.includes('network')) return { label: 'Open in Criminal Network', tab: 'network' };
  if (lt.includes('cctv')) return { label: 'Open CCTV Recommendations', tab: 'dashboard' };
  if (lt.includes('patrol') || lt.includes('workload')) return { label: 'Open AI Patrol', tab: 'patrol' };
  if (lt) return { label: `View: ${linkType}`, tab: null };
  return null;
}

function PriorityActionPanel({ functionsBase, onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('priority');

  const [selectedItem, setSelectedItem] = useState(null);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadPriorityActions = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `${functionsBase}/priority-action-function/`
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Priority Action error:', err);
      setError(err.message || 'Unable to load priority actions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPriorityActions();
  }, [functionsBase]);

  const openDetails = (item) => {
    setSelectedItem(item);
    setAiAnswer(null);
  };

  const closeDetails = () => {
    setSelectedItem(null);
    setAiAnswer(null);
  };

  const askAiAboutItem = () => {
    if (!selectedItem) return;
    setAiLoading(true);
    setAiAnswer(null);

    const question = `A police Priority Action Center has flagged this item - use ONLY the facts given here, do not invent anything not stated:
Priority: ${selectedItem.priority}
Category: ${selectedItem.category}
Police Unit / Issue: ${selectedItem.title}
Details: ${selectedItem.detail}
District: ${selectedItem.district || 'Not specified'}
Related action type: ${selectedItem.linkType || 'Not specified'}

Based only on the above: why is this flagged at ${selectedItem.priority} priority, what should an officer review first, and what related data (cases, offenders, CCTV) is relevant here? Keep it factual and concise.`;

    fetch(`${functionsBase}/ask-ai-function/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    })
      .then(res => res.json())
      .then(result => {
        setAiAnswer(result.insight || result.answer || 'No response generated.');
        setAiLoading(false);
      })
      .catch(err => {
        console.error('Priority Ask AI error:', err);
        setAiAnswer('Unable to generate an answer right now.');
        setAiLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="priority-tab-content">
        <div className="priority-loading">
          Loading priority actions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="priority-tab-content">
        <div className="priority-error">
          <strong>Unable to load Priority Action Center</strong>
          <p>{error}</p>

          <button onClick={loadPriorityActions}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const totalCount = data?.totalItems ?? items.length;

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const filteredItems = items
    .filter(item => filterPriority === 'all' || (item.priority || '').toLowerCase() === filterPriority)
    .filter(item => filterCategory === 'all' || item.category === filterCategory)
    .filter(item => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (item.title || '').toLowerCase().includes(q)
        || (item.detail || '').toLowerCase().includes(q)
        || (item.district || '').toLowerCase().includes(q)
        || (item.category || '').toLowerCase().includes(q);
    });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'priority') {
      return (PRIORITY_RANK[(b.priority || '').toLowerCase()] || 0) - (PRIORITY_RANK[(a.priority || '').toLowerCase()] || 0);
    }
    if (sortBy === 'category') {
      return (a.category || '').localeCompare(b.category || '');
    }
    if (sortBy === 'district') {
      return (a.district || '\uffff').localeCompare(b.district || '\uffff');
    }
    return 0;
  });

  const linkAction = selectedItem ? getPriorityLinkAction(selectedItem.linkType) : null;

  return (
    <div className="priority-tab-content">

      <div className="priority-header">
        <div>
          <h2>Priority Action Center</h2>
          <p>
            AI-assisted identification of cases and operational issues
            requiring attention.
          </p>
        </div>

        <button
          className="priority-refresh-btn"
          onClick={loadPriorityActions}
        >
          Refresh
        </button>
      </div>

      <div className="priority-summary">

        <div className="priority-summary-card">
          <span>Total Actions</span>
          <strong>{data?.totalItems ?? 0}</strong>
        </div>

        <div className="priority-summary-card critical">
          <span>🔴 Critical</span>
          <strong>{data?.criticalCount ?? 0}</strong>
        </div>

        <div className="priority-summary-card high">
          <span>🟠 High</span>
          <strong>{data?.highCount ?? 0}</strong>
        </div>

      </div>

      {items.length === 0 ? (
        <div className="priority-empty">
          <strong>No priority actions detected</strong>
          <p>
            The current data does not contain any items requiring
            immediate attention.
          </p>
        </div>
      ) : (
        <>
          <div className="priority-controls">
            <div className="priority-filter-pills">
              {['all', 'critical', 'high'].map(p => (
                <button
                  key={p}
                  className={`priority-pill ${filterPriority === p ? 'active' : ''} priority-pill-${p}`}
                  onClick={() => setFilterPriority(p)}
                >
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            <select
              className="priority-category-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              className="priority-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="priority">Sort: Priority</option>
              <option value="category">Sort: Category</option>
              <option value="district">Sort: District</option>
            </select>

            <input
              className="priority-search-input"
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="priority-count-line">
            Showing {sortedItems.length} of {totalCount}
          </div>

          <div className="priority-table-wrapper">
            <table className="priority-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th className="col-priority">Priority</th>
                  <th className="col-category">Category</th>
                  <th className="col-title">Police Unit / Issue</th>
                  <th className="col-detail">Details</th>
                  <th className="col-district">District</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, index) => {
                  const priorityKey = (item.priority || 'medium').toLowerCase();
                  return (
                    <tr
                      key={`${item.category}-${item.title}-${index}`}
                      className={`priority-row priority-row-${priorityKey}`}
                    >
                      <td className="col-num">{index + 1}</td>
                      <td className="col-priority">
                        <span className={`priority-badge priority-badge-${priorityKey}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="col-category">{item.category}</td>
                      <td className="col-title">{item.title}</td>
                      <td className="col-detail">{item.detail}</td>
                      <td className="col-district">{item.district || '\u2014'}</td>
                      <td className="col-action">
                        <button className="priority-view-details-btn" onClick={() => openDetails(item)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data?.generatedAt && (
        <div className="priority-generated">
          Last updated:{' '}
          {new Date(data.generatedAt).toLocaleString()}
        </div>
      )}

      {selectedItem && (
        <div className="court-modal-overlay" onClick={closeDetails}>
          <div className="court-modal" onClick={e => e.stopPropagation()}>
            <div className="court-modal-header">
              <h4>🚨 Priority Action Details</h4>
              <button className="court-modal-close" onClick={closeDetails}>&times;</button>
            </div>
            <div className="court-modal-body">
              <span className={`priority-badge priority-badge-${(selectedItem.priority || 'medium').toLowerCase()}`}>
                {selectedItem.priority}
              </span>

              <div className="priority-drawer-section">
                <div className="offender-section-title">Category</div>
                <div>{selectedItem.category}</div>
              </div>

              <div className="priority-drawer-section">
                <div className="offender-section-title">Police Unit / Offender / Issue</div>
                <div>{selectedItem.title}</div>
              </div>

              <div className="priority-drawer-section">
                <div className="offender-section-title">District</div>
                <div>{selectedItem.district || 'Not specified'}</div>
              </div>

              <div className="priority-drawer-section">
                <div className="offender-section-title">Why This Item Was Flagged</div>
                <div>{selectedItem.detail}</div>
              </div>

              {linkAction && (
                <div className="priority-drawer-section">
                  <div className="offender-section-title">Recommended Next Action</div>
                  {linkAction.tab ? (
                    <button
                      className="priority-view-details-btn"
                      onClick={() => { onNavigateTab && onNavigateTab(linkAction.tab); closeDetails(); }}
                    >
                      {linkAction.label}
                    </button>
                  ) : (
                    <div>{linkAction.label}</div>
                  )}
                </div>
              )}

              <div className="priority-drawer-section">
                <div className="offender-section-title">Ask AI</div>
                {!aiAnswer && !aiLoading && (
                  <button
                    onClick={askAiAboutItem}
                    style={{ width: '100%', padding: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >
                    Ask AI about this item
                  </button>
                )}
                {aiLoading && <div className="text-muted">Analyzing...</div>}
                {aiAnswer && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{aiAnswer}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function NetworkGraphPanel({ functionsBase }) {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOffender, setSelectedOffender] = useState(null);
const [quickInfoOffender, setQuickInfoOffender] = useState(null);
   const [showCaseNetwork, setShowCaseNetwork] = useState(false);
   const [networkView, setNetworkView] = useState('graph'); // 'graph' | 'map'
    const [showAllLinks, setShowAllLinks] = useState(false);
  const [graphDisplayLimit, setGraphDisplayLimit] = useState(25); // 10 | 25 | 50 | 'all'
  const [districtFilter, setDistrictFilter] = useState('');
  const [crimeTypeFilter, setCrimeTypeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
   const [hideIsolated, setHideIsolated] = useState(false);
  const [riskFilter, setRiskFilter] = useState('');
  const [strengthFilter, setStrengthFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [courtHistory, setCourtHistory] = useState(null);
const [courtHistoryLoading, setCourtHistoryLoading] = useState(false);
const [relatedCasesFilter, setRelatedCasesFilter] = useState(null); // { associateId, associateName, caseIds } | null
  const [completeAssociates, setCompleteAssociates] = useState(null); // full associates for selected offender

  const [highlightNodeIds, setHighlightNodeIds] = useState(null);
  const [highlightLinkSet, setHighlightLinkSet] = useState(null);
const [filterWidth, setFilterWidth] = useState(() => {
    if (typeof window === 'undefined') return 220;
    const stored = parseInt(localStorage.getItem('ksp-network-filter-width'), 10);
    return Number.isFinite(stored) ? stored : 220;
  });
  const [offenderPanelWidth, setOffenderPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 300;
    const stored = parseInt(localStorage.getItem('ksp-network-offender-width'), 10);
    return Number.isFinite(stored) ? stored : 300;
  });

  useEffect(() => {
    try { localStorage.setItem('ksp-network-filter-width', String(filterWidth)); } catch {}
  }, [filterWidth]);


  useEffect(() => {
    try { localStorage.setItem('ksp-network-offender-width', String(offenderPanelWidth)); } catch {}
  }, [offenderPanelWidth]);
  const containerRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const setContainerRef = useCallback((node) => {
    containerRef.current = node;
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (node) {
      const updateSize = () => {
        const rect = node.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      };
      updateSize();
      const ro = new ResizeObserver(updateSize);
      ro.observe(node);
      resizeObserverRef.current = ro;
    }
  }, []);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? Math.max(400, window.innerWidth - 600) : 800,
    height: typeof window !== 'undefined' ? Math.max(400, window.innerHeight - 260) : 560
  });

  useEffect(() => {
        // Request a larger ranked pool than the render budget below, so the
    // frontend can select the actual most-connected offenders by real
    // associateCount/caseCount rather than trusting the backend's smaller
    // default riskScore-based trim. includeCases/includeMedium preserve the
    // existing "Show Case Network" toggle and medium-tier edges.
        fetch(`${functionsBase}/network-graph-function/?limit=150&includeCases=true&includeMedium=true`)
      .then(res => res.json())
      .then(data => {
        setRawData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Network graph fetch error:', err);
        setLoading(false);
      });
  }, [functionsBase]);

  const offenderNodes = useMemo(() => (rawData?.nodes || []).filter(n => n.type === 'offender'), [rawData]);
  const caseNodesAll = useMemo(() => (rawData?.nodes || []).filter(n => n.type === 'case'), [rawData]);
  const offenderEdgesAll = useMemo(() => (rawData?.edges || []).filter(e => e.type === 'offender-link'), [rawData]);
  const caseEdgesAll = useMemo(() => (rawData?.edges || []).filter(e => e.type === 'case-link'), [rawData]);

  const allDistricts = useMemo(() => {
    const s = new Set();
    offenderNodes.forEach(n => (n.districts || []).forEach(d => s.add(d)));
    return [...s].sort();
  }, [offenderNodes]);

  const allCrimeTypes = useMemo(() => {
    const s = new Set();
    offenderNodes.forEach(n => (n.crimeTypeBreakdown || []).forEach(t => s.add(t.crimeType)));
    return [...s].sort();
  }, [offenderNodes]);

  const allYears = useMemo(() => {
    const s = new Set();
    offenderNodes.forEach(n => {
      const y1 = n.firstCaseDate ? new Date(n.firstCaseDate).getFullYear() : null;
      const y2 = n.lastCaseDate ? new Date(n.lastCaseDate).getFullYear() : null;
      if (y1) s.add(y1);
      if (y2) s.add(y2);
    });
    return [...s].sort((a, b) => b - a);
  }, [offenderNodes]);

  const offenderActiveInYear = (n, year) => {
    if (!year) return true;
    const y1 = n.firstCaseDate ? new Date(n.firstCaseDate).getFullYear() : null;
    const y2 = n.lastCaseDate ? new Date(n.lastCaseDate).getFullYear() : null;
    if (y1 === null && y2 === null) return false;
    const lo = Math.min(y1 ?? y2, y2 ?? y1);
    const hi = Math.max(y1 ?? y2, y2 ?? y1);
    return year >= lo && year <= hi;
  };

    const preIsolationFilteredNodes = useMemo(() => offenderNodes.filter(n => {
    if (districtFilter && !(n.districts || []).includes(districtFilter)) return false;
    if (crimeTypeFilter && !(n.crimeTypeBreakdown || []).some(t => t.crimeType === crimeTypeFilter)) return false;
    if (yearFilter && !offenderActiveInYear(n, Number(yearFilter))) return false;
    if (riskFilter === 'high' && (n.riskScore || 0) < 80) return false;
    if (riskFilter === 'medium' && ((n.riskScore || 0) < 50 || (n.riskScore || 0) >= 80)) return false;
    if (riskFilter === 'low' && (n.riskScore || 0) >= 50) return false;
        return true;
  }), [offenderNodes, districtFilter, crimeTypeFilter, yearFilter, riskFilter]);

  const preIsolationIds = useMemo(() => new Set(preIsolationFilteredNodes.map(n => n.id)), [preIsolationFilteredNodes]);

  const filteredOffenderNodes = useMemo(() => {
    if (!hideIsolated) return preIsolationFilteredNodes;
    const connectedIds = new Set();
    offenderEdgesAll.forEach(e => {
      if (preIsolationIds.has(e.source) && preIsolationIds.has(e.target)) {
        connectedIds.add(e.source);
        connectedIds.add(e.target);
      }
    });
    return preIsolationFilteredNodes.filter(n => connectedIds.has(n.id));
  }, [preIsolationFilteredNodes, preIsolationIds, hideIsolated, offenderEdgesAll]);

  const filteredIds = useMemo(() => new Set(filteredOffenderNodes.map(n => n.id)), [filteredOffenderNodes]);

  const fgRef = useRef();

    const strengthRankFilter = { strong: 1, medium: 2, weak: 3 };
  const graphData = useMemo(() => {
    const offenderLinks = offenderEdgesAll
      .filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
      .filter(e => !strengthFilter || strengthRankFilter[e.strength] <= strengthRankFilter[strengthFilter])
      .map(e => ({ ...e }));

    if (!showCaseNetwork) {
      return { nodes: filteredOffenderNodes.map(n => ({ ...n })), links: offenderLinks };
    }

    const relevantCaseEdges = caseEdgesAll.filter(e => filteredIds.has(e.source));
    const relevantCaseIds = new Set(relevantCaseEdges.map(e => e.target));
    const relevantCaseNodes = caseNodesAll.filter(n => relevantCaseIds.has(n.id));

    return {
      nodes: [...filteredOffenderNodes.map(n => ({ ...n })), ...relevantCaseNodes.map(n => ({ ...n }))],
      links: [...offenderLinks, ...relevantCaseEdges.map(e => ({ ...e }))]
    };
   }, [showCaseNetwork, filteredOffenderNodes, filteredIds, offenderEdgesAll, caseEdgesAll, caseNodesAll, strengthFilter]);
const connectedAssociates = useMemo(() => {
  if (!selectedOffender) return [];

  // Prefer the complete associate list returned from the full backend graph.
  // Fall back to the currently loaded graph if the request has not completed.
  if (
    completeAssociates &&
    Array.isArray(completeAssociates.associates) &&
    (
      completeAssociates.aadhaar === selectedOffender.aadhaar ||
      completeAssociates.offenderId === selectedOffender.id
    )
  ) {
    return completeAssociates.associates.map(a => ({
      ...a,
      sharedCaseIds: a.sharedCaseIds || []
    }));
  }

  const myId = selectedOffender.id;

  return graphData.links
    .filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return l.type === 'offender-link' && (s === myId || t === myId);
    })
    .map(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      const otherId = s === myId ? t : s;
      const otherNode = graphData.nodes.find(n => n.id === otherId);

      return {
        id: otherId,
        name: otherNode?.label || 'Unknown',
        riskScore: otherNode?.riskScore ?? null,
        caseCount: otherNode?.caseCount ?? null,
        strength: l.strength,
        reason: l.reason,
        sharedCaseCount: l.sharedCaseCount ?? 0,
        sharedCaseIds: l.sharedCaseIds || []
      };
    });
}, [selectedOffender, completeAssociates, graphData]);

   // ---- Network View radial layout ----
  // Replaces the old force-directed layout with a fixed, intelligence-style
  // one: a center offender (selected, or -- with nothing selected -- the
  // single most-connected offender among the displayed pool) with real
  // direct associates arranged around them in strength-grouped arcs
  // (multiple concentric rings per group when there are many associates, so
  // labels stay legible). Only edges touching the center are ever drawn --
  // never a full mesh. Case nodes are only included when "Show Case Network"
  // is on, and sit near their parent offender rather than getting a ring.
  const RING_CAPACITY = 14;
  const GROUP_GAP_RAD = 8 * Math.PI / 180;

  function layoutRing(items, angleStart, angleEnd, baseRadius, ringGap) {
    const positions = [];
    let idx = 0;
    let ring = 0;
    while (idx < items.length) {
      const ringItems = items.slice(idx, idx + RING_CAPACITY);
      idx += RING_CAPACITY;
      const radius = baseRadius + ring * ringGap;
      const span = angleEnd - angleStart;
      const step = span / (ringItems.length + 1);
      ringItems.forEach((item, i) => {
        const angle = angleStart + step * (i + 1);
        positions.push({ id: item.id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
      ring++;
    }
    return positions;
  }

 const networkViewGraphData = useMemo(() => {
    const offendersInScope = graphData.nodes.filter(n => n.type === 'offender');
    const nodeById = new Map(graphData.nodes.map(n => [n.id, n]));
    const positionById = new Map();
    let extraNodeById = new Map();   // <-- NEW: holds full associate objects not in the trimmed set
    let centerNode = null;
    let shownOffenderIds;
    let linksToDraw;

    if (selectedOffender && (nodeById.has(selectedOffender.id) || completeAssociates?.aadhaar === selectedOffender.aadhaar)) {
      centerNode = nodeById.get(selectedOffender.id) || selectedOffender;
      positionById.set(centerNode.id, { x: 0, y: 0 });

      const byStrength = { strong: [], medium: [], weak: [] };
      const edgesFromCenter = [];

      if (
        completeAssociates &&
        completeAssociates.aadhaar === selectedOffender.aadhaar &&
        Array.isArray(completeAssociates.associates)
      ) {
        completeAssociates.associates.forEach(a => {
          const associateNode = {
            id: a.id,
            type: 'offender',
            label: a.name || 'Unknown',
            aadhaar: a.aadhaar || null,
            riskScore: a.riskScore ?? 0,
            caseCount: a.caseCount ?? 0,
            centroidLat: a.centroidLat ?? null,
            centroidLon: a.centroidLon ?? null
          };

          extraNodeById.set(a.id, associateNode);   // <-- NEW: remember it regardless of trimmed set
          (byStrength[a.strength] || byStrength.weak).push(associateNode);

          edgesFromCenter.push({
            source: centerNode.id,
            target: a.id,
            type: 'offender-link',
            strength: a.strength,
            reason: a.reason,
            sharedCaseCount: a.sharedCaseCount ?? 0,
            sharedCaseIds: a.sharedCaseIds || []
          });
        });
      } else {
        graphData.links.forEach(l => {
          if (l.type !== 'offender-link') return;
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          if (s !== centerNode.id && t !== centerNode.id) return;
          const otherId = s === centerNode.id ? t : s;
          const otherNode = nodeById.get(otherId);
          if (!otherNode) return;
          (byStrength[l.strength] || byStrength.weak).push(otherNode);
          edgesFromCenter.push(l);
        });
      }

      const groups = ['strong', 'medium', 'weak']
        .map(key => ({ key, items: byStrength[key] }))
        .filter(g => g.items.length > 0);
      const groupCount = groups.length || 1;
      const arcSize = (2 * Math.PI - GROUP_GAP_RAD * groupCount) / groupCount;
      let cursor = -Math.PI / 2;
      groups.forEach(g => {
        const start = cursor;
        const end = cursor + arcSize;
        layoutRing(g.items, start, end, 140, 90).forEach(p => positionById.set(p.id, p));
        cursor = end + GROUP_GAP_RAD;
      });

      shownOffenderIds = new Set([centerNode.id, ...Object.values(byStrength).flat().map(n => n.id)]);
      linksToDraw = edgesFromCenter;
    } else {
      const limitNum = graphDisplayLimit === 'all' ? Infinity : graphDisplayLimit;
      const sorted = [...offendersInScope].sort((a, b) =>
        (b.associateCount || 0) - (a.associateCount || 0) || (b.caseCount || 0) - (a.caseCount || 0)
      );
      const shown = limitNum === Infinity ? sorted : sorted.slice(0, limitNum);
      if (shown.length === 0) {
        return { nodes: [], links: [], centerId: null };
      }
      centerNode = shown[0];
      const ring = shown.slice(1);
      positionById.set(centerNode.id, { x: 0, y: 0 });
      layoutRing(ring, -Math.PI, Math.PI, 160, 100).forEach(p => positionById.set(p.id, p));

      shownOffenderIds = new Set(shown.map(n => n.id));
      linksToDraw = graphData.links.filter(l => {
        if (l.type !== 'offender-link') return false;
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === centerNode.id && shownOffenderIds.has(t)) || (t === centerNode.id && shownOffenderIds.has(s));
      });
    }

    // CHANGED: fall back to centerNode / extraNodeById before nodeById, so
    // associates outside the trimmed 300-node set are never silently dropped.
    const shownOffenderNodes = [...shownOffenderIds]
      .map(id => (id === centerNode.id ? centerNode : extraNodeById.get(id)) || nodeById.get(id))
      .filter(Boolean)
      .map(n => ({ ...n, fx: positionById.get(n.id)?.x ?? 0, fy: positionById.get(n.id)?.y ?? 0, x: positionById.get(n.id)?.x ?? 0, y: positionById.get(n.id)?.y ?? 0 }));

    let allNodes = shownOffenderNodes;
    let allLinks = linksToDraw.map(l => ({ ...l }));

    if (showCaseNetwork) {
      const caseEdges = graphData.links.filter(l =>
        l.type === 'case-link' && shownOffenderIds.has(typeof l.source === 'object' ? l.source.id : l.source)
      );
      const caseNodesToShow = [];
      const caseOffsetCounter = new Map();
      caseEdges.forEach(l => {
        const offenderId = typeof l.source === 'object' ? l.source.id : l.source;
        const caseId = typeof l.target === 'object' ? l.target.id : l.target;
        const caseNode = nodeById.get(caseId);
        if (!caseNode) return;
        const parentPos = positionById.get(offenderId) || { x: 0, y: 0 };
        const n = caseOffsetCounter.get(offenderId) || 0;
        caseOffsetCounter.set(offenderId, n + 1);
        const angle = n * 0.9;
        caseNodesToShow.push({
          ...caseNode,
          fx: parentPos.x + Math.cos(angle) * 22,
          fy: parentPos.y + Math.sin(angle) * 22,
          x: parentPos.x + Math.cos(angle) * 22,
          y: parentPos.y + Math.sin(angle) * 22
        });
      });
      allNodes = [...allNodes, ...caseNodesToShow];
      allLinks = [...allLinks, ...caseEdges.map(l => ({ ...l }))];
    }

    // NEW: defense in depth -- ForceGraph2D must never see a link whose
    // endpoint isn't in the node list, no matter what upstream logic changes.
    const finalNodeIdSet = new Set(allNodes.map(n => n.id));
    allLinks = allLinks.filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return finalNodeIdSet.has(s) && finalNodeIdSet.has(t);
    });

    return { nodes: allNodes, links: allLinks, centerId: centerNode?.id || null };
   }, [graphData, selectedOffender, completeAssociates, graphDisplayLimit, showCaseNetwork]);
  useEffect(() => {
    if (fgRef.current) fgRef.current.d3ReheatSimulation();
  }, [networkViewGraphData]);

    const selectedOffenderCases = useMemo(() => {    if (!selectedOffender) return [];
    const myCaseEdges = caseEdgesAll.filter(e => e.source === selectedOffender.id);
    let myCaseIds = new Set(myCaseEdges.map(e => e.target));
    // When a "Related Cases" filter is active, narrow to only the FIRs
    // shared with that specific associate, without altering the underlying
    // case/edge data itself.
    if (relatedCasesFilter && relatedCasesFilter.caseIds) {
      const sharedSet = new Set(relatedCasesFilter.caseIds);
      myCaseIds = new Set([...myCaseIds].filter(id => sharedSet.has(id)));
    }
    return caseNodesAll
      .filter(n => myCaseIds.has(n.id))
      .sort((a, b) => (a.dateOfFIR || '').localeCompare(b.dateOfFIR || ''));
  }, [selectedOffender, caseEdgesAll, caseNodesAll, relatedCasesFilter]);

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    if (dimensions.width === 0 || dimensions.height === 0) return;
    const t = setTimeout(() => {
      fgRef.current.zoomToFit(400, 50);
    }, 300);
    return () => clearTimeout(t);
  }, [graphData, dimensions.width, dimensions.height]);

  const stats = useMemo(() => {
    const repeatOffenderCount = offenderNodes.filter(n => (n.caseCount || 0) > 1).length;
    const highRiskCount = offenderNodes.filter(n => (n.riskScore || 0) >= 80).length;
    const crossDistrictCount = offenderNodes.filter(n => (n.districts || []).length > 1).length;
    const avgAssociates = offenderNodes.length
      ? (offenderNodes.reduce((sum, n) => sum + (n.associateCount || 0), 0) / offenderNodes.length).toFixed(1)
      : '0';
    const repeatOffenderPct = offenderNodes.length
      ? Math.round((repeatOffenderCount / offenderNodes.length) * 100)
      : 0;
    const mostConnected = offenderNodes.reduce((max, n) =>
      (n.associateCount || 0) > (max?.associateCount || 0) ? n : max, null);

        return {
      // Prefer real backend totals (computed from the full 56k+ dataset)
      // over counts from offenderNodes, which is only the trimmed subset
      // sent to the browser for map/graph rendering.
      totalOffenders: rawData?.totalAccusedProcessed ?? offenderNodes.length,
      totalCasesLinked: rawData?.totalCasesLinked ?? caseNodesAll.length,
      networkNodes: rawData?.networkNodes ?? (offenderNodes.length + caseNodesAll.length),
      networkEdges: rawData?.networkEdges ?? (offenderEdgesAll.length + caseEdgesAll.length),
      avgRisk: rawData?.averageRiskScore ?? 0,
      repeatOffenderCount: rawData?.repeatOffenderCount ?? repeatOffenderCount,
      highRiskCount,
      crossDistrictCount,
      avgAssociates,
      repeatOffenderPct,
      mostConnected
    };
  }, [rawData, offenderNodes, caseNodesAll, offenderEdgesAll, caseEdgesAll]);

  const handleNodeClick = (node) => {
    if (node.type !== 'offender') return;

    setQuickInfoOffender(node);
    setAiSummary(null);
    setCourtHistory(null);
    setCourtHistoryLoading(false);
    setCompleteAssociates(null);

    const connectedLinks = graphData.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return sourceId === node.id || targetId === node.id;
    });

    const connectedIds = new Set([node.id]);
    connectedLinks.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      connectedIds.add(sourceId);
      connectedIds.add(targetId);
    });

    setHighlightNodeIds(connectedIds);
    setHighlightLinkSet(new Set(connectedLinks));


  };
 const [profileLoading, setProfileLoading] = useState(false);
const [profileHistory, setProfileHistory] = useState([]);       // array of aadhaar strings
const [profileHistoryIndex, setProfileHistoryIndex] = useState(-1);

// Canonical loader -- the ONLY path that opens a full offender profile,
// from Map, Network, associate cards, or Previous/Next.
const loadOffenderProfile = useCallback((aadhaar, { pushHistory = true } = {}) => {
    if (!aadhaar) return;

    setQuickInfoOffender(null);
    setAiSummary(null);
    setCourtHistory(null);
    setCourtHistoryLoading(false);
    setCompleteAssociates(null);
    setProfileLoading(true);

    fetch(`${functionsBase}/network-graph-function/?offenderId=${encodeURIComponent(aadhaar)}&mode=profile`)
        .then(res => {
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            return res.json();
        })
        .then(profile => {
            setSelectedOffender(profile);
            setProfileLoading(false);
            if (pushHistory) {
                setProfileHistory(h => [...h.slice(0, profileHistoryIndex + 1), aadhaar]);
                setProfileHistoryIndex(i => i + 1);
            }
        })
        .catch(err => {
            console.error('Profile fetch error:', err);
            setProfileLoading(false);
        });

    fetch(`${functionsBase}/network-graph-function/?offenderId=${encodeURIComponent(aadhaar)}&mode=associates`)
        .then(res => {
            if (!res.ok) throw new Error(`Associates request failed: ${res.status}`);
            return res.json();
        })
        .then(data => setCompleteAssociates(data))
        .catch(err => console.error('Associates fetch error:', err));
}, [functionsBase, profileHistoryIndex]);

const goToPreviousProfile = () => { console.log("PREV CLICKED", profileHistoryIndex, profileHistory);
    if (profileHistoryIndex <= 0) return;
    const prevIndex = profileHistoryIndex - 1;
    setProfileHistoryIndex(prevIndex);
    loadOffenderProfile(profileHistory[prevIndex], { pushHistory: false });
};

const goToNextProfile = () => { console.log("NEXT CLICKED", profileHistoryIndex, profileHistory);
    if (profileHistoryIndex >= profileHistory.length - 1) return;
    const nextIndex = profileHistoryIndex + 1;
    setProfileHistoryIndex(nextIndex);
    loadOffenderProfile(profileHistory[nextIndex], { pushHistory: false });
};


  
  // Search finds and selects a match (revealing their real connections),
  // rather than hiding every other offender -- a single isolated match had
  // no one left to draw a link to.
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const match = offenderNodes.find(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()));
    if (match) {
      const graphNode = graphData.nodes.find(n => n.id === match.id);
      if (graphNode) handleNodeClick(graphNode);
    }
  }, [searchTerm]);

  const clearSelection = () => {
  setSelectedOffender(null);
  setQuickInfoOffender(null);
  setAiSummary(null);
  setCourtHistory(null);
  setCourtHistoryLoading(false);
  setHighlightNodeIds(null);
  setHighlightLinkSet(null);
  setCompleteAssociates(null);   // <-- was missing; stops stale-data leakage
};
// Closing the offender profile modal should only clear the profile itself --
// not the map/graph's own highlight state, which belongs to whichever view
// is underneath and should still be visible once the modal is gone.
const closeOffenderProfile = () => {
  setSelectedOffender(null);
  setQuickInfoOffender(null);
  setAiSummary(null);
  setCourtHistory(null);
  setCourtHistoryLoading(false);
  setCompleteAssociates(null);
};

const fetchCourtHistory = () => {
  if (!selectedOffender) return;
  setCourtHistoryLoading(true);
  fetch(`${functionsBase}/case-court-history-function/?aadhaar=${encodeURIComponent(selectedOffender.aadhaar)}`)
    .then(res => res.json())
    .then(data => { setCourtHistory(data); setCourtHistoryLoading(false); })
    .catch(err => { console.error('Court history fetch error:', err); setCourtHistoryLoading(false); });
};

  const generateSummary = () => {
    if (!selectedOffender) return;
    setAiSummaryLoading(true);
    fetch(`${functionsBase}/network-graph-function/?offenderId=${encodeURIComponent(selectedOffender.aadhaar)}&mode=summary`)
      .then(res => res.json())
      .then(d => {
        setAiSummary(d.summary || 'No summary available.');
        setAiSummaryLoading(false);
      })
      .catch(err => {
        console.error('AI summary error:', err);
        setAiSummary('Unable to generate summary right now.');
        setAiSummaryLoading(false);
      });
  };

  if (loading) {
    return <div className="network-panel-loading mono">Loading criminal network data...</div>;
  }

  if (!rawData || offenderNodes.length === 0) {
    return (
      <div className="network-panel-empty">
        <p>No repeat offenders detected in current data.</p>
        <p className="text-muted">This view highlights individuals linked to 2 or more cases.</p>
      </div>
    );
  }

  const isDimmed = (id) => highlightNodeIds !== null && !highlightNodeIds.has(id);

    

  const nodeColor = (n) => {
    const baseColor = n.type === 'offender' ? getRiskColor(n.riskScore || 0) : CASE_NODE_COLOR;
    return isDimmed(n.id) ? FADE_COLOR : baseColor;
  };

  const linkColor = (l) => {
    const baseColor = l.strength === 'strong'
      ? 'rgba(224, 138, 62, 0.9)'
      : l.strength === 'medium'
        ? 'rgba(74, 127, 181, 0.65)'
        : 'rgba(139, 150, 170, 0.35)';
    if (highlightLinkSet !== null && !highlightLinkSet.has(l)) return FADE_LINK_COLOR;
    return baseColor;
  };
  const linkWidth = (l) => (l.strength === 'strong' ? 2.5 : l.strength === 'medium' ? 1.5 : 1);
  const linkDash = (l) => (l.strength === 'weak' ? [4, 2] : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 180px)', minHeight: 500 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, flexShrink: 0 }}>
        <StatCard label="Total Offenders" value={stats.totalOffenders} />
        <StatCard label="Total Cases Linked" value={stats.totalCasesLinked} />
        <StatCard label="Network Nodes" value={stats.networkNodes} />
        <StatCard label="Total Connections" value={stats.networkEdges} />
        <StatCard label="Average Risk Score" value={`${stats.avgRisk}/100`} />
        <StatCard label="Repeat Offenders" value={stats.repeatOffenderCount} />
        <StatCard label="High-Risk Offenders (80+)" value={stats.highRiskCount} />
                <StatCard label="Cross-District Networks" value={stats.crossDistrictCount} />
      </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={() => setNetworkView('graph')}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: networkView === 'graph' ? 'var(--accent)' : '#111827',
              color: networkView === 'graph' ? '#fff' : '#8B96AA',
              border: '1px solid #232D42'
            }}
          >
            🕸 Network View
          </button>
          <button
            onClick={() => setNetworkView('map')}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: networkView === 'map' ? 'var(--accent)' : '#111827',
              color: networkView === 'map' ? '#fff' : '#8B96AA',
              border: '1px solid #232D42'
            }}
          >
            🗺 Map View
          </button>
          
       
        </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
       <div style={{ width: filterWidth, flexShrink: 0, background: '#111827', border: '1px solid #232D42', borderRadius: 8, padding: 16, overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 12px', color: '#E8ECF3', fontSize: 14 }}>Filters</h4>

          <label style={{ fontSize: 11, color: '#8B96AA', display: 'block', marginBottom: 4 }}>District</label>
          <select
            style={{ width: '100%', marginBottom: 12, background: '#0F1523', color: '#E8ECF3', border: '1px solid #232D42', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
            value={districtFilter}
            onChange={e => setDistrictFilter(e.target.value)}
          >
            <option value="">All Districts</option>
            {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <label style={{ fontSize: 11, color: '#8B96AA', display: 'block', marginBottom: 4 }}>Crime Type</label>
          <select
            style={{ width: '100%', marginBottom: 12, background: '#0F1523', color: '#E8ECF3', border: '1px solid #232D42', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
            value={crimeTypeFilter}
            onChange={e => setCrimeTypeFilter(e.target.value)}
          >
            <option value="">All Crime Types</option>
            {allCrimeTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={{ fontSize: 11, color: '#8B96AA', display: 'block', marginBottom: 4 }}>Search Offender</label>
          <input
            style={{ width: '100%', marginBottom: 12, background: '#0F1523', color: '#E8ECF3', border: '1px solid #232D42', borderRadius: 4, padding: '6px 8px', fontSize: 12, boxSizing: 'border-box' }}
            placeholder="Name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          <label style={{ fontSize: 11, color: '#8B96AA', display: 'block', marginBottom: 4 }}>Year</label>
          <select
            style={{ width: '100%', marginBottom: 12, background: '#0F1523', color: '#E8ECF3', border: '1px solid #232D42', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
          >
            <option value="">All Years</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <label style={{ fontSize: 12, color: '#C7CEDA', display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input type="checkbox" checked={hideIsolated} onChange={e => setHideIsolated(e.target.checked)} />
            Hide Isolated Nodes
          </label>

          <label style={{ fontSize: 12, color: '#C7CEDA', display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input type="checkbox" checked={showCaseNetwork} onChange={e => setShowCaseNetwork(e.target.checked)} />
            Show Case Network
          </label>

          <div style={{ marginTop: 20, borderTop: '1px solid #232D42', paddingTop: 12 }}>
            <h5 style={{ margin: '0 0 8px', color: '#8B96AA', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Legend</h5>
            <LegendRow color={RISK_HIGH} label="High Risk (80-100)" shape="circle" />
            <LegendRow color={RISK_MED} label="Medium Risk (50-79)" shape="circle" />
            <LegendRow color={RISK_LOW} label="Low Risk (<50)" shape="circle" />
            {showCaseNetwork && <LegendRow color={CASE_NODE_COLOR} label="Case" shape="square" />}
            <LegendRow color="#E08A3E" label="Strong Association" line />
            <LegendRow color="rgba(74,127,181,0.8)" label="Medium Association" line />
            <LegendRow color="#8B96AA" label="Weak Association" line dashed />
          </div>
        </div>
<ResizeHandle
          currentWidth={filterWidth}
          setWidth={setFilterWidth}
          min={160}
          max={480}
          direction="grow-right"
          defaultWidth={220}
        />

        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              boxSizing: 'border-box',
              background: '#0F1523',
              border: '1px solid #232D42',
              borderRadius: 8,
              padding: 16,
              display: 'flex'
            }}
          >
                        <div style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: 0 }} ref={setContainerRef}>
              {networkView === 'graph' ? (
                <>
                  {/* Network display controls */}
                  <div style={{
                    position: 'absolute', top: 10, left: 10, zIndex: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(15,21,35,0.94)',
                    border: '1px solid #26344F', borderRadius: 8, padding: '6px 8px'
                  }}>
                    <span style={{ color: '#8B96AA', fontSize: 11 }}>Show:</span>
                    {[10, 25, 50, 'all'].map(limit => (
                      <button
                        key={limit}
                        onClick={() => setGraphDisplayLimit(limit)}
                        style={{
                          padding: '4px 8px', borderRadius: 5,
                          border: '1px solid #33415C',
                          background: graphDisplayLimit === limit ? '#2563EB' : '#111827',
                          color: '#E8ECF3', cursor: 'pointer', fontSize: 11,
                          fontWeight: graphDisplayLimit === limit ? 700 : 400
                        }}
                      >
                        {limit === 'all' ? 'All' : `Top ${limit}`}
                      </button>
                    ))}
                  </div>

                  <div style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 10,
                    display: 'flex', flexDirection: 'column', gap: 4
                  }}>
                    <button
                      onClick={() => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() * 1.3, 200)}
                      style={{ width: 30, height: 30, background: '#111827', border: '1px solid #33415C', color: '#E8ECF3', borderRadius: 5, cursor: 'pointer', fontSize: 16 }}
                    >+</button>
                    <button
                      onClick={() => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() * 0.77, 200)}
                      style={{ width: 30, height: 30, background: '#111827', border: '1px solid #33415C', color: '#E8ECF3', borderRadius: 5, cursor: 'pointer', fontSize: 16 }}
                    >-</button>
                    <button
                      onClick={() => fgRef.current && fgRef.current.zoomToFit(500, 70)}
                      style={{ width: 30, height: 30, background: '#111827', border: '1px solid #33415C', color: '#E8ECF3', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}
                                        >/</button>
                  </div>

                  {quickInfoOffender && !selectedOffender && (
                    <div style={{
                      position: 'absolute', top: 60, right: 10, zIndex: 10,
                      width: 240, background: '#111827',
                      border: '1px solid #D9A441', borderRadius: 8, padding: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F3F8' }}>{quickInfoOffender.label}</div>
                        <button onClick={() => setQuickInfoOffender(null)} style={{ background: 'none', border: 'none', color: '#8B96AA', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>&times;</button>
                      </div>
                      <div style={{ fontSize: 11, color: '#D9A441', fontWeight: 600, marginTop: 2 }}>Risk {quickInfoOffender.riskScore}/100</div>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8B96AA' }}>Linked Cases</span>
                          <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{quickInfoOffender.caseCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8B96AA' }}>Associates</span>
                          <span style={{ color: '#E8ECF3', fontWeight: 600 }}>{quickInfoOffender.associateCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8B96AA' }}>Districts</span>
                          <span style={{ color: '#E8ECF3', fontWeight: 600, textAlign: 'right' }}>{(quickInfoOffender.districts || []).join(', ') || 'Unknown'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => loadOffenderProfile(quickInfoOffender.aadhaar)}
                        style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                      >
                        View History
                      </button>
                    </div>
                  )}

                  <ForceGraph2D
                    ref={fgRef}
                    graphData={networkViewGraphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    backgroundColor="#0F1523"
                    nodeRelSize={6}
                    nodeVal={n =>
                      n.type === 'offender'
                        ? Math.max(5, Math.min(16, 5 + (n.associateCount || 0) / 12))
                        : 3
                    }
                    nodeColor={n => {
                      if (n.id === networkViewGraphData.centerId) return '#F5B942';
                      if (n.type === 'case') return '#64748B';
                      return getRiskColor(n.riskScore || 0);
                    }}
                    nodeLabel={n =>
                      n.type === 'offender'
                        ? `${n.label}   ${n.associateCount || 0} associates   Risk ${n.riskScore || 0}/100`
                        : `${n.label}   ${n.crimeType || 'Unknown crime'}`
                    }
                    nodeCanvasObject={(node, ctx, globalScale) => {
                      if (node.type === 'case') {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 3, 0, 2 * Math.PI);
                        ctx.fillStyle = '#64748B';
                        ctx.fill();
                        return;
                      }

                      const isCenter = node.id === networkViewGraphData.centerId;
                      const radius = isCenter
                        ? 12
                        : Math.max(5, Math.min(11, 5 + (node.associateCount || 0) / 15));

                      ctx.beginPath();
                      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                      ctx.fillStyle = isCenter ? '#F5B942' : getRiskColor(node.riskScore || 0);
                      ctx.fill();

                      ctx.lineWidth = isCenter ? 3 : 1;
                      ctx.strokeStyle = isCenter ? '#FFFFFF' : 'rgba(255,255,255,0.25)';
                      ctx.stroke();

                      if (globalScale > 0.65 || isCenter) {
                        const fontSize = isCenter ? 13 / globalScale : 10 / globalScale;
                        ctx.font = `${isCenter ? '700' : '500'} ${fontSize}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';

                        const label = node.label && node.label.length > 20
                          ? node.label.slice(0, 20) + ' '
                          : node.label;

                        ctx.fillStyle = '#E8ECF3';
                        ctx.fillText(label, node.x, node.y + radius + (isCenter ? 5 : 3));

                        if (isCenter) {
                          ctx.font = `600 ${10 / globalScale}px Arial`;
                          ctx.fillStyle = '#F5B942';
                          ctx.fillText(
                            `${node.associateCount || 0} associates`,
                            node.x,
                            node.y + radius + 18
                          );
                        }
                      }
                    }}
                    nodePointerAreaPaint={(node, color, ctx) => {
                      const radius = node.type === 'offender'
                        ? (node.id === networkViewGraphData.centerId ? 16 : 12)
                        : 6;
                      ctx.fillStyle = color;
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                      ctx.fill();
                    }}
                    linkColor={l =>
                      l.strength === 'strong' ? '#E08A3E' :
                      l.strength === 'medium' ? '#4A7FB5' : '#667085'
                    }
                    linkWidth={l =>
                      l.strength === 'strong' ? 2.5 :
                      l.strength === 'medium' ? 1.5 : 1
                    }
                    linkLineDash={l => l.strength === 'weak' ? [4, 4] : null}
                    onNodeClick={handleNodeClick}
                    onBackgroundClick={clearSelection}
                    enableZoomInteraction={true}
                    enablePanInteraction={true}
                    cooldownTime={300}
warmupTicks={20}
                    onEngineStop={() => {
                      if (fgRef.current) fgRef.current.zoomToFit(500, 70);
                    }}
                  />
                </>
                               ) : (
                                                                      <OffenderMapView
                      graphData={graphData}
                                            onViewHistory={(node) => loadOffenderProfile(node.aadhaar)}
                      externalSelectedNode={quickInfoOffender}
                      completeAssociates={completeAssociates}
                    />
                  )}
              {!selectedOffender && graphDisplayLimit !== 'all' && graphData.nodes.filter(n => n.type === 'offender').length > graphDisplayLimit && (
                <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 10, background: 'rgba(17,24,39,0.85)', color: '#8B96AA', fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #232D42' }}>
                  Showing top connected network • {graphDisplayLimit} of {graphData.nodes.filter(n => n.type === 'offender').length}
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedOffender && (
    <div className="court-modal-overlay" onClick={closeOffenderProfile}>
    <div className="court-modal offender-modal" onClick={e => e.stopPropagation()}>
     <div className="court-modal-header">
  <h4>👤 Offender Profile</h4>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <button
      onClick={goToPreviousProfile}
      disabled={profileHistoryIndex <= 0}
      style={{
        padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
        background: '#111827', color: profileHistoryIndex <= 0 ? '#4B5568' : '#E8ECF3',
        border: '1px solid #232D42',
        cursor: profileHistoryIndex <= 0 ? 'not-allowed' : 'pointer'
      }}
    >
      ‹ Previous
    </button>
    <button
      onClick={goToNextProfile}
      disabled={profileHistoryIndex >= profileHistory.length - 1}
      style={{
        padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
        background: '#111827', color: profileHistoryIndex >= profileHistory.length - 1 ? '#4B5568' : '#E8ECF3',
        border: '1px solid #232D42',
        cursor: profileHistoryIndex >= profileHistory.length - 1 ? 'not-allowed' : 'pointer'
      }}
    >
      Next ›
    </button>
       <button className="court-modal-close" onClick={closeOffenderProfile}>&times;</button>
  </div>
</div> 
      <div className="court-modal-body">
        <div className="offender-modal-hero">
          <div>
            <div className="offender-modal-name">{selectedOffender.label}</div>
            <div className="offender-modal-id">ID: {selectedOffender.aadhaar}</div>
          </div>
          <div className="risk-badge" style={{ background: `${getRiskColor(selectedOffender.riskScore || 0)}22`, color: getRiskColor(selectedOffender.riskScore || 0) }}>
            <div className="risk-badge-score">{selectedOffender.riskScore}</div>
            <div className="risk-badge-label">Risk /100</div>
          </div>
        </div>

        <DetailRow label="Total Linked Cases" value={selectedOffender.caseCount} />
        <DetailRow
          label="Known Associates"
          value={
            connectedAssociates.length > 0
              ? connectedAssociates.length
              : selectedOffender.associateCount
          }
        />
        <DetailRow label="Districts" value={(selectedOffender.districts || []).join(', ') || 'Unknown'} />
        <DetailRow label="First Case" value={selectedOffender.firstCaseDate || 'Unknown'} />
        <DetailRow label="Last Case" value={selectedOffender.lastCaseDate || 'Unknown'} />

        <div className="offender-section-title">Crime Type Breakdown</div>
        {(selectedOffender.crimeTypeBreakdown || []).map(t => (
          <div key={t.crimeType} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#C7CEDA', padding: '3px 0' }}>
            <span>{t.crimeType}</span><span>{t.count}</span>
          </div>
        ))}

        <div className="offender-section-title">Connected To ({connectedAssociates.length})</div>
        {connectedAssociates.length === 0 && <div className="court-empty-note">No known associates in the current graph view.</div>}
                {connectedAssociates.map(a => (
  <div
    key={a.id}
    className="associate-card"
    onClick={() => {
      setRelatedCasesFilter(null);
      loadOffenderProfile(a.aadhaar);
    }}
    style={{
      cursor: 'pointer'
    }}
    title={`Open ${a.name || 'associate'} profile`}
  >
    <div>
      <div className="associate-name">{a.name}</div>
      <div className="associate-reason">{a.reason}</div>
      <div style={{ fontSize: 11, color: '#8B96AA', marginTop: 2 }}>
        {a.sharedCaseCount} related FIR{a.sharedCaseCount === 1 ? '' : 's'}
      </div>
    </div>

    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4
    }}>
      <span
        className={`associate-strength ${a.strength}`}
        title="Association Strength"
      >
        {a.strength}
      </span>

      {a.sharedCaseCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRelatedCasesFilter({
              associateId: a.id,
              associateName: a.name,
              caseIds: a.sharedCaseIds || []
            });
          }}
          style={{
            fontSize: 10,
            padding: '3px 8px',
            background: '#1A2438',
            border: '1px solid #232D42',
            color: '#D9A441',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Related Cases
        </button>
      )}

      <span style={{
        fontSize: 9.5,
        color: '#4A7FB5'
      }}>
        View Profile ?
      </span>
    </div>
  </div>
))}

                {relatedCasesFilter && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1A2438', border: '1px solid #D9A441', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11 }}>
            <span style={{ color: '#E8ECF3' }}>Showing FIRs shared with <strong>{relatedCasesFilter.associateName}</strong></span>
            <button onClick={() => setRelatedCasesFilter(null)} style={{ background: 'none', border: 'none', color: '#D9A441', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Clear</button>
          </div>
        )}
        <div className="offender-section-title">Linked Cases ({selectedOffenderCases.length})</div>
        {selectedOffenderCases.map(c => (
          <div key={c.id} className="linked-case-card">
            <div style={{ fontWeight: 600, color: '#E8ECF3' }}>{c.label}</div>
            <div style={{ color: '#8B96AA' }}>{c.crimeType} · {c.status}{c.district ? ` · ${c.district}` : ''}</div>
            {c.dateOfFIR && <div style={{ color: '#8B96AA' }}>{c.dateOfFIR}</div>}
          </div>
        ))}

        <div className="offender-section-title">Court History</div>
        {!courtHistory && !courtHistoryLoading && (
          <button onClick={fetchCourtHistory} style={{ width: '100%', padding: 8, background: '#1A2438', border: '1px solid #232D42', color: '#E8ECF3', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            View Court History
          </button>
        )}
        {courtHistoryLoading && <div className="text-muted">Loading court history...</div>}
        {courtHistory?.cases?.map(c => (
          <div key={c.caseId} className="court-case-card" style={{ marginTop: 8 }}>
            <div className="court-case-title">{c.firNumber} — {c.crimeType}
              <span className="court-status-badge" style={{ background: STATUS_COLORS[c.status] || '#8B96AA', color: '#0F1523' }}>{c.status}</span>
            </div>
            {c.hearings.length === 0 && <div className="court-empty-note">No court hearings recorded yet — case is {c.status.toLowerCase()}.</div>}
            {c.hearings.length > 0 && (
              <div className="court-timeline">
                {c.hearings.map((h, i) => (
                  <div key={i} className="court-timeline-item">
                    <div className="court-timeline-date">{h.hearingDate}</div>
                    <div><span className="court-timeline-purpose">{h.purpose}</span> — {h.outcome}</div>
                    <div style={{ color: '#8B96AA', fontSize: 11 }}>{h.courtName} · {h.judgeName}</div>
                  </div>
                ))}
              </div>
            )}
            {c.disposition && (
              <div className={`court-disposition-box ${c.disposition.dispositionType === 'Convicted' ? 'convicted' : c.disposition.dispositionType === 'Acquitted' ? 'acquitted' : 'other'}`}>
                <strong>{c.disposition.dispositionType}</strong> on {c.disposition.dispositionDate}
                {c.disposition.sentenceDetails && <div style={{ marginTop: 4 }}>{c.disposition.sentenceDetails}</div>}
              </div>
            )}
          </div>
        ))}

        <div className="offender-section-title">AI Summary</div>
        {!aiSummary && !aiSummaryLoading && (
          <button onClick={generateSummary} style={{ width: '100%', padding: 8, background: '#1A2438', border: '1px solid #232D42', color: '#E8ECF3', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Generate AI Summary
          </button>
        )}
        {aiSummaryLoading && <div className="text-muted">Generating summary...</div>}
        {aiSummary && <div style={{ fontSize: 12, color: '#C7CEDA', lineHeight: 1.5 }}>{aiSummary}</div>}
      </div>
    </div>
  </div>
)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, background: '#111827', border: '1px solid #232D42', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#C7CEDA' }}>
        <span>Most Connected: <strong style={{ color: '#E8ECF3' }}>{stats.mostConnected?.label || 'N/A'}</strong> {stats.mostConnected ? `(${stats.mostConnected.associateCount} associates)` : ''}</span>
        <span>Avg Associates: <strong style={{ color: '#E8ECF3' }}>{stats.avgAssociates}</strong></span>
        <span>Repeat Offender Rate: <strong style={{ color: '#E8ECF3' }}>{stats.repeatOffenderPct}%</strong></span>
      </div>
    </div>
  );
}

const KB_EXAMPLE_PROMPTS = [
  "What is the procedure for cyber fraud investigation?",
  "Which sections apply for vehicle theft?",
  "Show the SOP for missing person cases.",
  "What are the guidelines for evidence collection?"
];

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function KnowledgeBasePanel({ functionsBase, lang }) {
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [kbListening, setKbListening] = useState(false);
  const kbRecognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const startKbVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setKbListening(true);
    recognition.onend = () => setKbListening(false);
    recognition.onerror = (event) => {
      setKbListening(false);
      console.error('KB speech recognition error:', event.error, event);
      alert(`Voice input error: ${event.error}`);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
    };

    kbRecognitionRef.current = recognition;
    recognition.start();
  };

  const stopKbVoiceInput = () => {
    kbRecognitionRef.current?.stop();
    setKbListening(false);
  };

  const refreshDocuments = () => {
    setLoadingDocs(true);
    fetch(`${functionsBase}/kb-function/?mode=list`)
      .then(res => res.json())
      .then(data => {
        setDocuments(data.documents || []);
        setLoadingDocs(false);
      })
      .catch(err => {
        console.error('KB document list error:', err);
        setLoadingDocs(false);
      });
  };

  useEffect(() => { refreshDocuments(); }, [functionsBase]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'docx', 'txt'].includes(ext)) {
        setUploadError(`"${file.name}" is not a supported file type. Only PDF, DOCX, and TXT are supported.`);
        continue;
      }
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`${functionsBase}/kb-function/?mode=upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileType: ext, fileBase64: base64 })
        });
        const data = await res.json();
        if (data.error) setUploadError(data.error);
      } catch (err) {
        setUploadError(`Failed to upload "${file.name}": ${err.message}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refreshDocuments();
  };

  const handleDelete = (documentId) => {
    fetch(`${functionsBase}/kb-function/?mode=delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId })
    })
      .then(res => res.json())
      .then(() => refreshDocuments())
      .catch(err => console.error('KB delete error:', err));
  };

  const openPreview = (doc) => {
    setPreviewDoc({ documentName: doc.name, loading: true, sections: [], error: null });
    fetch(`${functionsBase}/kb-function/?mode=view&documentId=${doc.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setPreviewDoc(prev => ({ ...prev, loading: false, error: data.error }));
        } else {
          setPreviewDoc(prev => ({ ...prev, loading: false, sections: data.sections || [] }));
        }
      })
      .catch(err => {
        console.error('KB preview error:', err);
        setPreviewDoc(prev => ({ ...prev, loading: false, error: 'Unable to load document preview.' }));
      });
  };

  const closePreview = () => setPreviewDoc(null);
  const handleAsk = (q) => {
    const finalQuestion = q || question;
    if (!finalQuestion.trim()) return;
    setAsking(true);
    setAnswer(null);
    fetch(`${functionsBase}/kb-function/?mode=query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: finalQuestion, preferredLang: lang })
    })
      .then(res => res.json())
      .then(data => {
        setAnswer(data);
        setAsking(false);
      })
      .catch(err => {
        console.error('KB query error:', err);
        setAnswer({ answer: 'Something went wrong. Please try again.', groundedInKB: false, citations: [] });
        setAsking(false);
      });
  };

  const fileTypeBadgeColor = (ext) => {
    const e = (ext || '').toLowerCase();
    if (e === 'pdf') return '#C1443C';
    if (e === 'docx') return '#3D6FCC';
    return '#5FA88C'; // txt / fallback
  };

  return (
    <div className="kb-panel-v2">
      {previewDoc && (
        <div className="court-modal-overlay" onClick={closePreview}>
          <div className="court-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="court-modal-header">
              <h4>📄 {previewDoc.documentName}</h4>
              <button className="court-modal-close" onClick={closePreview}>&times;</button>
            </div>
            <div className="court-modal-body">
              <div className="court-empty-note" style={{ marginBottom: 12 }}>
                Showing extracted/indexed text, not the original file's layout or formatting.
              </div>
              {previewDoc.loading && <div className="text-muted">Loading preview...</div>}
              {previewDoc.error && <div className="text-muted">{previewDoc.error}</div>}
              {!previewDoc.loading && !previewDoc.error && previewDoc.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  {s.sourceLabel && <div className="court-timeline-date" style={{ marginBottom: 4 }}>{s.sourceLabel}</div>}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="kb-panel-v2-grid">

        {/* --- Upload column --- */}
        <div className="kb-card">
          <div className="kb-card-header">
            <span className="kb-card-icon">{'\u{1f4c1}'}</span>
            <div>
              <h3>Upload Police Documents</h3>
              <p className="kb-subtext">SOPs, IPC/BNS sections, circulars, investigation manuals, cybercrime guidelines, and departmental policies.</p>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button className="kb-upload-btn-v2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <span>{'\u{1f4c1}'}</span>
            {uploading ? 'Uploading...' : 'Upload Documents'}
          </button>
          <div className="kb-format-hint">Supported formats: PDF, DOCX, TXT</div>
          {uploadError && <div className="kb-upload-error">{uploadError}</div>}

          <div className="kb-doc-list-v2">
            <div className="kb-doc-list-header-v2">
              <span>Uploaded Documents</span>
              <span className="kb-doc-count-v2">{documents.length} indexed</span>
            </div>
            {loadingDocs && <div className="kb-doc-loading">Loading...</div>}
            {!loadingDocs && documents.length === 0 && (
              <div className="kb-doc-empty">No documents uploaded yet. Upload an SOP, manual, or circular to get started.</div>
            )}
            <div className="kb-doc-scroll">
              {documents.map(doc => (
                <div className="kb-doc-row" key={doc.id}>
                  <div className="kb-doc-file-icon" style={{ background: fileTypeBadgeColor(doc.fileType) }}>
                    {'\u{1f4c4}'}
                  </div>
                  <div className="kb-doc-info-v2">
                    <div className="kb-doc-name-v2">{doc.name}</div>
                    <div className="kb-doc-meta-v2">
                      <span className="kb-doc-type-chip">{doc.fileType.toUpperCase()}</span>
                      <span>{formatFileSize(doc.fileSizeBytes)}</span>
                      <span>{new Date(doc.uploadedDate).toLocaleDateString()}</span>
                      <span className="kb-doc-indexed">&#10003; Indexed ({doc.chunkCount})</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openPreview(doc)}
                    title="Preview extracted text"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', marginRight: 6 }}
                  >
                    {'\u{1f441}\u{fe0f}'}
                  </button>
                  <button className="kb-doc-delete-v2" onClick={() => handleDelete(doc.id)} title="Delete document">
                    {'\u{1f5d1}'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- Ask column --- */}
        <div className="kb-card">
          <div className="kb-card-header">
            <span className="kb-card-icon">{'\u{1f4da}'}</span>
            <div>
              <h3>Ask the Knowledge Base</h3>
              <p className="kb-subtext">Answers come only from your uploaded documents, not general knowledge. Supports English and Kannada.</p>
            </div>
          </div>

          <div className="kb-example-prompts-v2">
            {KB_EXAMPLE_PROMPTS.map((p, i) => (
              <button key={i} className="kb-example-chip-v2" onClick={() => { setQuestion(p); handleAsk(p); }}>{p}</button>
            ))}
          </div>

          <div className="kb-query-input-row-v2">
            <textarea
              className="kb-query-input-v2"
              placeholder="Ask a question about your uploaded documents..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={3}
            />
            <div className="kb-query-actions">
              <button
                className={`kb-mic-btn-v2 ${kbListening ? 'mic-active' : ''}`}
                type="button"
                title={kbListening ? 'Listening...' : 'Voice input'}
                onClick={kbListening ? stopKbVoiceInput : startKbVoiceInput}
              >
                {kbListening ? '\u{1f534}' : '\u{1f3a4}'}
              </button>
              <button className="kb-query-submit-v2" onClick={() => handleAsk()} disabled={asking || !question.trim()}>
                {asking ? 'Searching...' : 'Ask'}
              </button>
            </div>
          </div>

          <div className="kb-answer-area">
            {!answer && !asking && (
              <div className="kb-answer-placeholder">
                Ask a question above, or tap a suggested question to get started.
              </div>
            )}
            {asking && <div className="kb-doc-loading">Searching documents...</div>}
            {answer && (
              <div className="kb-answer-card-v2">
                {answer.groundedInKB && (
                  <div className="kb-grounded-badge-v2"><span>{'\u{1f4da}'}</span> Answer generated from Police Knowledge Base</div>
                )}
                <div className="kb-answer-text-v2">{answer.answer}</div>
                {answer.citations && answer.citations.length > 0 && (
                  <div className="kb-citations-v2">
                    <div className="kb-citations-label-v2">Sources</div>
                    {answer.citations.map((c, i) => (
                      <div className="kb-citation-item-v2" key={i}>{c.documentName} &middot; {c.source}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;







































