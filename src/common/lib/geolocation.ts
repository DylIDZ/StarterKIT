import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface GeocodingResult {
    lat: number;
    lng: number;
    displayName: string;
    type?: string;
    importance?: number;
}

export interface RouteResult {
    distance: number; // meters
    duration: number; // seconds
    geometry?: string; // encoded polyline
}

export interface DistanceMatrixEntry {
    origin: Coordinates;
    destination: Coordinates;
    distance: number;
    duration: number;
}

// ─── Geo Service Singleton (Nominatim + OSRM) ──────────────────────

const logger = pino({ name: "geolocation" });

class GeoService {
    private static instance: GeoService;
    private nominatimUrl: string;
    private osrmUrl: string;

    private constructor() {
        this.nominatimUrl = env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
        this.osrmUrl = env.OSRM_BASE_URL || "http://localhost:5000";
    }

    static getInstance(): GeoService {
        if (!GeoService.instance) {
            GeoService.instance = new GeoService();
        }
        return GeoService.instance;
    }

    /**
     * Forward geocoding: address/place name → coordinates.
     * Uses Nominatim (OSM) — free, no API key required.
     */
    async geocode(query: string, limit = 5): Promise<GeocodingResult[]> {
        try {
            const params = new URLSearchParams({
                q: query,
                format: "json",
                limit: String(limit),
                addressdetails: "1",
            });

            const response = await fetch(`${this.nominatimUrl}/search?${params}`, {
                headers: {
                    "User-Agent": "StarterKit/1.0",
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Nominatim error: ${response.status}`);
            }

            const data = (await response.json()) as Array<{
                lat: string;
                lon: string;
                display_name: string;
                type?: string;
                importance?: number;
            }>;

            return data.map((item) => ({
                lat: Number.parseFloat(item.lat),
                lng: Number.parseFloat(item.lon),
                displayName: item.display_name,
                type: item.type,
                importance: item.importance,
            }));
        } catch (error) {
            logger.error({ error, query }, "Geocoding failed");
            throw error;
        }
    }

    /**
     * Reverse geocoding: coordinates → address.
     * Uses Nominatim (OSM).
     */
    async reverseGeocode(coords: Coordinates): Promise<GeocodingResult | null> {
        try {
            const params = new URLSearchParams({
                lat: String(coords.lat),
                lon: String(coords.lng),
                format: "json",
                addressdetails: "1",
            });

            const response = await fetch(`${this.nominatimUrl}/reverse?${params}`, {
                headers: {
                    "User-Agent": "StarterKit/1.0",
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Nominatim reverse error: ${response.status}`);
            }

            const data = (await response.json()) as {
                lat: string;
                lon: string;
                display_name: string;
                type?: string;
            };

            return {
                lat: Number.parseFloat(data.lat),
                lng: Number.parseFloat(data.lon),
                displayName: data.display_name,
                type: data.type,
            };
        } catch (error) {
            logger.error({ error, coords }, "Reverse geocoding failed");
            throw error;
        }
    }

    /**
     * Calculate driving route between two points.
     * Uses OSRM (self-hosted or public demo server).
     */
    async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
        try {
            const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
            const url = `${this.osrmUrl}/route/v1/driving/${coords}?overview=full&geometries=polyline`;

            const response = await fetch(url, {
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(`OSRM error: ${response.status}`);
            }

            const data = (await response.json()) as {
                routes: Array<{
                    distance: number;
                    duration: number;
                    geometry: string;
                }>;
            };

            if (!data.routes || data.routes.length === 0) {
                throw new Error("No route found");
            }

            const route = data.routes[0];
            return {
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry,
            };
        } catch (error) {
            logger.error({ error, origin, destination }, "Route calculation failed");
            throw error;
        }
    }

    /**
     * Get estimated time of arrival (ETA) in seconds and formatted string.
     */
    async getETA(
        origin: Coordinates,
        destination: Coordinates,
    ): Promise<{ seconds: number; formatted: string; distanceKm: number }> {
        const route = await this.calculateRoute(origin, destination);

        const hours = Math.floor(route.duration / 3600);
        const minutes = Math.floor((route.duration % 3600) / 60);
        const formatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        return {
            seconds: route.duration,
            formatted,
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        };
    }

    /**
     * Calculate distance matrix for multiple origins and destinations.
     * Uses OSRM table service.
     */
    async getDistanceMatrix(
        origins: Coordinates[],
        destinations: Coordinates[],
    ): Promise<DistanceMatrixEntry[]> {
        try {
            const allCoords = [...origins, ...destinations];
            const coordsStr = allCoords.map((c) => `${c.lng},${c.lat}`).join(";");
            const sourceIndices = origins.map((_, i) => i).join(";");
            const destIndices = destinations.map((_, i) => i + origins.length).join(";");

            const url = `${this.osrmUrl}/table/v1/driving/${coordsStr}?sources=${sourceIndices}&destinations=${destIndices}&annotations=distance,duration`;

            const response = await fetch(url, {
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(`OSRM table error: ${response.status}`);
            }

            const data = (await response.json()) as {
                distances: number[][];
                durations: number[][];
            };

            const results: DistanceMatrixEntry[] = [];
            for (let i = 0; i < origins.length; i++) {
                for (let j = 0; j < destinations.length; j++) {
                    results.push({
                        origin: origins[i],
                        destination: destinations[j],
                        distance: data.distances[i][j],
                        duration: data.durations[i][j],
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error({ error }, "Distance matrix calculation failed");
            throw error;
        }
    }

    /**
     * Calculate Haversine distance between two points (pure math, no API call).
     * Returns distance in kilometers.
     */
    calculateHaversineDistance(from: Coordinates, to: Coordinates): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(to.lat - from.lat);
        const dLng = this.toRadians(to.lng - from.lng);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(from.lat)) *
            Math.cos(this.toRadians(to.lat)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 100) / 100;
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}

export const geoService = GeoService.getInstance();
