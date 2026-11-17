export interface ManagerFarmer {
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
}

export interface CropDetails {
  crop_type: string | null;
  crop_variety: string | null;
  plantation_date: string | null;
  irrigation_type: string | null;
}

export interface PixelSummaryGrowth {
  total_pixel_count?: number;
  healthy_pixel_count?: number;
  healthy_pixel_percentage?: number;
  moderate_pixel_count?: number;
  moderate_pixel_percentage?: number;
  weak_pixel_count?: number;
  weak_pixel_percentage?: number;
  stress_pixel_count?: number;
  stress_pixel_percentage?: number;
  latest_image_date?: string | null;
}

export interface PixelSummaryMoisture {
  total_pixel_count?: number;
  less_pixel_percentage?: number;
  adequate_pixel_percentage?: number;
  excellent_pixel_percentage?: number;
  excess_pixel_percentage?: number;
  shallow_water_pixel_percentage?: number;
  latest_image_date?: string | null;
}

export interface PixelSummaryWater {
  total_pixel_count?: number;
  deficient_pixel_percentage?: number;
  less_pixel_percentage?: number;
  adequat_pixel_percentage?: number;
  excellent_pixel_percentage?: number;
  very_healthy_pixel_percentage?: number;
  excess_pixel_percentage?: number;
}

export interface PixelSummaryPest {
  total_pixel_count?: number;
  healthy_pixel_count?: number;
  chewing_affected_pixel_percentage?: number;
  fungi_affected_pixel_percentage?: number;
  sucking_affected_pixel_percentage?: number;
  wilt_affected_pixel_percentage?: number;
  SoilBorn_affected_pixel_percentage?: number;
}

export interface WeatherNow {
  location?: string | null;
  region?: string | null;
  temperature_c?: number | null;
  humidity?: number | null;
  wind_kph?: number | null;
  precip_mm?: number | null;
  localtime?: string | null;
}

export interface ForecastDay {
  date: string;
  temperature_max?: string;
  temperature_min?: string;
  precipitation?: string;
  wind_speed_max?: string;
  humidity_max?: string;
}

export interface AgroStats {
  soil?: {
    organic_carbon_stock?: number | null;
    phh2o?: number | null;
    area_acres?: number | null;
  } | null;
  biomass?: { mean?: number | null; min?: number | null; max?: number | null } | null;
  area_acres?: number | null;
  days_to_harvest?: number | null;
  current_growth_stage?: string | null;
  plantation_date?: string | null;
  plantation_type?: string | null;
  eligibility_status?: string | null;
  Sugarcane_Status?: string | null;
}

export interface NpkAnalysis {
  recommended_dose_perAcre?: { N?: number; P?: number; K?: number };
  estimated_npk_uptake_perAcre?: { N?: number; P?: number; K?: number };
  fertilizer_require_perAcre?: { N?: number; P?: number; K?: number };
  area_acres?: number | null;
  soil_statistics?: {
    phh2o?: number | null;
    soil_organic_carbon?: number | null;
    total_nitrogen?: number | null;
    phosphorus?: number | null;
    potassium?: number | null;
  } | null;
}

export interface IrrigationSoilMoisture {
  plot_name?: string;
  start_date?: string;
  end_date?: string;
  final_soil_moisture_capped?: number | null;
  total_water_loss_percentage?: number | null;
  ndmi_used?: number | null;
}

/** Optional GeoJSON-like feature carrying Earth Engine tile_url. */
export interface LayerFeature {
  type?: string;
  properties?: {
    tile_url?: string | null;
    latest_image_date?: string | null;
    image_count?: number | null;
    [key: string]: unknown;
  } | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
  bbox?: number[] | null;
}

export interface LayerTileBlock {
  data_source?: string;
  sensor_used?: string;
  latest_image_date?: string | null;
  image_count?: number | null;
  tile_url?: string | null;
  image_dates?: string[];
  features?: LayerFeature[] | null;
  bbox?: number[] | null;
  bounds?: number[] | null;
  center?: { lat?: number; lon?: number; lng?: number } | null;
  pixel_summary?:
    | PixelSummaryGrowth
    | PixelSummaryMoisture
    | PixelSummaryWater
    | PixelSummaryPest
    | null;
}

export interface DailyReport {
  report_date?: string;
  plot_name?: string;
  generated_at?: string;
  agro_stats?: AgroStats | null;
  growth?: (LayerTileBlock & { pixel_summary?: PixelSummaryGrowth | null }) | null;
  soil_moisture?: (LayerTileBlock & { pixel_summary?: PixelSummaryMoisture | null }) | null;
  water_uptake?: (LayerTileBlock & { pixel_summary?: PixelSummaryWater | null }) | null;
  pest_detection?: (LayerTileBlock & { pixel_summary?: PixelSummaryPest | null }) | null;
  npk_analysis?: NpkAnalysis | null;
  current_weather?: WeatherNow | null;
  forecast?: ForecastDay[] | null;
  errors?: Record<string, string> | null;
}

export interface ManagerPlot {
  plot_name: string;
  crop_details?: CropDetails | null;
  daily_report?: DailyReport | null;
  field_score?: { plot_name?: string; field_score?: number | null } | null;
  irrigation_and_soil_moisture?: IrrigationSoilMoisture | null;
  /** Optional plot AOI for map fit (GeoJSON or bbox). */
  geometry?: LayerFeature['geometry'] | null;
  bbox?: number[] | null;
  bounds?: number[] | null;
  center?: { lat?: number; lon?: number; lng?: number } | null;
  errors?: Record<string, string> | string | null;
}

export interface ManagerDashboardResponse {
  mobile_number: string;
  report_date: string;
  generated_at: string;
  farmer: ManagerFarmer;
  plots_count: number;
  plots: ManagerPlot[];
}
