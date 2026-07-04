export type MotorcycleProfile = {
  id: string
  name: string
  category: string
  wetWeightKg?: number
  riderWeightKg?: number
  powerHp?: number
  estimatedTopSpeedKmh?: number
  estimatedMaxAccelG?: number
  maxPlausibleSpeedKmh?: number
  gpsSpikeThresholdKmh?: number
  maxAccelG?: number
  maxBrakeG?: number
  maxCornerLateralG?: number
  maxLeanDeg?: number
  cornerSpeedFormula?: string
}
