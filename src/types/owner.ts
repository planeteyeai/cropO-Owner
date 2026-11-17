export interface OwnerUser {
  id: number;
  username: string;
  role: string;
  phone_number: string;
  first_name: string;
  last_name: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginSuccessResponse {
  success: true;
  message: string;
  data: AuthTokens & {
    user: OwnerUser;
  };
}

export interface ApiErrorResponse {
  success: false;
  message?: string;
  error?: string;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface Plot {
  id: number;
  field_id: string;
  name: string;
  location: GeoPoint | null;
  boundary: GeoPolygon | null;
  soil_details: Record<string, unknown> | null;
}

export interface Crop {
  id: number;
  field_id: string;
  crop_type: number | null;
  crop_type_name: string | null;
  crop_variety: number | null;
  crop_variety_name: string | null;
  plantation_date: string | null;
  foundation_pruning_date: string | null;
  fruit_pruning_date: string | null;
  harvest_date: string | null;
  irrigation_type: number | null;
  irrigation_type_name: string | null;
  quantity_tons: number | null;
  price_per_kg: number | null;
  soil_type: string | null;
  sand_pct: number | null;
  silt_pct: number | null;
  clay_pct: number | null;
}

export interface Farmer {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  village: string | null;
  taluka: string | null;
  district: string | null;
  state: string | null;
  /** ISO datetime from Django; null if farmer never logged in */
  last_login?: string | null;
  plot_count: number;
  plots: Plot[];
  crops: Crop[];
}

export interface FarmerListResponse {
  success: true;
  count: number;
  next: string | null;
  previous: string | null;
  data: Farmer[];
}
