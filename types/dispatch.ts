export type AerialOrder = {
  id: string
  short_code: string | null
  customer_name: string
  service_type: string
  num_bags: number | null
  num_comforters: number | null
  status: string
  assigned_facility: { name: string } | null
  assigned_driver: { name: string } | null
}
