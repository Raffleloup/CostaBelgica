// Grandeurs normalisées communes à toutes les sources.
// Chaque adaptateur convertit ses mesures vers ces unités SI avant de les renvoyer.

export const QUANTITIES = {
  wind_speed:   { label: 'Vent moyen',            unit: 'm/s' },
  wind_gust:    { label: 'Rafales',               unit: 'm/s' },
  wind_dir:     { label: 'Direction du vent',     unit: '°' },
  wave_height:  { label: 'Hauteur des vagues',    unit: 'm' },
  wave_h10:     { label: 'Hauteur des 10 % plus hautes vagues (H1/10)', unit: 'm' },
  wave_period:  { label: 'Période des vagues',    unit: 's' },
  wave_dir:     { label: 'Direction de la houle', unit: '°' },
  water_temp:   { label: "Température de l'eau",  unit: '°C' },
  air_temp:     { label: "Température de l'air",  unit: '°C' },
  air_pressure: { label: 'Pression',              unit: 'hPa' },
  water_level:  { label: "Niveau d'eau",          unit: 'm' },
};

// Convertit une valeur depuis l'unité annoncée par la source vers l'unité normalisée.
export function toStandard(quantity, value, unit) {
  if (value == null || Number.isNaN(value)) return null;
  const u = (unit || '').trim().toLowerCase();
  switch (QUANTITIES[quantity]?.unit) {
    case 'm/s':
      if (u === 'km/h') return value / 3.6;
      if (u === 'kn' || u === 'kt' || u === 'knots') return value * 0.514444;
      return value;
    case 'm':
      if (u === 'cm') return value / 100;
      if (u === 'mm') return value / 1000;
      return value;
    case '°C':
      if (u === 'k') return value - 273.15;
      return value;
    case 'hPa':
      if (u === 'pa') return value / 100;
      return value;
    default:
      return value;
  }
}
