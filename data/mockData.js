const regionCatalog = [
    { name: 'Madhya Pradesh', aliases: ['madhya pradesh', 'mp', 'madhya'], x: 460, y: 250, risk: 'High' },
    { name: 'Rajasthan', aliases: ['rajasthan', 'rj'], x: 270, y: 230, risk: 'Very High' },
    { name: 'Kerala', aliases: ['kerala', 'kl'], x: 620, y: 500, risk: 'High' },
    { name: 'Tamil Nadu', aliases: ['tamil nadu', 'tn', 'tamil'], x: 640, y: 570, risk: 'Moderate' },
    { name: 'Odisha', aliases: ['odisha', 'orissa'], x: 540, y: 360, risk: 'High' },
    { name: 'Jammu & Kashmir', aliases: ['jammu and kashmir', 'j&k', 'jk', 'jammu'], x: 280, y: 120, risk: 'High' },
    { name: 'Uttar Pradesh', aliases: ['uttar pradesh', 'up'], x: 390, y: 180, risk: 'Moderate' },
    { name: 'Gujarat', aliases: ['gujarat', 'gj'], x: 190, y: 340, risk: 'Moderate' },
    { name: 'Maharashtra', aliases: ['maharashtra', 'mh'], x: 360, y: 420, risk: 'Moderate' },
    { name: 'West Bengal', aliases: ['west bengal', 'wb'], x: 670, y: 250, risk: 'Moderate' },
    { name: 'Assam', aliases: ['assam', 'as'], x: 760, y: 170, risk: 'Moderate' },
    { name: 'Punjab', aliases: ['punjab', 'pb'], x: 270, y: 170, risk: 'Moderate' },
    { name: 'Himachal Pradesh', aliases: ['himachal pradesh', 'hp'], x: 330, y: 140, risk: 'Moderate' },
    { name: 'Andhra Pradesh', aliases: ['andhra pradesh', 'ap'], x: 620, y: 430, risk: 'Moderate' },
    { name: 'Bihar', aliases: ['bihar', 'br'], x: 520, y: 200, risk: 'Moderate' },
    { name: 'Delhi', aliases: ['delhi', 'new delhi'], x: 370, y: 170, risk: 'Moderate' },
    { name: 'Goa', aliases: ['goa'], x: 340, y: 520, risk: 'Low' },
    { name: 'Sikkim', aliases: ['sikkim', 'sk'], x: 640, y: 160, risk: 'Low' },
    { name: 'Tripura', aliases: ['tripura', 'tr'], x: 700, y: 270, risk: 'Low' },
    { name: 'Nagaland', aliases: ['nagaland', 'nl'], x: 790, y: 200, risk: 'Low' }
];

const additionalRegions = [
    'Andaman and Nicobar Islands', 'Arunachal Pradesh', 'Chandigarh', 'Chhattisgarh',
    'Dadra and Nagar Haveli', 'Daman and Diu', 'Haryana', 'Jharkhand', 'Karnataka',
    'Lakshadweep', 'Manipur', 'Meghalaya', 'Mizoram', 'Puducherry', 'Telangana', 'Uttarakhand'
].map((name) => ({ name, aliases: [name.toLowerCase()] }));

regionCatalog.push(...additionalRegions);

const aliases = Object.fromEntries(regionCatalog.flatMap(region => region.aliases.map(alias => [alias, region.name])));
const variables = ['Rainfall', 'Temperature', 'Wind speed', 'Wind direction', 'Pressure', 'Humidity', 'Geopotential height'];
const riskLevels = ['Low', 'Moderate', 'High', 'Very High'];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round(value) {
    return Number(value.toFixed(1));
}

function getRiskLevel(probability) {
    if (probability >= 0.8) return 'Very High';
    if (probability >= 0.6) return 'High';
    if (probability >= 0.35) return 'Moderate';
    return 'Low';
}

function computeSequence(base, lead, regionFactor, offset = 0) {
    return round(base * (1 + (lead - 1) * 0.08 + regionFactor * 0.025) + offset);
}

function buildDayRecord(regionName, lead, baseProfile) {
    const regionFactor = baseProfile.factor;
    const forecastRain = computeSequence(baseProfile.rainfall, lead, regionFactor, baseProfile.rainOffset || 0);
    const expectedError = computeSequence(baseProfile.error, lead, regionFactor, baseProfile.errorOffset || 0);
    const bustProbability = Number(clamp((baseProfile.bust - 0.35) * 1.5 + 0.24 + lead * 0.018 + regionFactor * 0.04, 0.05, 0.96).toFixed(2));
    const confidence = clamp(0.92 - lead * 0.07 - regionFactor * 0.11, 0.08, 0.88);
    const riskLevel = getRiskLevel(bustProbability);

    return {
        lead,
        forecast: {
            rainfall: forecastRain,
            temperature: round(baseProfile.temperature + (lead - 1) * 0.35 + regionFactor * 0.8),
            wind: round(baseProfile.wind + (lead - 1) * 0.7 + regionFactor * 1.5),
            windDirection: round(((baseProfile.windDirection ?? 225) + lead * 7 + regionFactor * 3) % 360),
            pressure: round(baseProfile.pressure - lead * 0.8 - regionFactor * 1.4),
            humidity: round(baseProfile.humidity - lead * 2.4 - regionFactor * 3.5),
            geopotential: round(baseProfile.geopotential + lead * 28 + regionFactor * 45)
        },
        expectedError: {
            rainfall: expectedError,
            temperature: round((baseProfile.errorTemp ?? baseProfile.error * 0.08) + lead * 0.8 + regionFactor * 1.3),
            wind: round((baseProfile.errorWind ?? baseProfile.error * 0.1) + lead * 1.1 + regionFactor * 1.7),
            windDirection: round(8 + lead * 1.5 + regionFactor * 2),
            pressure: round(1.5 + lead * 0.7 + regionFactor),
            humidity: round(5 + lead * 1.5 + regionFactor * 2),
            geopotential: round(40 + lead * 12 + regionFactor * 20)
        },
        bustProbability,
        confidence: Number(confidence.toFixed(2)),
        riskLevel,
        alert: riskLevel === 'Low' ? 'stable' : riskLevel === 'Moderate' ? 'elevated' : 'critical'
    };
}

const regionProfiles = {
    'Madhya Pradesh': { rainfall: 120, error: 58, bust: 0.64, temperature: 31, wind: 17, pressure: 1008, humidity: 68, geopotential: 5550, factor: 0.7 },
    'Rajasthan': { rainfall: 42, error: 34, bust: 0.72, temperature: 38, wind: 16, pressure: 1001, humidity: 28, geopotential: 5010, factor: 0.9 },
    'Kerala': { rainfall: 150, error: 68, bust: 0.7, temperature: 29, wind: 18, pressure: 1006, humidity: 84, geopotential: 5280, factor: 0.8 },
    'Tamil Nadu': { rainfall: 108, error: 46, bust: 0.61, temperature: 30, wind: 21, pressure: 1005, humidity: 75, geopotential: 5105, factor: 0.6 },
    'Odisha': { rainfall: 132, error: 62, bust: 0.68, temperature: 31, wind: 22, pressure: 1005, humidity: 74, geopotential: 5150, factor: 0.75 },
    'Jammu & Kashmir': { rainfall: 98, error: 42, bust: 0.58, temperature: 18, wind: 11, pressure: 1010, humidity: 63, geopotential: 5650, factor: 0.45 },
    'Uttar Pradesh': { rainfall: 90, error: 40, bust: 0.52, temperature: 33, wind: 18, pressure: 1007, humidity: 60, geopotential: 5480, factor: 0.55 },
    'Gujarat': { rainfall: 66, error: 29, bust: 0.48, temperature: 34, wind: 20, pressure: 1002, humidity: 52, geopotential: 5250, factor: 0.42 },
    'Maharashtra': { rainfall: 80, error: 33, bust: 0.49, temperature: 31, wind: 15, pressure: 1005, humidity: 58, geopotential: 5350, factor: 0.35 },
    'West Bengal': { rainfall: 112, error: 54, bust: 0.59, temperature: 30, wind: 19, pressure: 1004, humidity: 72, geopotential: 5180, factor: 0.52 },
    'Assam': { rainfall: 124, error: 56, bust: 0.62, temperature: 27, wind: 12, pressure: 1008, humidity: 77, geopotential: 5330, factor: 0.61 },
    'Punjab': { rainfall: 52, error: 24, bust: 0.44, temperature: 29, wind: 13, pressure: 1007, humidity: 51, geopotential: 5400, factor: 0.37 },
    'Himachal Pradesh': { rainfall: 74, error: 30, bust: 0.46, temperature: 23, wind: 10, pressure: 1010, humidity: 62, geopotential: 5590, factor: 0.4 },
    'Andhra Pradesh': { rainfall: 88, error: 39, bust: 0.53, temperature: 32, wind: 18, pressure: 1006, humidity: 67, geopotential: 5220, factor: 0.5 },
    'Bihar': { rainfall: 96, error: 41, bust: 0.51, temperature: 32, wind: 17, pressure: 1007, humidity: 64, geopotential: 5455, factor: 0.47 },
    'Delhi': { rainfall: 58, error: 26, bust: 0.47, temperature: 34, wind: 17, pressure: 1004, humidity: 48, geopotential: 5390, factor: 0.4 },
    'Goa': { rainfall: 76, error: 31, bust: 0.4, temperature: 30, wind: 21, pressure: 1006, humidity: 72, geopotential: 5120, factor: 0.24 },
    'Sikkim': { rainfall: 92, error: 38, bust: 0.43, temperature: 24, wind: 12, pressure: 1011, humidity: 74, geopotential: 5660, factor: 0.29 },
    'Tripura': { rainfall: 104, error: 44, bust: 0.5, temperature: 28, wind: 16, pressure: 1007, humidity: 79, geopotential: 5300, factor: 0.31 },
    'Nagaland': { rainfall: 118, error: 48, bust: 0.55, temperature: 27, wind: 14, pressure: 1008, humidity: 76, geopotential: 5350, factor: 0.38 }
};

additionalRegions.forEach(({ name }, index) => {
    const factor = 0.3 + (index % 6) * 0.11;
    regionProfiles[name] = {
        rainfall: 55 + (index * 19) % 100,
        error: 22 + (index * 13) % 45,
        bust: 0.34 + (index % 6) * 0.055,
        temperature: 22 + (index * 2.7) % 15,
        wind: 8 + (index * 3) % 15,
        pressure: 1000 + index % 11,
        humidity: 42 + (index * 7) % 43,
        geopotential: 5000 + (index * 37) % 650,
        factor
    };
});

function getRegionsSummary() {
    return regionCatalog.map((region) => {
        const metrics = buildDayRecord(region.name, 1, regionProfiles[region.name]);
        return {
            name: region.name,
            risk: metrics.riskLevel,
            bustProbability: metrics.bustProbability * 100,
            expectedError: metrics.expectedError.rainfall,
            confidence: metrics.confidence * 100,
            x: region.x,
            y: region.y,
            aliases: region.aliases
        };
    });
}

function getNormalisedName(name) {
    const cleaned = String(name || '').trim().toLowerCase();
    if (!cleaned) return null;
    if (aliases[cleaned]) return aliases[cleaned];
    const direct = Object.entries(aliases).find(([alias, actual]) => cleaned.includes(alias) || alias.includes(cleaned));
    return direct ? direct[1] : null;
}

function getRegionByName(name) {
    const regionName = getNormalisedName(name) || name;
    const region = regionCatalog.find((item) => item.name.toLowerCase() === String(regionName).trim().toLowerCase());
    if (!region) return null;

    const profile = regionProfiles[region.name] || regionProfiles['Madhya Pradesh'];
    const days = Array.from({ length: 10 }, (_, idx) => buildDayRecord(region.name, idx + 1, profile));

    return {
        region: region.name,
        cycle: '00 UTC / 12 UTC',
        mapPosition: { x: region.x, y: region.y },
        summary: {
            risk: days[0].riskLevel,
            bustProbability: days[0].bustProbability * 100,
            confidence: days[0].confidence * 100,
            expectedError: days[0].expectedError.rainfall,
            observedWeather: {
                rainfall: 25,
                temperature: 27,
                wind: 18,
                pressure: 1006,
                humidity: 72
            }
        },
        forecast: days,
        weatherNow: {
            rainfall: 28,
            temperature: 32.8,
            windSpeed: 12.4,
            pressure: 1006,
            humidity: 68,
            geopotentialHeight: 5670,
            conditions: 'Monsoon trough in active phase'
        },
        historicalComparison: [
            { year: '2023', event: 'Monsoon Depression', similarity: 81 },
            { year: '2021', event: 'Heavy Rainfall Event', similarity: 74 },
            { year: '2019', event: 'Active Monsoon Phase', similarity: 67 }
        ],
        errorAnalysis: {
            nwpForecast: [120, 95, 110, 130, 90, 80, 95, 120, 86, 72],
            observedWeather: [25, 30, 35, 42, 38, 27, 40, 48, 34, 28],
            actualError: [95, 65, 75, 88, 52, 53, 55, 72, 52, 44],
            aiPredictedError: [70, 52, 62, 81, 47, 49, 51, 68, 50, 42]
        },
        variableDetail: {
            Rainfall: { forecast: 120, expectedError: 58, confidence: 44 },
            Temperature: { forecast: 31.5, expectedError: 4.8, confidence: 62 },
            'Wind speed': { forecast: 18.2, expectedError: 6.1, confidence: 57 },
            'Wind direction': { forecast: 218, expectedError: 14, confidence: 57 },
            Pressure: { forecast: 1006, expectedError: 5.4, confidence: 66 },
            Humidity: { forecast: 68, expectedError: 9.8, confidence: 59 },
            'Geopotential height': { forecast: 5670, expectedError: 118, confidence: 63 }
        }
    };
}

function getForecastByRegionAndLead(region, lead) {
    const regionName = getNormalisedName(region) || region;
    const profile = regionProfiles[regionName] || regionProfiles['Madhya Pradesh'];
    const day = buildDayRecord(regionName, Number(lead), profile);
    return {
        region: regionName,
        lead,
        value: day.forecast.rainfall,
        unit: 'mm',
        expectedError: day.expectedError.rainfall,
        bustProbability: day.bustProbability * 100,
        confidence: day.confidence * 100,
        riskLevel: day.riskLevel
    };
}

function getExpectedError(region, lead, variable) {
    const regionName = getNormalisedName(region) || region;
    const profile = regionProfiles[regionName] || regionProfiles['Madhya Pradesh'];
    const day = buildDayRecord(regionName, Number(lead), profile);
    const metricMap = {
        Rainfall: day.expectedError.rainfall,
        Temperature: day.expectedError.temperature,
        'Wind speed': day.expectedError.wind,
        'Wind direction': day.expectedError.windDirection,
        Pressure: day.expectedError.pressure,
        Humidity: day.expectedError.humidity,
        'Geopotential height': day.expectedError.geopotential
    };

    return {
        region: regionName,
        lead,
        variable,
        expectedError: metricMap[variable] ?? day.expectedError.rainfall,
        absoluteError: Math.abs(metricMap[variable] ?? day.expectedError.rainfall),
        sign: 'Forecast minus Observed',
        note: 'Positive values indicate over-forecast and negative values indicate under-forecast.'
    };
}

function getBustProbability(region, lead) {
    const regionName = getNormalisedName(region) || region;
    const profile = regionProfiles[regionName] || regionProfiles['Madhya Pradesh'];
    const day = buildDayRecord(regionName, Number(lead), profile);
    return {
        region: regionName,
        lead,
        bustProbability: day.bustProbability * 100,
        riskLevel: day.riskLevel,
        confidence: day.confidence * 100
    };
}

function getConfidenceMap(lead, variable) {
    const unitByVariable = {
        Rainfall: 'mm',
        Temperature: '°C',
        'Wind speed': 'km/h',
        'Wind direction': '°',
        Pressure: 'hPa',
        Humidity: '%',
        'Geopotential height': 'gpm'
    };
    return regionCatalog.map((region) => {
        const profile = regionProfiles[region.name];
        const day = buildDayRecord(region.name, Number(lead), profile);
        const errorRecord = getExpectedError(region.name, lead, variable);
        return {
            name: region.name,
            lead: Number(lead),
            x: region.x,
            y: region.y,
            confidence: day.confidence * 100,
            bustProbability: day.bustProbability * 100,
            expectedError: errorRecord.expectedError,
            unit: unitByVariable[variable] || 'mm',
            riskLevel: day.riskLevel,
            variable
        };
    });
}

function getExplainability(region, lead) {
    const regionName = getNormalisedName(region) || region;
    const profile = regionProfiles[regionName] || regionProfiles['Madhya Pradesh'];
    const day = buildDayRecord(regionName, Number(lead), profile);
    return {
        region: regionName,
        lead,
        summary: `${regionName} shows a ${day.riskLevel.toLowerCase()} risk pattern with an elevated forecast-bust tendency driven by moisture convergence and spread in ensemble guidance.`,
        factors: [
            { label: 'Historical forecast-error patterns', value: 0.86 },
            { label: 'Rapidly evolving weather systems', value: 0.81 },
            { label: 'Ensemble spread / model uncertainty', value: 0.79 },
            { label: 'Strong spatial and temporal gradients', value: 0.74 },
            { label: 'Pressure tendency / geopotential anomalies', value: 0.68 }
        ]
    };
}

function getEvents(type = 'all') {
    const events = [
        {
            id: 'event-1',
            type: 'Monsoon Depression',
            region: 'Odisha',
            date: '2025-07-15',
            forecast: 145,
            observed: 91,
            error: 54,
            similarity: 88,
            risk: 'High'
        },
        {
            id: 'event-2',
            type: 'Heavy Rainfall Event',
            region: 'Kerala',
            date: '2025-06-12',
            forecast: 180,
            observed: 68,
            error: 112,
            similarity: 83,
            risk: 'Very High'
        },
        {
            id: 'event-3',
            type: 'Western Disturbance',
            region: 'Jammu & Kashmir',
            date: '2025-02-21',
            forecast: 96,
            observed: 58,
            error: 38,
            similarity: 79,
            risk: 'Moderate'
        },
        {
            id: 'event-4',
            type: 'Cyclone',
            region: 'Tamil Nadu',
            date: '2024-11-29',
            forecast: 112,
            observed: 48,
            error: 64,
            similarity: 76,
            risk: 'High'
        },
        {
            id: 'event-5',
            type: 'Heat Wave',
            region: 'Rajasthan',
            date: '2025-05-03',
            forecast: 42,
            observed: 29,
            error: 13,
            similarity: 81,
            risk: 'High'
        },
        {
            id: 'event-6',
            type: 'Active/Break Monsoon Phase',
            region: 'Madhya Pradesh',
            date: '2024-07-07',
            forecast: 126,
            observed: 71,
            error: 55,
            similarity: 85,
            risk: 'High'
        }
    ];

    if (type === 'all') return events;
    return events.filter((event) => event.type.toLowerCase() === String(type).toLowerCase());
}

function getAlerts() {
    return [
        {
            region: 'Madhya Pradesh',
            leadTime: 'Day 5',
            severity: 'High',
            eventType: 'Active/Break Monsoon Phase',
            explanation: 'Persistent monsoon trough and steep rainfall gradients increase the likelihood of a wet-bias bust.',
            probability: 76
        },
        {
            region: 'Rajasthan',
            leadTime: 'Day 6',
            severity: 'Very High',
            eventType: 'Heat Wave',
            explanation: 'Strong daytime convective suppression and elevated temperature anomalies create a significant heat-wave risk signal.',
            probability: 81
        },
        {
            region: 'Kerala',
            leadTime: 'Day 4',
            severity: 'High',
            eventType: 'Heavy Rainfall Event',
            explanation: 'Moisture transport and ensemble spread remain elevated, pointing to an over-forecast rainfall surge.',
            probability: 72
        }
    ];
}

function getStatus() {
    return {
        dataStatus: { nwp: 'Operational', observations: 'Operational', model: 'Healthy' },
        prototypeApi: [
            '/api/v1/regions',
            '/api/v1/region/{name}',
            '/api/v1/forecast',
            '/api/v1/expected-error',
            '/api/v1/bust-probability',
            '/api/v1/confidence-map',
            '/api/v1/explain',
            '/api/v1/events',
            '/api/v1/alerts',
            '/api/v1/status'
        ],
        pipeline: {
            scheduledIngestion: { status: 'Running', lastRun: '2026-10-01 00:00 UTC', nextScheduled: '2026-10-01 12:00 UTC' },
            modelInference: { status: 'Succeeded', lastRun: '2026-10-01 00:10 UTC', nextScheduled: '2026-10-01 12:10 UTC' },
            alertGeneration: { status: 'Succeeded', lastRun: '2026-10-01 00:12 UTC', nextScheduled: '2026-10-01 12:12 UTC' },
            bulletinDrafting: { status: 'Running', lastRun: '2026-10-01 00:15 UTC', nextScheduled: '2026-10-01 12:15 UTC' }
        },
        validation: {
            reliabilityDiagram: 'well calibrated at Day 3-5',
            brierScore: 0.19,
            pod: 0.82,
            falseAlarmRatio: 0.24,
            skillVsClimatology: '+12%'
        }
    };
}

module.exports = {
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
};
