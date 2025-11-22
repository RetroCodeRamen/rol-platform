import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth';
import { addSecurityHeaders } from '@/lib/security/headers';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import { getWeatherEmoji, celsiusToFahrenheit, kmhToMph, WeatherData, ForecastDay } from '@/lib/weather/weatherUtils';

/**
 * GET /api/weather
 * 
 * Gets weather for authenticated user's saved ZIP code.
 * Returns { needsSetup: true } if no ZIP is saved.
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get user's saved ZIP
    await dbConnect();
    const user = await User.findById(userId);
    
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    if (!user.weatherZip) {
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          needsSetup: true,
        })
      );
    }

    const zipCode = user.weatherZip;

    // Geocode ZIP via Open-Meteo Geocoding API
    // Use countryCode parameter for US ZIP codes
    const isUSZip = /^\d{5}(-\d{4})?$/.test(zipCode);
    const countryCodeParam = isUSZip ? '&countryCode=US' : '';
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zipCode)}${countryCodeParam}&count=20&language=en`;
    
    let geocodeResponse;
    try {
      geocodeResponse = await fetch(geocodeUrl);
      
      if (!geocodeResponse.ok) {
        throw new Error('Geocoding service unavailable');
      }
      
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData.results || geocodeData.results.length === 0) {
        // Invalid ZIP - clear it and return needsSetup
        await User.findByIdAndUpdate(userId, { weatherZip: null });
        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            needsSetup: true,
            error: 'Saved ZIP code is no longer valid. Please set a new one.',
          })
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
        } else {
          // Second, prefer US results with state info
          const usWithState = geocodeData.results.find((loc: any) => 
            loc.country_code?.toLowerCase() === 'us' && loc.admin1
          );
          
          if (usWithState) {
            location = usWithState;
          }
          // Otherwise use first result (should already be US if countryCode was used)
        }
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
    console.error('[WEATHER] Error in GET /api/weather:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'An error occurred' },
        { status: 500 }
      )
    );
  }
}

