/**
 * Weather Utilities
 * 
 * Emoji mapping and weather code conversion for Open-Meteo WMO codes
 */

export interface ForecastDay {
  date: string; // ISO date string
  highC: number;
  highF: number;
  lowC: number;
  lowF: number;
  weatherCode: number;
  conditionEmoji: string;
  conditionText: string;
}

export interface WeatherData {
  locationName: string;
  temperatureC: number;
  temperatureF: number;
  windKph: number;
  windMph: number;
  weatherCode: number;
  conditionEmoji: string;
  conditionText: string;
  feelsLikeC?: number;
  feelsLikeF?: number;
  humidity?: number;
  forecast?: ForecastDay[]; // 7-day forecast
}

/**
 * Convert WMO weather code to emoji and text description
 * Based on WMO Weather interpretation codes (WW)
 */
export function getWeatherEmoji(code: number): { emoji: string; text: string } {
  // Clear sky
  if (code === 0) {
    return { emoji: '☀️', text: 'Clear sky' };
  }
  
  // Mainly clear
  if (code === 1) {
    return { emoji: '🌤️', text: 'Mainly clear' };
  }
  
  // Partly cloudy
  if (code === 2) {
    return { emoji: '⛅', text: 'Partly cloudy' };
  }
  
  // Overcast
  if (code === 3) {
    return { emoji: '☁️', text: 'Overcast' };
  }
  
  // Fog
  if (code === 45 || code === 48) {
    return { emoji: '🌫️', text: 'Fog' };
  }
  
  // Drizzle
  if (code >= 51 && code <= 55) {
    return { emoji: '🌦️', text: 'Drizzle' };
  }
  
  // Freezing drizzle
  if (code === 56 || code === 57) {
    return { emoji: '🌨️', text: 'Freezing drizzle' };
  }
  
  // Rain
  if (code >= 61 && code <= 65) {
    return { emoji: '🌧️', text: 'Rain' };
  }
  
  // Freezing rain
  if (code === 66 || code === 67) {
    return { emoji: '🌨️', text: 'Freezing rain' };
  }
  
  // Snow fall
  if (code >= 71 && code <= 77) {
    return { emoji: '❄️', text: 'Snow' };
  }
  
  // Rain showers
  if (code >= 80 && code <= 82) {
    return { emoji: '🌧️', text: 'Rain showers' };
  }
  
  // Snow showers
  if (code === 85 || code === 86) {
    return { emoji: '🌨️', text: 'Snow showers' };
  }
  
  // Thunderstorm
  if (code >= 95 && code <= 99) {
    return { emoji: '⛈️', text: 'Thunderstorm' };
  }
  
  // Default/unknown
  return { emoji: '🌤️', text: 'Unknown conditions' };
}

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/**
 * Convert km/h to mph
 */
export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

