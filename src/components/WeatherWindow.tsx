'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { httpClient } from '@/lib/http/HttpClient';
import type { WeatherData } from '@/lib/weather/weatherUtils';

interface WeatherResponse {
  success: boolean;
  needsSetup?: boolean;
  weather?: WeatherData;
  error?: string;
}

export default function WeatherWindow() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zipInput, setZipInput] = useState('');
  const [savingZip, setSavingZip] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch weather data
  const fetchWeather = useCallback(async () => {
    try {
      setError(null);
      const response = await httpClient.get<WeatherResponse>('/api/weather');
      
      if (response.success) {
        if (response.needsSetup) {
          setNeedsSetup(true);
          setWeather(null);
        } else if (response.weather) {
          setNeedsSetup(false);
          setWeather(response.weather);
        }
      } else {
        setError(response.error || 'Failed to load weather');
        setNeedsSetup(true);
      }
    } catch (err: any) {
      console.error('[WEATHER] Error fetching weather:', err);
      setError(err.message || 'Weather service is temporarily unavailable. Please try again later.');
      setNeedsSetup(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save ZIP code
  const handleSaveZip = async () => {
    if (!zipInput.trim()) {
      setError('Please enter a ZIP code');
      return;
    }

    setSavingZip(true);
    setError(null);

    try {
      const response = await httpClient.post<WeatherResponse>('/api/weather/set-zip', {
        zip: zipInput.trim(),
      });

      if (response.success && response.weather) {
        setNeedsSetup(false);
        setWeather(response.weather);
        setZipInput('');
      } else {
        setError(response.error || 'Failed to save ZIP code');
      }
    } catch (err: any) {
      console.error('[WEATHER] Error saving ZIP:', err);
      setError(err.message || 'Failed to save ZIP code. Please try again.');
    } finally {
      setSavingZip(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Auto-refresh every 15 minutes (900,000 ms) when weather is loaded
  useEffect(() => {
    if (weather && !needsSetup) {
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      // Set up new interval
      refreshIntervalRef.current = setInterval(() => {
        fetchWeather();
      }, 900000); // 15 minutes

      // Cleanup on unmount
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [weather, needsSetup, fetchWeather]);

  // Handle "Change ZIP" button
  const handleChangeZip = () => {
    setNeedsSetup(true);
    setWeather(null);
    setZipInput('');
  };

  // Setup view
  if (loading) {
    return (
      <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-600">Loading weather...</p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-white border-2 border-blue-300 rounded p-6">
            <h2 className="text-xl font-bold text-blue-800 mb-4 text-center">
              Set Your Local Weather
            </h2>
            <p className="text-gray-700 mb-4 text-center">
              Enter your ZIP code to see local conditions in RamenOnline.
            </p>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="zip-input" className="block text-sm font-semibold text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                id="zip-input"
                type="text"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveZip();
                  }
                }}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded focus:outline-none focus:border-blue-500"
                placeholder="Enter ZIP code"
                disabled={savingZip}
              />
            </div>

            <button
              onClick={handleSaveZip}
              disabled={savingZip}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingZip ? 'Saving...' : 'Save & Get Weather'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Conditions view
  if (weather) {
    return (
      <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
        <div className="max-w-lg mx-auto">
          <div className="bg-white border-2 border-blue-300 rounded p-6">
            {/* Location */}
            <h2 className="font-bold text-blue-800 mb-4 text-center" style={{ fontSize: '32px' }}>
              {weather.locationName}
            </h2>

            {/* Condition Emoji - Large */}
            <div className="text-center mb-4">
              <div className="mb-2" style={{ fontSize: '110px' }}>{weather.conditionEmoji}</div>
              <p className="text-gray-700 font-semibold" style={{ fontSize: '28px' }}>{weather.conditionText}</p>
            </div>

            {/* Temperature */}
            <div className="text-center mb-6">
              <div className="font-bold text-blue-900 mb-1" style={{ fontSize: '64px' }}>
                {Math.round(weather.temperatureF)}°F
              </div>
              <div className="text-gray-600" style={{ fontSize: '32px' }}>
                {Math.round(weather.temperatureC)}°C
              </div>
            </div>

            {/* Details */}
            <div className="border-t-2 border-blue-200 pt-4 space-y-2">
              {weather.feelsLikeF !== undefined && (
                <div className="flex justify-between" style={{ fontSize: '20px' }}>
                  <span className="text-gray-700 font-semibold">Feels Like:</span>
                  <span className="text-gray-900">
                    {Math.round(weather.feelsLikeF)}°F / {Math.round(weather.feelsLikeC!)}°C
                  </span>
                </div>
              )}
              
              {weather.humidity !== undefined && (
                <div className="flex justify-between" style={{ fontSize: '20px' }}>
                  <span className="text-gray-700 font-semibold">Humidity:</span>
                  <span className="text-gray-900">{weather.humidity}%</span>
                </div>
              )}

              <div className="flex justify-between" style={{ fontSize: '20px' }}>
                <span className="text-gray-700 font-semibold">Wind Speed:</span>
                <span className="text-gray-900">
                  {Math.round(weather.windMph)} mph / {Math.round(weather.windKph)} km/h
                </span>
              </div>
            </div>

            {/* Change ZIP button */}
            <div className="mt-6 text-center">
              <button
                onClick={handleChangeZip}
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Change ZIP
              </button>
            </div>

            {/* Error display */}
            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 7-Day Forecast */}
          {weather.forecast && weather.forecast.length > 0 && (
            <div className="bg-white border-2 border-blue-300 rounded p-4 mt-4">
              <h3 className="font-bold text-blue-800 mb-3 text-center" style={{ fontSize: '24px' }}>
                7-Day Forecast
              </h3>
              <div className="grid grid-cols-7 gap-1 overflow-x-auto">
                {weather.forecast.map((day, index) => {
                  // Format date: "Mon", "Tue", etc.
                  const date = new Date(day.date);
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNumber = date.getDate();
                  
                  return (
                    <div
                      key={index}
                      className="border border-blue-200 rounded p-2 text-center bg-blue-50 min-w-[60px]"
                    >
                      <div className="font-semibold text-blue-800 mb-1" style={{ fontSize: '16px' }}>
                        {dayName}
                      </div>
                      <div className="text-gray-600 mb-1" style={{ fontSize: '16px' }}>
                        {dayNumber}
                      </div>
                      <div className="mb-1" style={{ fontSize: '36px' }}>
                        {day.conditionEmoji}
                      </div>
                      <div className="text-gray-700 font-semibold" style={{ fontSize: '16px' }}>
                        <div className="text-blue-900">{Math.round(day.highF)}°</div>
                        <div className="text-gray-600">{Math.round(day.lowF)}°</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return (
    <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">No weather data available</p>
      </div>
    </div>
  );
}

