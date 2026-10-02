const state = {
    selectedRegion: 'Madhya Pradesh',
    selectedDay: 1,
    selectedVariable: 'Rainfall',
    mapMetric: 'Bust Probability',
    activePage: 'map',
    mapZoomed: false,
    regionData: null,
    allRegions: [],
    availableDistricts: [],
    selectedDistrict: null,
    mapGeometry: [],
    mapCenters: {},
    mapViewBox: '0 0 612 696',
    lastUpdated: null,
    liveWeather: null,
    forecastSelectedIndex: 0,
    regionRequestId: 0,
    weatherRequestId: 0
};

const regionPalette = {
    Low: '#7ccf8d',
    Moderate: '#f0d66c',
    High: '#ea9d56',
    'Very High': '#d85d4f'
};

const regionShapes = {
    'Madhya Pradesh': { d: 'M430,245 L495,192 L565,215 L585,281 L545,346 L474,334 L420,296 Z', x: 490, y: 280 },
    'Rajasthan': { d: 'M200,165 L302,121 L360,146 L405,214 L388,290 L286,306 L177,264 Z', x: 280, y: 220 },
    'Kerala': { d: 'M560,412 L588,437 L611,484 L596,535 L552,538 L526,492 Z', x: 570, y: 480 },
    'Tamil Nadu': { d: 'M560,502 L620,502 L646,548 L610,590 L540,566 Z', x: 590, y: 540 },
    'Odisha': { d: 'M472,280 L556,257 L598,291 L603,346 L557,389 L483,375 L453,328 Z', x: 530, y: 320 },
    'Jammu & Kashmir': { d: 'M240,55 L332,44 L362,96 L330,146 L270,159 L214,118 Z', x: 285, y: 98 },
    'Uttar Pradesh': { d: 'M325,146 L434,131 L470,175 L447,240 L354,248 L305,200 Z', x: 390, y: 190 },
    'Gujarat': { d: 'M150,295 L235,253 L288,286 L293,348 L230,402 L160,382 Z', x: 220, y: 325 },
    'Maharashtra': { d: 'M319,338 L424,312 L475,367 L447,455 L341,468 L289,404 Z', x: 380, y: 390 },
    'West Bengal': { d: 'M635,240 L685,237 L720,289 L693,337 L637,329 L610,282 Z', x: 675, y: 287 },
    'Assam': { d: 'M720,175 L780,165 L810,220 L794,265 L742,255 L703,212 Z', x: 760, y: 210 },
    'Punjab': { d: 'M250,131 L308,119 L336,145 L322,186 L258,192 L220,165 Z', x: 280, y: 155 },
    'Himachal Pradesh': { d: 'M338,94 L380,86 L410,122 L390,161 L336,154 Z', x: 371, y: 120 },
    'Andhra Pradesh': { d: 'M516,381 L607,375 L642,427 L630,493 L560,506 L500,449 Z', x: 580, y: 440 },
    'Bihar': { d: 'M465,182 L528,163 L566,193 L560,240 L490,246 L456,213 Z', x: 510, y: 200 },
    'Delhi': { d: 'M355,175 L371,170 L390,184 L381,198 L357,196 Z', x: 370, y: 183 },
    'Goa': { d: 'M342,518 L368,507 L388,537 L370,556 L346,548 Z', x: 365, y: 530 },
    'Sikkim': { d: 'M642,155 L662,149 L674,170 L665,187 L646,184 Z', x: 655, y: 170 },
    'Tripura': { d: 'M702,288 L725,283 L742,302 L725,319 L700,309 Z', x: 720, y: 300 },
    'Nagaland': { d: 'M778,186 L806,180 L822,201 L811,223 L782,220 Z', x: 800, y: 200 }
};

const pageMeta = {
    overview: { title: 'Overview', subtitle: 'Overall forecast situation and alert summary' },
    map: { title: 'Forecast Map', subtitle: 'Explore forecast confidence and bust probability across Indian regions' },
    region: { title: 'Region Analysis', subtitle: 'Regional weather, error structure, and historical comparison' },
    forecast: { title: '10-Day Forecast', subtitle: 'Lead-time risk trend and confidence deterioration' },
    variables: { title: 'Weather Variables', subtitle: 'Variable-driven patterns and forecast conditions' },
    analysis: { title: 'Forecast Error Analysis', subtitle: 'Forecast error diagnostics and reliability review' },
    explainability: { title: 'AI Explainability', subtitle: 'Feature importance and operational interpretation' },
    alerts: { title: 'Alerts', subtitle: 'High-risk operational forecast bust triggers' },
    history: { title: 'Historical Data', subtitle: 'Past NWP vs observed weather and bust events' },
    system: { title: 'System, Automation & Validation', subtitle: 'Model, data status and automation pipeline health' }
};

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Request failed');
    const payload = await response.json();
    if (payload.updatedAt) state.lastUpdated = payload.updatedAt;
    return payload.data || payload;
}

function updateHeaderClock() {
    const now = new Date();
    document.getElementById('currentDate').textContent = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    }).format(now);
    document.getElementById('currentTime').textContent = `${new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now)} IST`;
}

function normalise(input) {
    return String(input || '').toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function canonicalRegionName(name) {
    return name === 'Jammu and Kashmir' ? 'Jammu & Kashmir' : name;
}

function parseCommand(input) {
    const text = normalise(input || '');
    if (!text) {
        return { region: state.selectedRegion, day: state.selectedDay, variable: state.selectedVariable };
    }

    const regionAliasMap = {};
    const regionNames = state.allRegions.length ? state.allRegions.map((region) => region.name) : Object.keys(regionShapes);
    regionNames.forEach((name) => {
        const regionRecord = state.allRegions.find((region) => region.name === name);
        const aliases = [
            name,
            normalise(name),
            name.replace(/&/g, 'and'),
            name.replace(/&/g, ' and '),
            ...(regionRecord?.aliases || [])
        ];
        aliases.forEach((alias) => {
            if (alias) regionAliasMap[normalise(alias)] = name;
        });
    });

    let region = state.selectedRegion;
    let hasRegion = false;
    for (const key of Object.keys(regionAliasMap).filter((alias) => alias.length > 1).sort((a, b) => b.length - a.length)) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(?:^|\\s)${escapedKey}(?:\\s|$)`).test(text)) {
            region = regionAliasMap[key];
            hasRegion = true;
            break;
        }
    }

    const dayMatch = text.match(/day\s*(\d+)/i) || text.match(/\b(\d+)\b/);
    const day = dayMatch ? Number(dayMatch[1]) : state.selectedDay;

    const variableMap = {
        rainfall: 'Rainfall',
        temperature: 'Temperature',
        'wind direction': 'Wind direction',
        wind: 'Wind speed',
        'wind speed': 'Wind speed',
        pressure: 'Pressure',
        humidity: 'Humidity',
        geopotential: 'Geopotential height',
        'geopotential height': 'Geopotential height'
    };

    let variable = state.selectedVariable;
    for (const [key, value] of Object.entries(variableMap)) {
        if (text.includes(key)) {
            variable = value;
            break;
        }
    }

    return { region, day, variable, hasRegion };
}

function setPage(pageKey) {
    state.activePage = pageKey;
    document.querySelector('.app-shell').classList.toggle('map-workspace', pageKey === 'map');
    document.querySelectorAll('.nav-item').forEach((button) => {
        button.classList.toggle('active', button.dataset.page === pageKey);
    });
    document.querySelectorAll('.page').forEach((page) => {
        page.classList.toggle('active', page.id === `${pageKey}Page`);
    });

    const meta = pageMeta[pageKey] || pageMeta.map;
    document.getElementById('pageTitle').textContent = meta.title;
    document.getElementById('pageSubtitle').textContent = meta.subtitle;
}

function updateContextBar() {
    document.getElementById('contextRegion').textContent = state.selectedRegion;
    document.getElementById('contextDay').textContent = `Day ${state.selectedDay}`;
    document.getElementById('contextVariable').textContent = state.selectedVariable;
    document.getElementById('contextCycle').textContent = '00 UTC';
    syncRegionSelection();
}

function syncRegionSelection() {
    ['headerRegionSelect', 'regionSelect', 'forecastRegionSelect', 'historyRegionSelect'].forEach((id) => {
        const select = document.getElementById(id);
        if (select?.options.length) select.value = state.selectedRegion;
    });
    document.querySelectorAll('.overview-risk-item').forEach((button) => {
        const selected = button.dataset.region === state.selectedRegion;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('#overviewMapLayer .overview-region').forEach((path) => {
        path.classList.toggle('selected', path.dataset.region === state.selectedRegion);
    });
}

function riskClass(percent) {
    if (percent >= 80) return 'very-high';
    if (percent >= 60) return 'high';
    if (percent >= 35) return 'moderate';
    return 'low';
}

function mapRisk(region) {
    const value = state.mapMetric === 'Confidence'
        ? 100 - Number(region.confidence)
        : state.mapMetric === 'Expected Error'
            ? Number(region.expectedError)
            : Number(region.bustProbability);
    const values = (state.mapRegions || []).map((item) => state.mapMetric === 'Confidence'
        ? 100 - Number(item.confidence)
        : state.mapMetric === 'Expected Error'
            ? Number(item.expectedError)
            : Number(item.bustProbability)).sort((a, b) => a - b);
    if (state.mapMetric === 'Bust Probability') return riskClass(value);
    const rank = values.filter((item) => item <= value).length / Math.max(values.length, 1);
    if (rank >= 0.75) return 'very-high';
    if (rank >= 0.5) return 'high';
    if (rank >= 0.25) return 'moderate';
    return 'low';
}

async function getMapRegions() {
    return fetchJson(`/api/v1/confidence-map?lead=${state.selectedDay}&variable=${encodeURIComponent(state.selectedVariable)}`);
}

async function getExplainability() {
    return fetchJson(`/api/v1/explain?region=${encodeURIComponent(state.selectedRegion)}&lead=${state.selectedDay}`);
}

function forecastMetrics(day, variable = state.selectedVariable) {
    const metrics = {
        Rainfall: { forecast: day.forecast.rainfall, error: day.expectedError.rainfall, unit: 'mm' },
        Temperature: { forecast: day.forecast.temperature, error: day.expectedError.temperature, unit: '°C' },
        'Wind speed': { forecast: day.forecast.wind, error: day.expectedError.wind, unit: 'km/h' },
        'Wind direction': { forecast: day.forecast.windDirection, error: day.expectedError.windDirection, unit: '°' },
        Pressure: { forecast: day.forecast.pressure, error: day.expectedError.pressure, unit: 'hPa' },
        Humidity: { forecast: day.forecast.humidity, error: day.expectedError.humidity, unit: '%' },
        'Geopotential height': { forecast: day.forecast.geopotential, error: day.expectedError.geopotential, unit: 'gpm' }
    };
    return metrics[variable] || metrics.Rainfall;
}

function renderOverview(regions, alerts) {
    const highRiskRegions = regions.filter((r) => ['High', 'Very High'].includes(r.risk)).length;
    const overallConfidence = Math.round(regions.reduce((sum, r) => sum + Number(r.confidence), 0) / regions.length);
    document.getElementById('highRiskCount').textContent = String(highRiskRegions);
    document.getElementById('overallConfidence').textContent = `${overallConfidence}%`;
    renderOverviewMap(regions);

    const highRiskList = document.getElementById('highRiskRegionList');
    highRiskList.innerHTML = [...regions]
        .sort((first, second) => Number(second.bustProbability) - Number(first.bustProbability))
        .slice(0, 5)
        .map((region) => `
            <button class="overview-risk-item" type="button" data-region="${region.name}">
                <span><strong>${region.name}</strong><small>${region.risk} risk · Confidence ${Math.round(region.confidence)}%</small></span>
                <b>${Math.round(region.bustProbability)}%</b>
            </button>
        `).join('');
    highRiskList.querySelectorAll('[data-region]').forEach((button) => {
        button.addEventListener('click', async () => {
            setPage('map');
            await focusRegion(button.dataset.region);
        });
    });
    syncRegionSelection();

    const alertContainer = document.getElementById('alertCards');
    alertContainer.innerHTML = alerts.slice(0, 4).map((alert) => `
    <div class="alert-item">
      <div class="alert-top">
        <strong>${alert.region}</strong>
        <span class="severity-badge ${riskClass(alert.probability)}">${alert.severity}</span>
      </div>
      <small>${alert.eventType} · ${alert.leadTime}</small>
      <div>${alert.explanation}</div>
    </div>
  `).join('');
}

function renderOverviewMap(regions) {
    const layer = document.getElementById('overviewMapLayer');
    const map = document.getElementById('overviewIndiaMap');
    if (!layer || !map) return;
    map.setAttribute('viewBox', state.mapViewBox);
    layer.replaceChildren();

    state.mapGeometry.forEach((location) => {
        const name = canonicalRegionName(location.name);
        const summary = regions.find((region) => region.name === name);
        if (!summary) return;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const risk = mapRisk(summary);
        const riskLabel = risk === 'very-high' ? 'Very High' : risk[0].toUpperCase() + risk.slice(1);
        path.setAttribute('d', location.path);
        path.setAttribute('class', `overview-region ${risk} ${name === state.selectedRegion ? 'selected' : ''}`);
        path.dataset.region = name;
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', `${name}, ${riskLabel} model-estimated bust risk, ${Math.round(summary.bustProbability)} percent`);
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${name} · ${riskLabel} model-estimated risk · ${Math.round(summary.bustProbability)}%`;
        path.appendChild(title);
        const openRegion = async () => {
            setPage('map');
            await focusRegion(name);
        };
        path.addEventListener('click', openRegion);
        path.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') openRegion();
        });
        layer.appendChild(path);
    });
}

function renderLiveWeather(weather) {
    if (weather.region !== state.selectedRegion) return;
    state.liveWeather = weather;
    const current = weather.current;
    const values = [
        { label: 'Temperature', value: `${current.temperatureC} °C` },
        { label: 'Rainfall', value: `${current.precipitationMm} mm` },
        { label: 'Wind speed', value: `${current.windKph} km/h` },
        { label: 'Wind direction', value: current.windDirection },
        { label: 'Pressure', value: `${current.pressureMb} hPa` },
        { label: 'Humidity', value: `${current.humidity}%` }
    ];
    document.getElementById('weatherStrip').innerHTML = values.map((item) => `
      <div class="weather-item">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
        <small>${weather.location.name} · live</small>
      </div>
    `).join('');

    const status = document.getElementById('weatherProviderStatus');
    status.textContent = `WeatherAPI · Updated ${current.lastUpdated}`;
    document.getElementById('overviewWeatherTitle').textContent = `Latest observation · ${weather.location.name}`;
    document.getElementById('forecastRegionLocation').textContent = `${weather.location.name}, ${weather.region}`;
    document.getElementById('overviewTemperature').textContent = `${current.temperatureC} °C`;
    document.getElementById('overviewWeatherCondition').textContent = `${current.condition} · ${weather.location.localtime}`;
    document.getElementById('overviewWeatherDetails').innerHTML = `
      <div class="worked-row"><span>Condition</span><strong>${current.condition}</strong></div>
      <div class="worked-row"><span>Rainfall</span><strong>${current.precipitationMm} mm</strong></div>
      <div class="worked-row"><span>Wind</span><strong>${current.windKph} km/h ${current.windDirection}</strong></div>
      <div class="worked-row"><span>Pressure · humidity</span><strong>${current.pressureMb} mb · ${current.humidity}%</strong></div>
      <p class="worked-legend">${weather.location.name}, ${weather.region} · Updated ${current.lastUpdated}</p>
    `;
    if (state.regionData?.region === weather.region) {
        renderRegionAnalysis(state.regionData);
        renderForecastTimeline(state.regionData);
    }
}

async function loadLiveWeather(region = state.selectedRegion, district = state.selectedDistrict) {
    const requestId = ++state.weatherRequestId;
    const status = document.getElementById('weatherProviderStatus');
    const weatherArea = district ? `${district}, ${region}` : region;
    state.liveWeather = null;
    status.textContent = `WeatherAPI · Loading ${weatherArea}`;
    document.getElementById('forecastRegionLocation').textContent = `Loading ${weatherArea}…`;
    try {
        const districtQuery = district ? `&district=${encodeURIComponent(district)}` : '';
        const weather = await fetchJson(`/api/v1/weather/forecast?region=${encodeURIComponent(region)}${districtQuery}&days=10`);
        if (requestId !== state.weatherRequestId || region !== state.selectedRegion) return;
        renderLiveWeather(weather);
    } catch (error) {
        if (requestId !== state.weatherRequestId || region !== state.selectedRegion) return;
        state.liveWeather = null;
        status.textContent = 'WeatherAPI · Unavailable';
        document.getElementById('forecastRegionLocation').textContent = `${weatherArea} · Weather unavailable`;
        document.getElementById('overviewTemperature').textContent = 'Unavailable';
        document.getElementById('overviewWeatherCondition').textContent = error.message;
        document.getElementById('overviewWeatherDetails').textContent = error.message;
        document.getElementById('weatherStrip').innerHTML = `<div class="weather-unavailable">${error.message}</div>`;
        if (state.regionData?.region === region) {
            renderRegionAnalysis(state.regionData);
            renderForecastTimeline(state.regionData);
        }
    }
}

function renderMap(regions) {
    state.mapRegions = regions;
    const layer = document.getElementById('mapRegionLayer');
    layer.innerHTML = '';
    state.mapCenters = {};

    (state.mapGeometry || []).forEach((location) => {
        const regionName = canonicalRegionName(location.name);
        const regionSummary = regions.find((item) => item.name === regionName);
        if (!regionSummary) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', location.path);
        const risk = mapRisk(regionSummary);
        const riskLabel = risk === 'very-high' ? 'Very High' : risk[0].toUpperCase() + risk.slice(1);
        const metricValue = state.mapMetric === 'Confidence'
            ? `${Math.round(regionSummary.confidence)}%`
            : state.mapMetric === 'Expected Error'
                ? `${regionSummary.expectedError} ${regionSummary.unit || ''}`.trim()
                : `${Math.round(regionSummary.bustProbability)}%`;
        path.style.fill = regionPalette[riskLabel];
        path.setAttribute('class', `region-box ${state.selectedRegion === regionSummary.name ? 'selected' : ''} ${state.mapZoomed && state.selectedRegion !== regionSummary.name ? 'dimmed' : ''}`);
        path.setAttribute('role', 'button');
        path.setAttribute('tabindex', '0');
        path.setAttribute('aria-label', `${regionName}, ${riskLabel} risk, ${metricValue}`);
        path.addEventListener('click', () => focusRegion(regionName));
        path.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') focusRegion(regionName);
        });
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${regionName} · ${riskLabel} risk · Bust ${Math.round(regionSummary.bustProbability)}% · Confidence ${Math.round(regionSummary.confidence)}%`;
        path.appendChild(title);
        layer.appendChild(path);
        const bounds = path.getBBox();
        state.mapCenters[regionName] = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        if (bounds.width > 55 && bounds.height > 28 && !['Andaman and Nicobar Islands', 'Lakshadweep'].includes(regionName)) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', state.mapCenters[regionName].x);
            label.setAttribute('y', state.mapCenters[regionName].y);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('class', 'region-label');
            label.textContent = regionName;
            layer.appendChild(label);
        }
    });

    const selectedShape = state.mapCenters[state.selectedRegion];
    if (state.mapZoomed && selectedShape) {
        const scale = 1.55;
        const svg = document.getElementById('indiaMap');
        const bounds = svg.getBoundingClientRect();
        const [minX, minY, viewWidth, viewHeight] = state.mapViewBox.split(' ').map(Number);
        const translateX = bounds.width * 0.5 - (selectedShape.x - minX) * bounds.width / viewWidth * scale;
        const translateY = bounds.height * 0.5 - (selectedShape.y - minY) * bounds.height / viewHeight * scale;
        layer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    } else {
        layer.style.transform = 'translate(0, 0) scale(1)';
    }

    const selected = regions.find((r) => r.name === state.selectedRegion) || regions[0] || { bustProbability: 0, expectedError: 0, confidence: 0, riskLevel: 'Low' };
    document.getElementById('selectedRegionName').textContent = state.selectedRegion;
    const selectedRisk = mapRisk(selected);
    const selectedRiskLabel = selectedRisk === 'very-high' ? 'Very High' : selectedRisk[0].toUpperCase() + selectedRisk.slice(1);
    document.getElementById('selectedRiskBadge').textContent = `${selectedRiskLabel} Risk`;
    document.getElementById('selectedRiskBadge').className = `risk-pill ${selectedRisk}`;
    document.getElementById('regionBustProbability').textContent = `${Math.round(Number(selected.bustProbability))}%`;
    document.getElementById('regionExpectedError').textContent = `${selected.expectedError} ${selected.unit || 'mm'}`;
    document.getElementById('regionConfidence').textContent = `${Math.round(Number(selected.confidence))}%`;
}

async function focusRegion(name) {
    state.mapZoomed = true;
    updateContextBar();
    document.getElementById('backToIndiaBtn').classList.remove('hidden');

    await loadRegionData(name);
}

async function loadRegionData(name) {
    const requestId = ++state.regionRequestId;
    state.selectedRegion = name;
    state.selectedDistrict = null;
    state.availableDistricts = [];
    state.liveWeather = null;
    updateContextBar();
    document.getElementById('forecastRegionLocation').textContent = `Loading ${name}…`;
    document.getElementById('weatherProviderStatus').textContent = `WeatherAPI · Loading ${name}`;
    const [region, regions, explanation] = await Promise.all([
        fetchJson(`/api/v1/region/${encodeURIComponent(name)}`),
        getMapRegions(),
        getExplainability()
    ]);
    if (requestId !== state.regionRequestId || name !== state.selectedRegion) return;
    renderMap(regions);
    renderRegionAnalysis(region, explanation);
    renderForecastTimeline(region);
    renderVariableCards(region);
    renderExplainability(region, explanation);
    await Promise.all([renderAlertsPage(), renderHistoryPage()]);
    await loadDistricts(name);
    await loadLiveWeather(name, null);
}

async function loadDistricts(region) {
    const panel = document.getElementById('districtPanel');
    const mapPanel = document.getElementById('mapDistrictPanel');
    try {
        const result = await fetchJson(`/api/v1/weather/districts?region=${encodeURIComponent(region)}`);
        if (region !== state.selectedRegion) return;
        state.availableDistricts = result.districts || [];
        panel.classList.toggle('hidden', state.availableDistricts.length === 0);
        document.getElementById('districtPanelTitle').textContent = `${region} districts`;
        document.getElementById('districtCount').textContent = `${result.count} districts`;
        document.getElementById('districtPanelNote').textContent = state.availableDistricts.length
            ? 'Choose a district to load its local weather forecast.'
            : 'District-level selection is not available for this region yet.';
        const districtButtons = state.availableDistricts.map((district) => `
          <button type="button" class="district-button ${district === state.selectedDistrict ? 'selected' : ''}" data-district="${district}" aria-pressed="${district === state.selectedDistrict}">${district}</button>
        `).join('');
        document.getElementById('districtList').innerHTML = districtButtons;
        document.getElementById('mapDistrictList').innerHTML = districtButtons;
        document.getElementById('mapDistrictTitle').textContent = `${region} districts`;
        document.getElementById('mapDistrictCount').textContent = `${result.count} total`;
        document.getElementById('mapDistrictNote').textContent = state.availableDistricts.length
            ? 'Select district for local weather. Risk is state-level.'
            : 'No district list available.';
        mapPanel.classList.toggle('hidden', state.availableDistricts.length === 0);
    } catch (error) {
        panel.classList.add('hidden');
        mapPanel.classList.add('hidden');
    }
}

async function selectDistrict(district) {
    state.selectedDistrict = district;
    document.querySelectorAll('.district-button').forEach((button) => {
        const selected = button.dataset.district === district;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('districtPanelNote').textContent = `${district}, ${state.selectedRegion} · local weather selected; risk estimates remain state-level.`;
    document.getElementById('mapDistrictNote').textContent = `${district}, ${state.selectedRegion} · local weather selected; risk is state-level.`;
    await loadLiveWeather(state.selectedRegion, district);
    if (state.activePage === 'history') await loadWeatherHistory();
}

function providerForecastValue(day, index, modelMetrics) {
    if (!day) return `${modelMetrics.forecast} ${modelMetrics.unit} · model`;
    const values = {
        Rainfall: `${day.precipitationMm} mm`,
        Temperature: `${day.meanTemperatureC} °C`,
        'Wind speed': `${day.maxWindKph} km/h`,
        Humidity: `${day.humidity}%`,
        Pressure: index === 0 && state.liveWeather ? `${state.liveWeather.current.pressureMb} hPa` : null
    };
    return values[state.selectedVariable] ?? (state.selectedVariable in values ? '—' : 'Not available');
}

function providerForecastNumber(day, index, modelMetrics) {
    if (!day) return modelMetrics.forecast;
    const values = {
        Rainfall: day.precipitationMm,
        Temperature: day.meanTemperatureC,
        'Wind speed': day.maxWindKph,
        Humidity: day.humidity,
        Pressure: index === 0 && state.liveWeather ? state.liveWeather.current.pressureMb : modelMetrics.forecast
    };
    return values[state.selectedVariable] ?? modelMetrics.forecast;
}

function renderRegionAnalysis(region) {
    state.regionData = region;
    const forecast = region.forecast || [];
    const providerForecast = state.liveWeather?.region === state.selectedRegion ? state.liveWeather.forecast : [];
    document.getElementById('regionSelect').value = state.selectedRegion;
    document.getElementById('regionVariableSelect').value = state.selectedVariable;
    const summaryCards = document.getElementById('regionSummaryCards');
    const first = forecast.find((day) => day.lead === state.selectedDay) || forecast[0];
    if (!first) return;
    const metrics = forecastMetrics(first);
    const highestRiskDay = forecast.reduce((highest, day) => day.bustProbability > highest.bustProbability ? day : highest, forecast[0]);
    const maximumError = Math.max(...forecast.map((day) => forecastMetrics(day).error));

    const cards = [
        { label: 'Weather forecast', value: providerForecastValue(providerForecast[state.selectedDay - 1], state.selectedDay - 1, metrics) },
        { label: 'Predicted error · model', value: `${metrics.error} ${metrics.unit}` },
        { label: 'Bust probability · model', value: `${Math.round(first.bustProbability * 100)}%` },
        { label: 'Confidence · model', value: `${Math.round(first.confidence * 100)}%` },
        { label: 'Highest-risk lead', value: `Day ${highestRiskDay.lead}` },
        { label: 'Maximum predicted error', value: `${maximumError} ${metrics.unit}` }
    ];
    summaryCards.innerHTML = cards.map((card) => `
    <div class="summary-card">
      <label>${card.label}</label>
      <strong>${card.value}</strong>
    </div>
  `).join('');

    document.getElementById('regionSnapshotTitle').textContent = `${region.region} · Day ${state.selectedDay}`;
    document.getElementById('regionForecastRows').innerHTML = forecast.map((day, index) => {
        const dayMetrics = forecastMetrics(day);
        return `
            <tr class="${day.lead === state.selectedDay ? 'selected' : ''}" data-region-day="${day.lead}">
                <td><button type="button" class="region-day-button" data-region-day="${day.lead}" aria-pressed="${day.lead === state.selectedDay}">Day ${day.lead}</button></td>
                <td>${providerForecastValue(providerForecast[index], index, dayMetrics)}</td>
                <td>${dayMetrics.error} ${dayMetrics.unit}</td>
                <td>${Math.round(day.bustProbability * 100)}%</td>
                <td>${Math.round(day.confidence * 100)}%</td>
                <td><span class="risk-pill ${riskClass(day.bustProbability * 100)}">${day.riskLevel}</span></td>
            </tr>
        `;
    }).join('');

    const conditions = document.getElementById('currentConditions');
    const current = state.liveWeather?.region === state.selectedRegion ? state.liveWeather.current : null;
    conditions.innerHTML = current ? [
        { label: 'Rainfall', value: `${current.precipitationMm} mm` },
        { label: 'Temperature', value: `${current.temperatureC} °C` },
        { label: 'Wind speed', value: `${current.windKph} km/h ${current.windDirection}` },
        { label: 'Pressure', value: `${current.pressureMb} hPa` },
        { label: 'Humidity', value: `${current.humidity}%` }
    ].map((item) => `<div class="condition-item"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('')
        : '<p class="conditions-unavailable">Loading live conditions for this regional capital…</p>';

    renderRegionErrorChart(region, forecast);

    document.getElementById('errorSelectedDay').textContent = `Day ${state.selectedDay} selected`;

    document.getElementById('summaryRows').innerHTML = forecast.slice(0, 5).map((day) => {
        const dayMetrics = forecastMetrics(day);
        return `
    <div class="summary-row">
      <span>Day ${day.lead}</span>
      <span>${dayMetrics.forecast} ${dayMetrics.unit}</span>
      <span>${dayMetrics.error} ${dayMetrics.unit}</span>
      <span>${Math.round(day.bustProbability * 100)}%</span>
      <span>${Math.round(day.confidence * 100)}%</span>
    </div>
  `;
    }).join('');

    const outlook = document.getElementById('leadOutlook');
    outlook.innerHTML = forecast.map((day) => {
        const probability = Math.round(day.bustProbability * 100);
        return `
            <button type="button" class="outlook-day ${riskClass(probability)} ${day.lead === state.selectedDay ? 'selected' : ''}" data-lead="${day.lead}" aria-label="Day ${day.lead}, ${probability}% bust probability">
                <span class="outlook-value">${probability}%</span>
                <span class="outlook-track"><span class="outlook-fill" style="height:${probability}%"></span></span>
                <span class="outlook-label">D${day.lead}</span>
            </button>
        `;
    }).join('');
    outlook.querySelectorAll('.outlook-day').forEach((button) => {
        button.addEventListener('click', () => {
            const leadSelect = document.getElementById('leadSelect');
            leadSelect.value = `Day ${button.dataset.lead}`;
            leadSelect.dispatchEvent(new Event('change'));
        });
    });

    document.getElementById('reasonList').innerHTML = [
        'Similar historical patterns had high forecast errors.',
        'Rapidly evolving low-pressure systems are strengthening.',
        'Strong rainfall gradient in the region is amplifying uncertainty.',
        'High model spread and pressure tendency are reducing confidence.'
    ].map((reason) => `<li>${reason}</li>`).join('');
}

function renderRegionErrorChart(region, forecast) {
    const providerForecast = state.liveWeather?.region === region.region ? state.liveWeather.forecast : [];
    const metrics = forecast.map((day) => forecastMetrics(day));
    const forecastValues = metrics.map((dayMetrics, index) => providerForecastNumber(providerForecast[index], index, dayMetrics));
    const errorValues = metrics.map((dayMetrics) => dayMetrics.error);
    const maxValue = Math.max(...forecastValues, ...errorValues, 1);
    const unit = metrics[0]?.unit || '';
    const hasProviderForecast = providerForecast.length > 0;

    document.getElementById('errorChartTitle').textContent = `Forecast Error Analysis · ${region.region}`;
    const weatherArea = state.selectedDistrict ? `${state.selectedDistrict} district` : region.region;
    document.getElementById('errorChartDescription').textContent = `${weatherArea} · ${state.selectedVariable} (${unit}) forecast vs state-level model-predicted error`;
    document.getElementById('errorChartLegend').innerHTML = `
            <span><i class="forecast"></i>${hasProviderForecast ? 'Weather forecast' : 'Model forecast'}</span>
            <span><i class="ai"></i>Predicted error · model</span>
        `;
    document.getElementById('errorChart').innerHTML = forecast.map((day, index) => `
            <div class="chart-column ${day.lead === state.selectedDay ? 'selected' : ''}" data-chart-day="${day.lead}" role="button" tabindex="0" aria-label="${region.region}, Day ${day.lead}: forecast ${forecastValues[index]} ${unit}, model predicted error ${errorValues[index]} ${unit}">
                <div class="chart-bars">
                    <span class="bar forecast" title="Forecast: ${forecastValues[index]} ${unit}" style="height:${Math.max((forecastValues[index] / maxValue) * 100, 6)}%"></span>
                    <span class="bar ai" title="Predicted error: ${errorValues[index]} ${unit}" style="height:${Math.max((errorValues[index] / maxValue) * 100, 6)}%"></span>
                </div>
                <small>Day ${day.lead}</small>
            </div>
        `).join('');
}

async function selectRegionLead(lead) {
    state.selectedDay = Number(lead);
    document.getElementById('leadSelect').value = `Day ${state.selectedDay}`;
    updateContextBar();
    if (state.regionData) {
        renderRegionAnalysis(state.regionData);
        renderForecastTimeline(state.regionData);
        renderVariableCards(state.regionData);
    }
    if (state.activePage === 'map') renderMap(await getMapRegions());
}

function populateRegionSelector(regions) {
    const selectors = ['headerRegionSelect', 'regionSelect', 'forecastRegionSelect'];
    const options = regions.map((region) => `<option value="${region.name}">${region.name}</option>`).join('');
    selectors.forEach((id) => {
        document.getElementById(id).innerHTML = options;
    });
    syncRegionSelection();
}

function renderForecastTimeline(region) {
    const weather = state.liveWeather?.region === state.selectedRegion ? state.liveWeather : null;
    const providerForecast = weather?.forecast || [];
    const modelForecast = region.forecast || [];
    const tabs = document.getElementById('forecastDayTabs');
    const outlook = document.getElementById('forecastOutlook');
    const information = document.getElementById('forecastInformation');
    const table = document.getElementById('forecastTimeline');
    document.getElementById('forecastRegionSelect').value = state.selectedRegion;

    if (!weather || providerForecast.length === 0) {
        tabs.innerHTML = '<button class="forecast-tab history-tab" type="button">History</button>';
        outlook.innerHTML = '<p class="forecast-empty">Live forecast is unavailable for this region.</p>';
        information.replaceChildren();
        table.innerHTML = '<p class="forecast-empty">Connect the weather provider to view the 10-day table.</p>';
        tabs.querySelector('.history-tab').addEventListener('click', () => setPage('history'));
        return;
    }

    state.forecastSelectedIndex = Math.min(state.forecastSelectedIndex, providerForecast.length - 1);
    const selected = providerForecast[state.forecastSelectedIndex];
    const iconUrl = (icon) => icon?.startsWith('//') ? `https:${icon}` : icon;
    const dayLabel = (day, index) => index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`));

    tabs.innerHTML = `${providerForecast.map((day, index) => `
            <button class="forecast-tab ${index === state.forecastSelectedIndex ? 'active' : ''}" type="button" role="tab" aria-selected="${index === state.forecastSelectedIndex}" data-day="${index}">
                <strong>${dayLabel(day, index)}</strong><small>${day.date.slice(5)}</small>
            </button>
        `).join('')}<button class="forecast-tab history-tab" type="button">History</button>`;
    tabs.querySelectorAll('[data-day]').forEach((button) => {
        button.addEventListener('click', () => {
            state.forecastSelectedIndex = Number(button.dataset.day);
            renderForecastTimeline(region);
        });
    });
    tabs.querySelector('.history-tab').addEventListener('click', () => {
        setPage('history');
        loadWeatherHistory();
    });

    const current = weather.current;
    document.getElementById('forecastSelectedDate').textContent = selected.date;
    outlook.innerHTML = `
            <div class="forecast-current-card">
                <img class="forecast-current-icon" src="${iconUrl(selected.conditionIcon)}" alt="${selected.condition}" />
                <div class="forecast-current-condition"><strong>${selected.condition}</strong><span>${weather.location.name}</span></div>
                <div class="forecast-current-details"><span>Wind ${selected.maxWindKph} km/h</span><span>Rain ${selected.precipitationMm.toFixed(2)} mm</span><span>Pressure ${current.pressureMb} mb</span></div>
                <div class="forecast-current-temperature">${selected.meanTemperatureC} °C<small>High ${selected.maxTemperatureC}° · Low ${selected.minTemperatureC}°</small></div>
            </div>
            <div class="forecast-five-day">${providerForecast.slice(0, 5).map((day, index) => `
                <button class="forecast-mini-day ${index === state.forecastSelectedIndex ? 'active' : ''}" type="button" data-day="${index}">
                    <span>${dayLabel(day, index)}</span><img src="${iconUrl(day.conditionIcon)}" alt="" /><strong>${day.maxTemperatureC}°</strong><small>${day.minTemperatureC}°</small>
                </button>
            `).join('')}</div>
        `;
    outlook.querySelectorAll('.forecast-mini-day').forEach((button) => {
        button.addEventListener('click', () => {
            state.forecastSelectedIndex = Number(button.dataset.day);
            renderForecastTimeline(region);
        });
    });

    const timeZone = weather.location.timezone;
    const zoneParts = new Intl.DateTimeFormat('en-IN', { timeZone, timeZoneName: 'longOffset' }).formatToParts(new Date());
    const zoneOffset = zoneParts.find((part) => part.type === 'timeZoneName')?.value.replace('GMT', 'UTC');
    const zoneName = new Intl.DateTimeFormat('en-IN', { timeZone, timeZoneName: 'long' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value;
    const informationRows = [
        ['Country', weather.location.country],
        ['Region', weather.region],
        ['Lat / Lon', `${weather.location.latitude}, ${weather.location.longitude}`],
        ['Current time', weather.location.localtime],
        ['Time zone ID', weather.location.timezone],
        ['Time zone', `${zoneOffset} · ${zoneName}`],
        ['Sunrise', selected.sunrise],
        ['Sunset', selected.sunset]
    ];
    information.innerHTML = informationRows.map(([label, value]) => `<div class="forecast-info-row"><dt>${label}</dt><dd>${value ?? '—'}</dd></div>`).join('');

    const rows = [
        { label: 'Weather', className: 'weather-row', value: (day) => `<img src="${iconUrl(day.conditionIcon)}" alt="${day.condition}" title="${day.condition}" /><span>${day.condition}</span>` },
        { label: 'Max', className: 'max-row', value: (day) => `${day.maxTemperatureC} °C` },
        { label: 'Min', className: 'min-row', value: (day) => `${day.minTemperatureC} °C` },
        { label: 'Wind', className: 'wind-row', value: (day) => `${day.maxWindKph} km/h` },
        { label: 'Precip', value: (day) => `${day.precipitationMm.toFixed(2)} mm` },
        { label: 'Humidity', value: (day) => `${day.humidity}%` },
        { label: 'Sunrise', value: (day) => day.sunrise },
        { label: 'Sunset', value: (day) => day.sunset },
        { label: 'Moonrise', value: (day) => day.moonrise },
        { label: 'Moonset', value: (day) => day.moonset },
        { label: 'Moon phase', value: (day) => day.moonPhase },
        { label: 'Illumination', value: (day) => `${day.moonIllumination}%` },
        { label: 'UV', value: (day) => day.uv },
        {
            label: 'Bust probability', className: 'bust-row', value: (_, index) => {
                const probability = modelForecast[index]?.bustProbability;
                return probability === undefined ? '—' : `<span class="risk-pill ${riskClass(probability * 100)}">${Math.round(probability * 100)}%</span>`;
            }
        }
    ];
    table.innerHTML = `
            <table class="forecast-weather-table">
                <thead><tr><th scope="col"></th>${providerForecast.map((day, index) => `<th scope="col"><span>${dayLabel(day, index)}</span><small>${day.date.slice(5)}</small></th>`).join('')}</tr></thead>
                <tbody>${rows.map((row) => `<tr class="${row.className || ''}"><th scope="row">${row.label}</th>${providerForecast.map((day, index) => `<td>${row.value(day, index)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        `;
}

function renderVariableCards(region) {
    const day = (region.forecast || []).find((item) => item.lead === state.selectedDay) || region.forecast?.[0];
    const variables = ['Rainfall', 'Temperature', 'Wind speed', 'Wind direction', 'Pressure', 'Humidity', 'Geopotential height'];
    document.getElementById('variableCards').innerHTML = variables.map((label) => {
        const metrics = forecastMetrics(day, label);
        const confidence = Math.round(day.confidence * 100);
        return `
    <div class="variable-card">
      <div class="v-title">
        <strong>${label}</strong>
        <span class="risk-pill ${riskClass(confidence)}">${confidence}%</span>
      </div>
      <div class="value">${metrics.forecast} ${metrics.unit}</div>
      <small>Expected error ${metrics.error} ${metrics.unit} · Confidence ${confidence}%</small>
    </div>
  `;
    }).join('');
}

function renderExplainability(region, explanation) {
    const factors = explanation?.factors || [];
    const reasons = factors.slice(0, 4).map((factor) => `<li>${factor.label} (${Math.round(factor.value * 100)}% contribution)</li>`).join('');
    document.getElementById('reasonList').innerHTML = reasons;
    document.getElementById('explainabilityBlock').innerHTML = `
    <div class="summary-box">
      <strong>Operational summary</strong>
      <p>${explanation?.summary || `${region.region} remains in a ${region.summary?.risk || 'High'} risk regime.`}</p>
    </div>
    <div class="factor-list">
      ${factors.map((factor) => `
        <div class="factor-row">
          <span>${factor.label}</span>
          <div class="factor-bar"><span class="factor-fill" style="width:${factor.value * 100}%"></span></div>
          <strong>${Math.round(factor.value * 100)}%</strong>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderAlertsPage() {
    const alerts = await fetchJson('/api/v1/alerts');
    const regionAlerts = alerts.filter((alert) => alert.region === state.selectedRegion);
    document.getElementById('alertsHeading').textContent = `Operational alerts · ${state.selectedRegion}`;
    document.getElementById('alertsList').innerHTML = regionAlerts.length ? regionAlerts.map((alert) => `
    <div class="alert-item-card">
      <div class="alert-top">
        <strong>${alert.region}</strong>
        <span class="severity-badge ${riskClass(alert.probability)}">${alert.severity}</span>
      </div>
      <div class="inline-tags">
        <span>${alert.eventType}</span>
        <span>Lead ${alert.leadTime}</span>
      </div>
      <p>${alert.explanation}</p>
    </div>
    `).join('') : `<p class="empty-state">No model alerts are currently listed for ${state.selectedRegion}.</p>`;
}

async function renderHistoryPage() {
    const filter = document.getElementById('eventTypeFilter').value;
    const events = await fetchJson(`/api/v1/events?type=${encodeURIComponent(filter === 'all' ? 'all' : filter)}`);
    const regionEvents = events.filter((event) => event.region === state.selectedRegion);
    document.getElementById('historyArchiveHeading').textContent = `Forecast-bust case archive · ${state.selectedRegion}`;
    document.getElementById('historyList').innerHTML = regionEvents.length ? regionEvents.map((event) => `
    <div class="history-item">
      <div class="alert-top">
        <strong>${event.region}</strong>
        <span class="severity-badge ${riskClass(event.similarity)}">${event.risk}</span>
      </div>
      <div class="inline-tags">
        <span>${event.type}</span>
        <span>${event.date}</span>
        <span>Similarity ${event.similarity}%</span>
      </div>
      <div>Forecast ${event.forecast} mm vs Observed ${event.observed} mm · Error ${event.error} mm</div>
    </div>
    `).join('') : `<p class="empty-state">No archived model cases are listed for ${state.selectedRegion}.</p>`;
}

function populateWeatherHistoryRegions(regions) {
    const select = document.getElementById('historyRegionSelect');
    select.innerHTML = regions.map((region) => `<option value="${region.name}">${region.name}</option>`).join('');
    syncRegionSelection();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    document.getElementById('historyDate').value = yesterday;
}

async function loadWeatherHistory() {
    const region = document.getElementById('historyRegionSelect').value;
    const date = document.getElementById('historyDate').value;
    const districtQuery = state.selectedDistrict ? `&district=${encodeURIComponent(state.selectedDistrict)}` : '';
    const message = document.getElementById('weatherHistoryMessage');
    message.textContent = 'Loading historical observations…';
    document.getElementById('weatherHistoryRows').replaceChildren();
    document.getElementById('weatherHistorySummary').replaceChildren();
    try {
        const history = await fetchJson(`/api/v1/weather/history?region=${encodeURIComponent(region)}${districtQuery}&date=${encodeURIComponent(date)}`);
        const summaryItems = [
            ['Max temperature', `${history.summary.maxTemperatureC} °C`],
            ['Min temperature', `${history.summary.minTemperatureC} °C`],
            ['Rainfall', `${history.summary.precipitationMm} mm`],
            ['Max wind', `${history.summary.maxWindKph} km/h`],
            ['Humidity', `${history.summary.humidity}%`]
        ];
        document.getElementById('weatherHistorySummary').innerHTML = summaryItems.map(([label, value]) => `
          <div class="history-summary-item"><span>${label}</span><strong>${value}</strong></div>
        `).join('');
        document.getElementById('weatherHistoryRows').innerHTML = history.hours.map((hour) => `
          <tr><td>${hour.time.slice(-5)}</td><td>${hour.temperatureC} °C</td><td>${hour.precipitationMm} mm</td><td>${hour.windKph} km/h</td><td>${hour.windDirection}</td><td>${hour.pressureMb} mb</td><td>${hour.humidity}%</td></tr>
        `).join('');
        message.textContent = `${history.location}, ${history.region} · ${history.date} · hourly observed weather`;
    } catch (error) {
        message.textContent = error.message;
    }
}

async function renderSystemPage() {
    const status = await fetchJson('/api/v1/status');
    const items = [
        { label: 'NWP data status', value: status.dataStatus.nwp },
        { label: 'Observation data status', value: status.dataStatus.observations },
        { label: 'ML model status', value: status.dataStatus.model },
        { label: 'Last update time', value: state.lastUpdated ? new Date(state.lastUpdated).toLocaleString('en-IN', { timeZone: 'UTC', timeZoneName: 'short' }) : 'Awaiting data' }
    ];
    document.getElementById('systemStatus').innerHTML = items.map((item) => `
    <div class="status-item">
      <span>${item.label}</span>
      <span class="status-tag">${item.value}</span>
    </div>
  `).join('');

    document.getElementById('apiList').innerHTML = status.prototypeApi.map((endpoint) => `
    <div class="api-item">
      <code>${endpoint}</code>
      <button>Try it</button>
    </div>
  `).join('');
    document.querySelectorAll('.api-item button').forEach((button) => {
        button.addEventListener('click', () => {
            const endpoint = button.parentElement.querySelector('code').textContent;
            const url = endpoint.replace('{name}', encodeURIComponent(state.selectedRegion));
            window.open(url, '_blank', 'noopener');
        });
    });
}

async function loadMapGeometry() {
    const mapModule = await import('/vendor/india-map/index.js');
    state.mapGeometry = mapModule.default.locations;
    state.mapViewBox = mapModule.default.viewBox;
    document.getElementById('indiaMap').setAttribute('viewBox', state.mapViewBox);
}

function renderDiagnostics() {
    const metrics = [
        { label: 'Brier score', value: '0.19' },
        { label: 'POD', value: '0.82' },
        { label: 'FAR', value: '0.24' },
        { label: 'Skill vs climatology', value: '+12%' },
        { label: 'Reliability', value: 'Good' }
    ];
    document.getElementById('diagnosticMetrics').innerHTML = metrics.map((metric) => `
    <div class="metric-box">
      <label>${metric.label}</label>
      <strong>${metric.value}</strong>
    </div>
  `).join('');
}

async function handleCommandSubmit() {
    const input = document.getElementById('aiCommandInput');
    const parsed = parseCommand(input.value);
    state.selectedRegion = parsed.region;
    state.selectedDay = parsed.day;
    state.selectedVariable = parsed.variable;
    if (parsed.hasRegion) {
        state.mapZoomed = true;
        setPage('map');
        document.getElementById('backToIndiaBtn').classList.remove('hidden');
    }
    updateContextBar();
    document.getElementById('leadSelect').value = `Day ${state.selectedDay}`;
    document.getElementById('variableSelect').value = state.selectedVariable;

    const [region, regions, alerts, mapRegions, explanation] = await Promise.all([
        fetchJson(`/api/v1/region/${encodeURIComponent(state.selectedRegion)}`),
        fetchJson('/api/v1/regions'),
        fetchJson('/api/v1/alerts'),
        getMapRegions(),
        getExplainability()
    ]);

    state.allRegions = regions;
    renderMap(mapRegions);
    renderOverview(regions, alerts);
    renderRegionAnalysis(region, explanation);
    renderForecastTimeline(region);
    renderVariableCards(region);
    renderExplainability(region, explanation);
    await loadLiveWeather(state.selectedRegion);
    input.value = '';
}

function initControls() {
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', () => {
            setPage(item.dataset.page);
            if (item.dataset.page === 'history') {
                renderHistoryPage();
                loadWeatherHistory();
            }
        });
    });

    document.getElementById('openForecastMap').addEventListener('click', () => setPage('map'));
    document.getElementById('loadHistoryButton').addEventListener('click', loadWeatherHistory);

    document.getElementById('headerRegionSelect').addEventListener('change', async (event) => {
        state.selectedDay = 1;
        state.forecastSelectedIndex = 0;
        await loadRegionData(event.target.value);
        if (state.availableDistricts.length) setPage('region');
    });

    document.getElementById('regionSelect').addEventListener('change', async (event) => {
        state.selectedDay = 1;
        await focusRegion(event.target.value);
    });

    document.getElementById('districtList').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-district]');
        if (button) await selectDistrict(button.dataset.district);
    });

    document.getElementById('mapDistrictList').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-district]');
        if (button) await selectDistrict(button.dataset.district);
    });

    document.getElementById('historyRegionSelect').addEventListener('change', async (event) => {
        state.selectedDay = 1;
        await loadRegionData(event.target.value);
        if (state.availableDistricts.length) setPage('region');
        else await loadWeatherHistory();
    });

    document.getElementById('regionVariableSelect').addEventListener('change', (event) => {
        state.selectedVariable = event.target.value;
        document.getElementById('variableSelect').value = state.selectedVariable;
        updateContextBar();
        if (state.regionData) {
            renderRegionAnalysis(state.regionData);
            renderForecastTimeline(state.regionData);
            renderVariableCards(state.regionData);
        }
    });

    document.getElementById('forecastRegionSelect').addEventListener('change', async (event) => {
        state.selectedDay = 1;
        state.forecastSelectedIndex = 0;
        const activePage = state.activePage;
        await loadRegionData(event.target.value);
        setPage(state.availableDistricts.length ? 'region' : activePage);
    });

    document.getElementById('openRegionMap').addEventListener('click', async () => {
        setPage('map');
        state.mapZoomed = true;
        document.getElementById('backToIndiaBtn').classList.remove('hidden');
        renderMap(await getMapRegions());
    });

    document.getElementById('regionForecastRows').addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-region-day]');
        if (row) selectRegionLead(row.dataset.regionDay);
    });

    document.getElementById('errorChart').addEventListener('click', (event) => {
        const chartDay = event.target.closest('[data-chart-day]');
        if (chartDay) selectRegionLead(chartDay.dataset.chartDay);
    });

    document.getElementById('errorChart').addEventListener('keydown', (event) => {
        const chartDay = event.target.closest('[data-chart-day]');
        if (chartDay && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            selectRegionLead(chartDay.dataset.chartDay);
        }
    });

    document.getElementById('runCommandBtn').addEventListener('click', handleCommandSubmit);

    document.getElementById('leadSelect').addEventListener('change', async (event) => {
        state.selectedDay = Number(event.target.value.replace(/\D+/g, ''));
        updateContextBar();
        const [region, mapRegions, explanation] = await Promise.all([
            fetchJson(`/api/v1/region/${encodeURIComponent(state.selectedRegion)}`),
            getMapRegions(),
            getExplainability()
        ]);
        renderMap(mapRegions);
        renderRegionAnalysis(region, explanation);
        renderForecastTimeline(region);
        renderVariableCards(region);
        renderExplainability(region, explanation);
    });

    document.getElementById('variableSelect').addEventListener('change', async (event) => {
        state.selectedVariable = event.target.value;
        updateContextBar();
        const [region, mapRegions, explanation] = await Promise.all([
            fetchJson(`/api/v1/region/${encodeURIComponent(state.selectedRegion)}`),
            getMapRegions(),
            getExplainability()
        ]);
        renderMap(mapRegions);
        renderRegionAnalysis(region, explanation);
        renderForecastTimeline(region);
        renderVariableCards(region);
        renderExplainability(region, explanation);
    });

    document.getElementById('metricSelect').addEventListener('change', async (event) => {
        state.mapMetric = event.target.value;
        renderMap(await getMapRegions());
    });

    document.getElementById('eventTypeFilter').addEventListener('change', renderHistoryPage);

    document.getElementById('backToIndiaBtn').addEventListener('click', async () => {
        state.mapZoomed = false;
        document.getElementById('backToIndiaBtn').classList.add('hidden');
        const regions = await getMapRegions();
        renderMap(regions);
    });

    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            document.getElementById('aiCommandInput').value = chip.textContent;
            handleCommandSubmit();
        });
    });
}

async function initDashboard() {
    setPage('overview');
    updateContextBar();
    updateHeaderClock();
    window.setInterval(updateHeaderClock, 60000);
    await loadMapGeometry();

    const [regions, region, alerts, mapRegions, explanation] = await Promise.all([
        fetchJson('/api/v1/regions'),
        fetchJson(`/api/v1/region/${encodeURIComponent(state.selectedRegion)}`),
        fetchJson('/api/v1/alerts'),
        getMapRegions(),
        getExplainability()
    ]);

    state.allRegions = regions;
    renderOverview(regions, alerts);
    populateWeatherHistoryRegions(regions);
    populateRegionSelector(regions);
    renderMap(mapRegions);
    renderRegionAnalysis(region, explanation);
    renderForecastTimeline(region);
    renderVariableCards(region);
    renderExplainability(region, explanation);
    renderDiagnostics();
    renderAlertsPage();
    renderHistoryPage();
    renderSystemPage();
    initControls();
    loadLiveWeather(state.selectedRegion);
}

window.addEventListener('DOMContentLoaded', initDashboard);
