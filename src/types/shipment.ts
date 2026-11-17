export type ShipmentRecordType = 'transport' | 'warehouse';

export interface ShipmentListItem {
  id: number;
  record_type: ShipmentRecordType;
  record_key: string;
  status: string;
  title: string;
  farmer_id: number | null;
  farmer_name: string;
  farmer_phone: string;
  provider_name: string;
  provider_type?: string;
  vehicle_number?: string;
  vehicle_category?: string;
  rack_code?: string;
  crop_name?: string;
  batch_id?: string;
  pickup_location?: string;
  destination_location?: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  quantity_tons?: number | string | null;
  duration_days?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  distance_km?: number | string | null;
  final_price?: number | string | null;
  original_price?: number | string | null;
  confirmed_price?: number | string | null;
  estimated_price?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  details?: Record<string, unknown>;
}

export interface ShipmentListResponse {
  success: true;
  count: number;
  next: string | null;
  previous: string | null;
  data: ShipmentListItem[];
}
