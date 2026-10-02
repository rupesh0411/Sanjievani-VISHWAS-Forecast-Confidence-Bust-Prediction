const express = require('express');
const path = require('path');
const { loadEnvFile } = require('node:process');
const districtsByRegion = require('./data/indiaDistricts');

try {
    loadEnvFile(path.join(__dirname, '.env'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

const {
    getRegionsSummary,
    getRegionByName,
    getForecastByRegionAndLead,
    getExpectedError,
    getBustProbability,
    getConfidenceMap,
    getExplainability,
    getEvents,
    getAlerts,
    getStatus,
    regionCatalog,
    aliases,
    riskLevels,
    variables
} = require('./data/mockData');

const app = express();
const PORT = process.env.PORT || 3000;
const weatherApiKey = process.env.WEATHERAPI_KEY;

const regionLocations = {
    'Andaman and Nicobar Islands': 'Port Blair',
    'Andhra Pradesh': 'Amaravati',
    'Arunachal Pradesh': 'Itanagar',
    Assam: 'Dispur',
    Bihar: 'Patna',
    Chandigarh: 'Chandigarh',
    Chhattisgarh: 'Raipur',
    'Dadra and Nagar Haveli': 'Silvassa',
    'Daman and Diu': 'Diu',
    Delhi: 'New Delhi',
    Goa: 'Panaji',
    Gujarat: 'Gandhinagar',
    Haryana: 'Chandigarh',
    'Himachal Pradesh': 'Shimla',
    Jharkhand: 'Ranchi',
    Karnataka: 'Bengaluru',
    Kerala: 'Thiruvananthapuram',
    Lakshadweep: 'Kavaratti',
    'Madhya Pradesh': 'Bhopal',
    Maharashtra: 'Mumbai',
    Manipur: 'Imphal',
    Meghalaya: 'Shillong',
    Mizoram: 'Aizawl',
    Nagaland: 'Kohima',
    Odisha: 'Bhubaneswar',
    Puducherry: 'Puducherry',
    Punjab: 'Chandigarh',
    Rajasthan: 'Jaipur',
    Sikkim: 'Gangtok',
    'Tamil Nadu': 'Chennai',
    Telangana: 'Hyderabad',
    Tripura: 'Agartala',
    'Uttar Pradesh': 'Lucknow',
    Uttarakhand: 'Dehradun',
    'West Bengal': 'Kolkata'
};

function getWeatherLocation(regionInput, districtInput = '') {
    const normalized = String(regionInput || '').trim().toLowerCase();
    const canonicalName = aliases[normalized] || regionCatalog.find((region) => region.name.toLowerCase() === normalized)?.name;
    if (!canonicalName) return null;

    if (districtInput) {
        const district = (districtsByRegion[canonicalName] || []).find((name) => name.toLowerCase() === String(districtInput).trim().toLowerCase());
        return district ? { region: canonicalName, city: district, district } : null;
    }

    return { region: canonicalName, city: regionLocations[canonicalName], district: null };
}

async function requestWeatherApi(endpoint, params) {
    if (!weatherApiKey) {
        const error = new Error('WeatherAPI is not configured on the server.');
        error.statusCode = 503;
        throw error;
    }

    const url = new URL(`https://api.weatherapi.com/v1/${endpoint}.json`);
    url.searchParams.set('key', weatherApiKey);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const payload = await response.json();
    if (!response.ok || payload.error) {
        const error = new Error(payload.error?.message || 'Weather provider request failed.');
        error.statusCode = response.status === 403 ? 403 : 502;
        error.providerCode = payload.error?.code;
        throw error;
    }
    return payload;
}

function sendWeatherError(res, error) {
    res.status(error.statusCode || 502).json({
        error: error.message || 'Weather provider is temporarily unavailable.',
        providerCode: error.providerCode
    });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/india-map', express.static(path.join(__dirname, 'node_modules', '@svg-maps', 'india')));

app.get('/api/v1/weather/status', (req, res) => {
    res.json({ data: { provider: 'WeatherAPI.com', configured: Boolean(weatherApiKey) } });
});

app.get('/api/v1/weather/districts', (req, res) => {
    const location = getWeatherLocation(req.query.region || 'Madhya Pradesh');
    if (!location) return res.status(400).json({ error: 'Choose a supported Indian state or union territory.' });
    const districts = districtsByRegion[location.region] || [];
    res.json({ data: { region: location.region, districts, count: districts.length } });
});

app.get('/api/v1/weather/forecast', async (req, res) => {
    const location = getWeatherLocation(req.query.region || 'Madhya Pradesh', req.query.district || '');
    if (!location?.city) return res.status(400).json({ error: 'Choose a supported Indian state or union territory.' });

    const requestedDays = Number(req.query.days || 10);
    const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(14, Math.floor(requestedDays))) : 10;
    try {
        const payload = await requestWeatherApi('forecast', {
            q: location.district ? `${location.district}, ${location.region}, India` : `${location.city},India`,
            days,
            aqi: 'no',
            alerts: 'no'
        });
        res.json({
            source: 'WeatherAPI.com',
            updatedAt: payload.current.last_updated,
            data: {
                provider: 'WeatherAPI.com',
                attributionUrl: 'https://www.weatherapi.com/',
                region: location.region,
                district: location.district,
                location: {
                    name: payload.location.name,
                    localtime: payload.location.localtime,
                    timezone: payload.location.tz_id,
                    latitude: payload.location.lat,
                    longitude: payload.location.lon,
                    country: payload.location.country
                },
                current: {
                    lastUpdated: payload.current.last_updated,
                    temperatureC: payload.current.temp_c,
                    condition: payload.current.condition.text,
                    conditionIcon: payload.current.condition.icon,
                    precipitationMm: payload.current.precip_mm,
                    windKph: payload.current.wind_kph,
                    windDirection: payload.current.wind_dir,
                    pressureMb: payload.current.pressure_mb,
                    humidity: payload.current.humidity
                },
                forecast: payload.forecast.forecastday.map(({ date, day, astro }) => ({
                    date,
                    maxTemperatureC: day.maxtemp_c,
                    minTemperatureC: day.mintemp_c,
                    meanTemperatureC: day.avgtemp_c,
                    maxWindKph: day.maxwind_kph,
                    precipitationMm: day.totalprecip_mm,
                    humidity: day.avghumidity,
                    rainChance: day.daily_chance_of_rain,
                    condition: day.condition.text,
                    conditionIcon: day.condition.icon,
                    sunrise: astro.sunrise,
                    sunset: astro.sunset,
                    moonrise: astro.moonrise,
                    moonset: astro.moonset,
                    moonPhase: astro.moon_phase,
                    moonIllumination: astro.moon_illumination,
                    uv: day.uv
                }))
            }
        });
    } catch (error) {
        sendWeatherError(res, error);
    }
});

app.get('/api/v1/weather/history', async (req, res) => {
    const location = getWeatherLocation(req.query.region || 'Madhya Pradesh', req.query.district || '');
    const date = String(req.query.date || '');
    const today = new Date().toISOString().slice(0, 10);
    if (!location?.city) return res.status(400).json({ error: 'Choose a supported Indian state or union territory.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2010-01-01' || date > today) {
        return res.status(400).json({ error: 'Select a valid past date from 2010 onward.' });
    }

    try {
        const query = location.district ? `${location.district}, ${location.region}, India` : `${location.city},India`;
        const payload = await requestWeatherApi('history', { q: query, dt: date });
        const historicalDay = payload.forecast.forecastday[0];
        res.json({
            source: 'WeatherAPI.com',
            data: {
                provider: 'WeatherAPI.com',
                attributionUrl: 'https://www.weatherapi.com/',
                region: location.region,
                district: location.district,
                location: payload.location.name,
                date: historicalDay.date,
                summary: {
                    maxTemperatureC: historicalDay.day.maxtemp_c,
                    minTemperatureC: historicalDay.day.mintemp_c,
                    meanTemperatureC: historicalDay.day.avgtemp_c,
                    precipitationMm: historicalDay.day.totalprecip_mm,
                    maxWindKph: historicalDay.day.maxwind_kph,
                    humidity: historicalDay.day.avghumidity
                },
                hours: historicalDay.hour.map((hour) => ({
                    time: hour.time,
                    temperatureC: hour.temp_c,
                    precipitationMm: hour.precip_mm,
                    windKph: hour.wind_kph,
                    windDirection: hour.wind_dir,
                    pressureMb: hour.pressure_mb,
                    humidity: hour.humidity,
                    condition: hour.condition.text
                }))
            }
        });
    } catch (error) {
        sendWeatherError(res, error);
    }
});

app.get('/api/v1/regions', (req, res) => {
    res.json({ data: getRegionsSummary(), source: 'synthetic demo', updatedAt: new Date().toISOString() });
});

app.get('/api/v1/region/:name', (req, res) => {
    const region = getRegionByName(req.params.name);
    if (!region) {
        return res.status(404).json({ error: 'Region not found', suggestions: regionCatalog.slice(0, 10).map(r => r.name) });
    }

    res.json({ data: region, source: 'synthetic demo' });
});

app.get('/api/v1/forecast', (req, res) => {
    const region = req.query.region || 'Madhya Pradesh';
    const lead = Number(req.query.lead || 1);
    const record = getForecastByRegionAndLead(region, lead);
    if (!record) return res.status(404).json({ error: 'Forecast not found for region' });
    res.json({ data: record, source: 'synthetic demo' });
});

app.get('/api/v1/expected-error', (req, res) => {
    const region = req.query.region || 'Madhya Pradesh';
    const lead = Number(req.query.lead || 1);
    const variable = req.query.variable || 'Rainfall';
    const record = getExpectedError(region, lead, variable);
    if (!record) return res.status(404).json({ error: 'Expected error not found' });
    res.json({ data: record, source: 'synthetic demo' });
});

app.get('/api/v1/bust-probability', (req, res) => {
    const region = req.query.region || 'Madhya Pradesh';
    const lead = Number(req.query.lead || 1);
    const record = getBustProbability(region, lead);
    if (!record) return res.status(404).json({ error: 'Bust probability not found' });
    res.json({ data: record, source: 'synthetic demo' });
});

app.get('/api/v1/confidence-map', (req, res) => {
    const lead = Number(req.query.lead || 1);
    const variable = req.query.variable || 'Rainfall';
    res.json({ data: getConfidenceMap(lead, variable), source: 'synthetic demo' });
});

app.get('/api/v1/explain', (req, res) => {
    const region = req.query.region || 'Madhya Pradesh';
    const lead = Number(req.query.lead || 1);
    const explanation = getExplainability(region, lead);
    if (!explanation) return res.status(404).json({ error: 'Explanations unavailable' });
    res.json({ data: explanation, source: 'synthetic demo' });
});

app.get('/api/v1/events', (req, res) => {
    const type = req.query.type || 'all';
    res.json({ data: getEvents(type), source: 'synthetic demo' });
});

app.get('/api/v1/alerts', (req, res) => {
    res.json({ data: getAlerts(), source: 'synthetic demo' });
});

app.get('/api/v1/status', (req, res) => {
    res.json({ data: getStatus(), source: 'synthetic demo' });
});

app.get('/api/v1/config', (req, res) => {
    res.json({
        data: {
            source: 'synthetic',
            switchableSource: 'set DATA_SOURCE=synthetic|ncmrwf',
            badge: 'Prototype: synthetic demonstration data'
        }
    });
});

app.get('/api/v1/health', (req, res) => {
    res.json({ ok: true, message: 'Dashboard API is live' });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Forecast bust dashboard running at http://localhost:${PORT}`);
});
