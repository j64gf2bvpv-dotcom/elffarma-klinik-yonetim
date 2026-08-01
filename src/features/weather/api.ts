export interface WeatherInfo {
  temperature: number
  weatherCode: number
  city: string
}

async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; name: string }> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`,
  )
  if (!res.ok) throw new Error('Şehir bulunamadı')
  const data = (await res.json()) as { results?: { latitude: number; longitude: number; name: string }[] }
  const first = data.results?.[0]
  if (!first) throw new Error('Şehir bulunamadı')
  return first
}

export async function fetchWeather(city: string): Promise<WeatherInfo> {
  const { latitude, longitude, name } = await geocodeCity(city)
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`,
  )
  if (!res.ok) throw new Error('Hava durumu alınamadı')
  const data = (await res.json()) as { current: { temperature_2m: number; weather_code: number } }
  return { temperature: data.current.temperature_2m, weatherCode: data.current.weather_code, city: name }
}
