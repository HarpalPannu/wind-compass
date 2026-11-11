class WindCompass extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._currentAngle = null;
    this._initialized = false;
  }

  setConfig(config) {
    this._config = {
      title: 'Wind & Direction',
      direction_entity: 'sensor.openweathermap_wind_direction',
      speed_entity: 'sensor.openweathermap_wind_speed',
      gust_entity: 'sensor.openweathermap_wind_gust_speed',
      ...config,
    };
    if (this._initialized) {
      this._update();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._renderSkeleton();
      this._initialized = true;
    }
    this._update();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return {
      columns: 12,
      min_columns: 6,
      rows: 'auto',
    };
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  _getBeaufort(kmh, isDark = true) {
    if (isDark) {
      if (kmh < 1) return { bft: 0, label: 'Calm', color: '#38bdf8' };
      if (kmh < 6) return { bft: 1, label: 'Light Air', color: '#2dd4bf' };
      if (kmh < 12) return { bft: 2, label: 'Light Breeze', color: '#34d399' };
      if (kmh < 20) return { bft: 3, label: 'Gentle Breeze', color: '#10b981' };
      if (kmh < 29) return { bft: 4, label: 'Moderate', color: '#a3e635' };
      if (kmh < 39) return { bft: 5, label: 'Fresh Breeze', color: '#facc15' };
      if (kmh < 50) return { bft: 6, label: 'Strong Breeze', color: '#fb923c' };
      if (kmh < 62) return { bft: 7, label: 'Near Gale', color: '#f97316' };
      if (kmh < 75) return { bft: 8, label: 'Gale', color: '#ef4444' };
      return { bft: 9, label: 'Storm Force', color: '#ec4899' };
    } else {
      if (kmh < 1) return { bft: 0, label: 'Calm', color: '#0284c7' };
      if (kmh < 6) return { bft: 1, label: 'Light Air', color: '#0d9488' };
      if (kmh < 12) return { bft: 2, label: 'Light Breeze', color: '#059669' };
      if (kmh < 20) return { bft: 3, label: 'Gentle Breeze', color: '#047857' };
      if (kmh < 29) return { bft: 4, label: 'Moderate', color: '#65a30d' };
      if (kmh < 39) return { bft: 5, label: 'Fresh Breeze', color: '#d97706' };
      if (kmh < 50) return { bft: 6, label: 'Strong Breeze', color: '#ea580c' };
      if (kmh < 62) return { bft: 7, label: 'Near Gale', color: '#c2410c' };
      if (kmh < 75) return { bft: 8, label: 'Gale', color: '#dc2626' };
      return { bft: 9, label: 'Storm Force', color: '#be185d' };
    }
  }

  _getCardinal16(deg) {
    const dirs = [
      'N', 'NNE', 'NE', 'ENE',
      'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW',
      'W', 'WNW', 'NW', 'NNW',
    ];
    const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
    return dirs[idx];
  }

  _getAngleRgb(deg) {
    const stops = [
      { d: 0, c: [255, 69, 58] },
      { d: 90, c: [251, 191, 36] },
      { d: 180, c: [56, 189, 248] },
      { d: 270, c: [52, 211, 153] },
      { d: 360, c: [255, 69, 58] },
    ];
    const norm = ((deg % 360) + 360) % 360;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (norm >= a.d && norm <= b.d) {
        const t = (norm - a.d) / (b.d - a.d);
        const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * t);
        const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * t);
        const bl = Math.round(a.c[2] + (b.c[2] - a.c[2]) * t);
        return `${r}, ${g}, ${bl}`;
      }
    }
    return '255, 255, 255';
  }

  _buildAppleDialSvg() {
    let svg = '';
    const cx = 120;
    const cy = 120;

    for (let i = 0; i < 360; i += 3) {
      if (i === 0) continue;
      const isCardinal = i % 90 === 0;
      const isThirty = !isCardinal && i % 30 === 0;
      const isFifteen = !isCardinal && !isThirty && i % 15 === 0;

      const rOuter = 110;
      const rInner = isCardinal ? 93 : isThirty ? 96 : isFifteen ? 98.5 : 101;
      const strokeWidth = isCardinal ? 3.2 : isThirty ? 2.4 : isFifteen ? 1.8 : 1.35;
      const opacity = isCardinal ? 1 : isThirty ? 0.85 : isFifteen ? 0.65 : 0.45;
      const rgb = this._getAngleRgb(i);

      const rad = ((i - 90) * Math.PI) / 180;
      const x1 = (cx + rOuter * Math.cos(rad)).toFixed(2);
      const y1 = (cy + rOuter * Math.sin(rad)).toFixed(2);
      const x2 = (cx + rInner * Math.cos(rad)).toFixed(2);
      const y2 = (cy + rInner * Math.sin(rad)).toFixed(2);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(${rgb}, ${opacity})" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
    }

    const interLabels = [
      { deg: 45, text: 'NE', color: '#fb923c' },
      { deg: 135, text: 'SE', color: '#22d3ee' },
      { deg: 225, text: 'SW', color: '#2dd4bf' },
      { deg: 315, text: 'NW', color: '#f87171' },
    ];
    for (const item of interLabels) {
      const rad = ((item.deg - 90) * Math.PI) / 180;
      const r = 79;
      const x = (cx + r * Math.cos(rad)).toFixed(2);
      const y = (cy + r * Math.sin(rad)).toFixed(2);
      svg += `<text x="${x}" y="${y}" fill="${item.color}" opacity="0.7" font-size="9.5" font-weight="700" text-anchor="middle" dominant-baseline="central" letter-spacing="0.4">${item.text}</text>`;
    }

    svg += `<polygon points="120,8 114,21 126,21" fill="#ff453a"/>`;

    return svg;
  }

  _renderSkeleton() {
    const dialSvg = this._buildAppleDialSvg();
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --accent: #34d399;
          --card-bg: var(--ha-card-background, var(--card-background-color, #1c1c1e));
          --card-border: color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.1));
          --card-glow: radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 72%);
          --text-primary: var(--primary-text-color, rgba(255, 255, 255, 0.88));
          --text-secondary: var(--secondary-text-color, rgba(255, 255, 255, 0.55));
          --title-color: rgba(255, 255, 255, 0.78);
          --badge-bg: color-mix(in srgb, var(--accent) 14%, rgba(255, 255, 255, 0.04));
          --badge-border: color-mix(in srgb, var(--accent) 32%, transparent);
          --badge-color: var(--accent);
          --box-bg: rgba(255, 255, 255, 0.04);
          --box-bg-hover: rgba(255, 255, 255, 0.075);
          --box-border: rgba(255, 255, 255, 0.08);
          --box-border-hover: rgba(255, 255, 255, 0.2);
          --metric-val-color: #ffffff;
          --metric-unit-color: rgba(255, 255, 255, 0.6);
          --metric-sub-color: rgba(255, 255, 255, 0.52);
          --speed-color: #38bdf8;
          --gust-color: #fb923c;
          --dir-color: var(--accent);
          --dial-stop-0: rgba(56, 189, 248, 0.06);
          --dial-stop-65: rgba(15, 23, 42, 0.5);
          --dial-stop-100: rgba(15, 23, 42, 0.92);
          --dial-outer-stroke: url(#ringGrad);
          --dial-dashed-ring: rgba(255, 255, 255, 0.08);
          --hub-fill: rgba(20, 22, 28, 0.94);
          --hub-stroke: url(#ringGrad);
          --hub-cardinal-color: #ffffff;
          --needle-orb-fill: #18181b;
          --needle-south-color: #38bdf8;
          --arrow-glow-color: rgba(0, 0, 0, 0.65);
          --cardinal-n: #ff453a;
          --cardinal-e: #fbbf24;
          --cardinal-s: #38bdf8;
          --cardinal-w: #34d399;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
        }

        :host([light-mode]),
        :host-context([data-theme="light"]),
        :host-context(html.light) {
          --card-bg: var(--ha-card-background, var(--card-background-color, #ffffff));
          --card-border: var(--ha-card-border-color, color-mix(in srgb, var(--accent) 30%, rgba(0, 0, 0, 0.09)));
          --card-glow: radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%);
          --text-primary: var(--primary-text-color, #0f172a);
          --text-secondary: var(--secondary-text-color, #64748b);
          --title-color: #0f172a;
          --badge-bg: color-mix(in srgb, var(--accent) 14%, #ffffff);
          --badge-border: color-mix(in srgb, var(--accent) 35%, rgba(0, 0, 0, 0.1));
          --badge-color: var(--accent);
          --box-bg: rgba(0, 0, 0, 0.025);
          --box-bg-hover: rgba(0, 0, 0, 0.05);
          --box-border: rgba(0, 0, 0, 0.08);
          --box-border-hover: rgba(0, 0, 0, 0.16);
          --metric-val-color: #0f172a;
          --metric-unit-color: #64748b;
          --metric-sub-color: #64748b;
          --speed-color: #0284c7;
          --gust-color: #ea580c;
          --dir-color: var(--accent);
          --dial-stop-0: rgba(241, 245, 249, 0.6);
          --dial-stop-65: rgba(248, 250, 252, 0.85);
          --dial-stop-100: #f1f5f9;
          --dial-outer-stroke: color-mix(in srgb, var(--accent) 30%, rgba(0, 0, 0, 0.12));
          --dial-dashed-ring: rgba(0, 0, 0, 0.09);
          --hub-fill: #ffffff;
          --hub-stroke: color-mix(in srgb, var(--accent) 35%, rgba(0, 0, 0, 0.12));
          --hub-cardinal-color: #0f172a;
          --needle-orb-fill: #ffffff;
          --needle-south-color: #0284c7;
          --arrow-glow-color: rgba(0, 0, 0, 0.16);
          --cardinal-n: #dc2626;
          --cardinal-e: #d97706;
          --cardinal-s: #0284c7;
          --cardinal-w: #059669;
        }

        @media (prefers-color-scheme: light) {
          :host(:not([light-mode="false"])) {
            --card-bg: var(--ha-card-background, var(--card-background-color, #ffffff));
            --card-border: var(--ha-card-border-color, color-mix(in srgb, var(--accent) 30%, rgba(0, 0, 0, 0.09)));
            --card-glow: radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%);
            --text-primary: var(--primary-text-color, #0f172a);
            --text-secondary: var(--secondary-text-color, #64748b);
            --title-color: #0f172a;
            --badge-bg: color-mix(in srgb, var(--accent) 14%, #ffffff);
            --badge-border: color-mix(in srgb, var(--accent) 35%, rgba(0, 0, 0, 0.1));
            --badge-color: var(--accent);
            --box-bg: rgba(0, 0, 0, 0.025);
            --box-bg-hover: rgba(0, 0, 0, 0.05);
            --box-border: rgba(0, 0, 0, 0.08);
            --box-border-hover: rgba(0, 0, 0, 0.16);
            --metric-val-color: #0f172a;
            --metric-unit-color: #64748b;
            --metric-sub-color: #64748b;
            --speed-color: #0284c7;
            --gust-color: #ea580c;
            --dir-color: var(--accent);
            --dial-stop-0: rgba(241, 245, 249, 0.6);
            --dial-stop-65: rgba(248, 250, 252, 0.85);
            --dial-stop-100: #f1f5f9;
            --dial-outer-stroke: color-mix(in srgb, var(--accent) 30%, rgba(0, 0, 0, 0.12));
            --dial-dashed-ring: rgba(0, 0, 0, 0.09);
            --hub-fill: #ffffff;
            --hub-stroke: color-mix(in srgb, var(--accent) 35%, rgba(0, 0, 0, 0.12));
            --hub-cardinal-color: #0f172a;
            --needle-orb-fill: #ffffff;
            --needle-south-color: #0284c7;
            --arrow-glow-color: rgba(0, 0, 0, 0.16);
            --cardinal-n: #dc2626;
            --cardinal-e: #d97706;
            --cardinal-s: #0284c7;
            --cardinal-w: #059669;
          }
        }

        ha-card {
          position: relative;
          overflow: hidden;
          padding: 14px 14px 15px 14px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--ha-card-border-radius, 18px);
          box-sizing: border-box;
          box-shadow: var(--ha-card-box-shadow, none);
        }
        ha-card::before {
          content: '';
          position: absolute;
          top: -40px;
          left: -20px;
          width: 240px;
          height: 240px;
          background: var(--card-glow);
          pointer-events: none;
          z-index: 0;
        }
        .header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
          padding: 0 2px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
        }
        .header-left ha-icon {
          --mdc-icon-size: 17px;
          color: var(--accent);
          flex-shrink: 0;
        }
        .title {
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--title-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .subtitle-badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--badge-color);
          background: var(--badge-bg);
          border: 1px solid var(--badge-border);
          padding: 2px 9px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .main-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 122px;
          gap: 10px;
          align-items: center;
        }
        .compass-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }
        .compass-wrap {
          position: relative;
          width: 100%;
          max-width: 212px;
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          user-select: none;
        }
        .compass-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
          display: block;
        }
        .needle-group {
          transform-origin: 120px 120px;
          transition: transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .metrics-col {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 7px;
          min-width: 0;
          height: 100%;
        }
        .metric-box {
          background: var(--box-bg);
          border: 1px solid var(--box-border);
          border-radius: 12px;
          padding: 8px 10px;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
          min-width: 0;
        }
        .metric-box.speed {
          border-left: 3px solid var(--speed-color);
        }
        .metric-box.gust {
          border-left: 3px solid var(--gust-color);
        }
        .metric-box.dir {
          border-left: 3px solid var(--dir-color);
        }
        .metric-box:hover {
          background: var(--box-bg-hover);
          border-color: var(--box-border-hover);
          transform: translateY(-1px);
        }
        .metric-label {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
          margin-bottom: 2px;
          white-space: nowrap;
        }
        .metric-box.speed .metric-label { color: var(--speed-color); }
        .metric-box.gust .metric-label { color: var(--gust-color); }
        .metric-box.dir .metric-label { color: var(--dir-color); }
        .metric-val-row {
          display: flex;
          align-items: baseline;
          gap: 3px;
        }
        .metric-val {
          font-size: 16.5px;
          font-weight: 700;
          color: var(--metric-val-color);
          line-height: 1.15;
          letter-spacing: -0.2px;
          white-space: nowrap;
        }
        .metric-unit {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--metric-unit-color);
        }
        .metric-sub {
          font-size: 10px;
          font-weight: 500;
          color: var(--metric-sub-color);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
      <ha-card>
        <div class="header">
          <div class="header-left">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div class="title" id="card-title">WIND</div>
          </div>
          <div class="subtitle-badge" id="card-subtitle">Calm</div>
        </div>

        <div class="main-row">
          <div class="compass-cell">
            <div class="compass-wrap" id="compass-click" title="Click for Wind Direction history">
              <svg class="compass-svg" viewBox="0 0 240 240">
                <defs>
                  <radialGradient id="appleDialBg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="var(--dial-stop-0)"/>
                    <stop offset="65%" stop-color="var(--dial-stop-65)"/>
                    <stop offset="100%" stop-color="var(--dial-stop-100)"/>
                  </radialGradient>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ff453a" stop-opacity="0.5"/>
                    <stop offset="33%" stop-color="var(--cardinal-e)" stop-opacity="0.4"/>
                    <stop offset="66%" stop-color="var(--cardinal-s)" stop-opacity="0.5"/>
                    <stop offset="100%" stop-color="var(--cardinal-w)" stop-opacity="0.5"/>
                  </linearGradient>
                  <filter id="arrowGlow" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="var(--arrow-glow-color)"/>
                  </filter>
                </defs>

                <circle cx="120" cy="120" r="112" fill="url(#appleDialBg)" stroke="var(--dial-outer-stroke)" stroke-width="1.5"/>
                <circle cx="120" cy="120" r="60" fill="none" stroke="var(--dial-dashed-ring)" stroke-width="1" stroke-dasharray="3 3"/>

                <g>${dialSvg}</g>

                <text x="120" y="39" fill="var(--cardinal-n)" font-size="14.5" font-weight="800" text-anchor="middle" dominant-baseline="central">N</text>
                <text x="201" y="120" fill="var(--cardinal-e)" font-size="14" font-weight="800" text-anchor="middle" dominant-baseline="central">E</text>
                <text x="120" y="201" fill="var(--cardinal-s)" font-size="14" font-weight="800" text-anchor="middle" dominant-baseline="central">S</text>
                <text x="39" y="120" fill="var(--cardinal-w)" font-size="14" font-weight="800" text-anchor="middle" dominant-baseline="central">W</text>

                <g class="needle-group" id="needle-group" filter="url(#arrowGlow)">
                  <path d="M 120 120 L 96 22 A 100 100 0 0 1 144 22 Z" fill="var(--accent)" opacity="0.18"/>
                  <line x1="120" y1="22" x2="120" y2="66" stroke="var(--accent)" stroke-width="3.6" stroke-linecap="round"/>
                  <circle cx="120" cy="17" r="5" fill="var(--needle-orb-fill)" stroke="var(--accent)" stroke-width="3"/>
                  <line x1="120" y1="174" x2="120" y2="213" stroke="var(--needle-south-color)" stroke-width="3.6" stroke-linecap="round"/>
                  <polygon points="120,225 111,207 120,211 129,207" fill="var(--needle-south-color)"/>
                </g>

                <circle cx="120" cy="120" r="46" fill="var(--hub-fill)" stroke="var(--hub-stroke)" stroke-width="1.8"/>
                <text x="120" y="113" id="hub-cardinal" fill="var(--hub-cardinal-color)" font-size="22" font-weight="800" text-anchor="middle" dominant-baseline="central">---</text>
                <text x="120" y="133" id="hub-deg" fill="var(--accent)" font-size="11.5" font-weight="700" text-anchor="middle" dominant-baseline="central">---°</text>
              </svg>
            </div>
          </div>

          <div class="metrics-col">
            <div class="metric-box speed" id="speed-click" title="Click for Wind Speed history">
              <div class="metric-label">Wind Speed</div>
              <div class="metric-val-row">
                <span class="metric-val" id="speed-val">--</span>
                <span class="metric-unit" id="speed-unit">km/h</span>
              </div>
              <div class="metric-sub" id="speed-sub">Steady flow</div>
            </div>

            <div class="metric-box gust" id="gust-click" title="Click for Wind Gust history">
              <div class="metric-label">Wind Gusts</div>
              <div class="metric-val-row">
                <span class="metric-val" id="gust-val">--</span>
                <span class="metric-unit" id="gust-unit">km/h</span>
              </div>
              <div class="metric-sub" id="gust-sub">Max bursts</div>
            </div>

            <div class="metric-box dir" id="dir-click" title="Click for Wind Direction history">
              <div class="metric-label">Direction</div>
              <div class="metric-val-row">
                <span class="metric-val" id="dir-deg">--°</span>
                <span class="metric-unit" id="dir-card">--</span>
              </div>
              <div class="metric-sub" id="dir-sub">Blowing → --</div>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById('compass-click').addEventListener('click', () => {
      this._openMoreInfo(this._config.direction_entity);
    });
    this.shadowRoot.getElementById('speed-click').addEventListener('click', () => {
      this._openMoreInfo(this._config.speed_entity);
    });
    this.shadowRoot.getElementById('gust-click').addEventListener('click', () => {
      this._openMoreInfo(this._config.gust_entity);
    });
    this.shadowRoot.getElementById('dir-click').addEventListener('click', () => {
      this._openMoreInfo(this._config.direction_entity);
    });
  }

  _update() {
    if (!this._hass || !this._config || !this._initialized) return;

    let isDark = true;
    if (this._config && this._config.theme_mode === 'light') {
      isDark = false;
    } else if (this._config && this._config.theme_mode === 'dark') {
      isDark = true;
    } else if (this._hass && this._hass.themes && typeof this._hass.themes.darkMode === 'boolean') {
      isDark = this._hass.themes.darkMode;
    } else if (typeof window !== 'undefined' && window.matchMedia) {
      isDark = !window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (isDark) {
      this.removeAttribute('light-mode');
    } else {
      this.setAttribute('light-mode', '');
    }

    const dirState = this._hass.states[this._config.direction_entity];
    const speedState = this._hass.states[this._config.speed_entity];
    const gustState = this._hass.states[this._config.gust_entity];

    const rawDeg = dirState ? parseFloat(dirState.state) : 0;
    const deg = Number.isFinite(rawDeg) ? ((rawDeg % 360) + 360) % 360 : 0;
    const speed = speedState && Number.isFinite(parseFloat(speedState.state)) ? parseFloat(speedState.state) : 0;
    const gust = gustState && Number.isFinite(parseFloat(gustState.state)) ? parseFloat(gustState.state) : speed;
    const unit = (speedState && speedState.attributes.unit_of_measurement) || 'km/h';

    if (this._currentAngle === null) {
      this._currentAngle = deg;
    } else {
      let diff = ((deg - (this._currentAngle % 360) + 540) % 360) - 180;
      this._currentAngle += diff;
    }

    const bft = this._getBeaufort(speed, isDark);
    const cardinal = this._getCardinal16(deg);
    const toDeg = (deg + 180) % 360;
    const toCardinal = this._getCardinal16(toDeg);

    this.style.setProperty('--accent', bft.color);

    const root = this.shadowRoot;
    root.getElementById('card-title').textContent = this._config.title || 'WIND';
    root.getElementById('card-subtitle').textContent = bft.label;

    root.getElementById('needle-group').style.transform = `rotate(${this._currentAngle}deg)`;
    root.getElementById('hub-cardinal').textContent = cardinal;
    root.getElementById('hub-deg').textContent = `${Math.round(deg)}°`;

    root.getElementById('speed-val').textContent = speed.toFixed(1);
    root.getElementById('speed-unit').textContent = unit;
    root.getElementById('speed-sub').textContent = 'Steady flow';

    root.getElementById('gust-val').textContent = gust.toFixed(1);
    root.getElementById('gust-unit').textContent = unit;
    const delta = Math.max(0, gust - speed);
    root.getElementById('gust-sub').textContent = delta >= 1 ? `+${delta.toFixed(1)} ${unit} peak` : 'Minimal gusts';

    root.getElementById('dir-deg').textContent = `${Math.round(deg)}°`;
    root.getElementById('dir-card').textContent = cardinal;
    root.getElementById('dir-sub').textContent = `From ${cardinal} → ${toCardinal}`;
  }
}

if (!customElements.get('wind-compass')) {
  customElements.define('wind-compass', WindCompass);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'wind-compass')) {
  window.customCards.push({
    type: 'wind-compass',
    name: 'Wind Compass',
    description: 'Modern wind compass & telemetry card for Home Assistant',
  });
}
