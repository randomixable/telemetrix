import type { MotorcycleProfile } from './motorcycleTypes'

export const defaultMotorcycleProfiles: MotorcycleProfile[] = [
  {
    id: 'honda-cb150r-2017',
    name: 'Honda CB150R StreetFire 2017',
    category: '150cc naked sport / street bike',
    wetWeightKg: 136,
    riderWeightKg: 75,
    estimatedTopSpeedKmh: 125,
    estimatedMaxAccelG: 0.42,
    maxPlausibleSpeedKmh: 135,
    gpsSpikeThresholdKmh: 180,
    maxAccelG: 0.55,
    maxBrakeG: 1,
    maxCornerLateralG: 0.75,
    cornerSpeedFormula: 'vKmh = 9.76 * sqrt(radiusM)',
  },
]

export const defaultMotorcycleProfile = defaultMotorcycleProfiles[0]
