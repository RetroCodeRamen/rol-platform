import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth';
import { addSecurityHeaders } from '@/lib/security/headers';
import { validateCSRFToken } from '@/lib/security/csrf';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import { getWeatherEmoji, celsiusToFahrenheit, kmhToMph, WeatherData, ForecastDay } from '@/lib/weather/weatherUtils';

/**
 * POST /api/weather/set-zip
 * 
 * Saves ZIP code for authenticated user and validates it via Open-Meteo geocoding.
 * Returns normalized weather data if valid.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid security token' },
          { status: 403 }
        )
      );
    }

    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      );
    }

    // Parse request body
    const body = await request.json();
    const { zip } = body;

    if (!zip || typeof zip !== 'string' || zip.trim().length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'ZIP code is required' },
          { status: 400 }
        )
      );
    }

    const zipCode = zip.trim();

    // Geocode ZIP via Open-Meteo Geocoding API
    // Use countryCode parameter for US ZIP codes
    const isUSZip = /^\d{5}(-\d{4})?$/.test(zipCode);
    const countryCodeParam = isUSZip ? '&countryCode=US' : '';
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zipCode)}${countryCodeParam}&count=20&language=en`;
    
    let geocodeResponse;
    try {
      console.log('[WEATHER] Geocoding ZIP:', zipCode, 'URL:', geocodeUrl);
      geocodeResponse = await fetch(geocodeUrl);
      
      if (!geocodeResponse.ok) {
        console.error('[WEATHER] Geocoding API error:', geocodeResponse.status, geocodeResponse.statusText);
        throw new Error('Geocoding service unavailable');
      }
      
      const geocodeData = await geocodeResponse.json();
      console.log('[WEATHER] Geocoding results:', geocodeData.results?.length || 0, 'results');
      
      if (!geocodeData.results || geocodeData.results.length === 0) {
        console.error('[WEATHER] No results found for ZIP:', zipCode);
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'We couldn\'t find that ZIP code. Please check it and try again.' },
            { status: 400 }
          )
        );
      }

      // Find the best matching location
      // For US ZIP codes, prefer results where the ZIP code is in the postcodes array
      let location = geocodeData.results[0];
      
      if (isUSZip) {
        // First, try to find a location where the ZIP code is in the postcodes array
        const exactZipMatch = geocodeData.results.find((loc: any) => 
          loc.postcodes && Array.isArray(loc.postcodes) && loc.postcodes.includes(zipCode)
        );
        
        if (exactZipMatch) {
          location = exactZipMatch;
          console.log('[WEATHER] Found exact ZIP match:', location.name, location.admin1, 'Postcodes:', location.postcodes);
        } else {
          // Second, prefer US results with state info
          const usWithState = geocodeData.results.find((loc: any) => 
            loc.country_code?.toLowerCase() === 'us' && loc.admin1
          );
          
          if (usWithState) {
            location = usWithState;
            console.log('[WEATHER] Found US match with state:', location.name, location.admin1);
          } else {
            // Use first result (should already be US if countryCode was used)
            console.log('[WEATHER] Using first result:', location.name, location.country_code, location.admin1);
          }
        }
      } else {
        console.log('[WEATHER] Non-US ZIP, using first result:', location.name);
      }
      
      // Validate location has required fields
      if (!location || !location.latitude || !location.longitude) {
        console.error('[WEATHER] Invalid location data:', location);
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Invalid location data returned. Please try again.' },
            { status: 500 }
          )
        );
      }
      
      const latitude = location.latitude;
      const longitude = location.longitude;
      
      // Build location name
      const locationName = location.admin1 
        ? `${location.name}, ${location.admin1}`
        : location.name;

      // Fetch current weather + 7-day forecast
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`;
      
      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        throw new Error('Weather service unavailable');
      }
      
      const weatherData = await weatherResponse.json();
      
      if (!weatherData.current_weather) {
        throw new Error('Weather data unavailable');
      }

      const current = weatherData.current_weather;
      const weatherCode = current.weathercode;
      const { emoji, text } = getWeatherEmoji(weatherCode);
      
      const tempC = current.temperature;
      const tempF = celsiusToFahrenheit(tempC);
      const windKph = current.windspeed;
      const windMph = kmhToMph(windKph);

      // Calculate feels-like (simplified: use temp if no humidity data)
      // Open-Meteo forecast API can provide hourly data for feels-like, but for simplicity
      // we'll approximate: feels-like ≈ temp - (wind * 0.1) for wind chill
      const feelsLikeC = tempC - (windKph * 0.1);
      const feelsLikeF = celsiusToFahrenheit(feelsLikeC);

      // Parse 7-day forecast
      const forecast: ForecastDay[] = [];
      if (weatherData.daily && weatherData.daily.time) {
        const daily = weatherData.daily;
        for (let i = 0; i < Math.min(7, daily.time.length); i++) {
          const date = daily.time[i];
          const highC = daily.temperature_2m_max[i];
          const lowC = daily.temperature_2m_min[i];
          const code = daily.weathercode[i];
          const { emoji: dayEmoji, text: dayText } = getWeatherEmoji(code);
          
          forecast.push({
            date,
            highC: Math.round(highC * 10) / 10,
            highF: Math.round(celsiusToFahrenheit(highC) * 10) / 10,
            lowC: Math.round(lowC * 10) / 10,
            lowF: Math.round(celsiusToFahrenheit(lowC) * 10) / 10,
            weatherCode: code,
            conditionEmoji: dayEmoji,
            conditionText: dayText,
          });
        }
      }

      const normalizedWeather: WeatherData = {
        locationName,
        temperatureC: Math.round(tempC * 10) / 10,
        temperatureF: Math.round(tempF * 10) / 10,
        windKph: Math.round(windKph * 10) / 10,
        windMph: Math.round(windMph * 10) / 10,
        weatherCode,
        conditionEmoji: emoji,
        conditionText: text,
        feelsLikeC: Math.round(feelsLikeC * 10) / 10,
        feelsLikeF: Math.round(feelsLikeF * 10) / 10,
        humidity: undefined, // Not available in current_weather endpoint
        forecast,
      };

      // Save ZIP to user account
      await dbConnect();
      await User.findByIdAndUpdate(userId, { weatherZip: zipCode });

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          weather: normalizedWeather,
        })
      );
    } catch (error: any) {
      console.error('[WEATHER] Error fetching weather:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Weather service is temporarily unavailable. Please try again later.' },
          { status: 500 }
        )
      );
    }
  } catch (error: any) {
    console.error('[WEATHER] Error in set-zip:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'An error occurred' },
        { status: 500 }
      )
    );
  }
}

