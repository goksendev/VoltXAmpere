// ──────── AI ENGINE WITH TOOL USE (v8.0 Sprint 15) ────────
VXA.AI = (function() {
  'use strict';

  var API_URL = 'https://api.anthropic.com/v1/messages';
  var MODEL = 'claude-sonnet-4-20250514';
  var MAX_TOKENS = 2048;

  var _history = [];
  var MAX_HISTORY = 20;
  var _isProcessing = false;

  var _onMessage = null;
  var _onToolUse = null;
  var _onError = null;
  var _onProcessing = null;

  // ===== SYSTEM PROMPT =====
  function systemPrompt() {
    var lang = currentLang || 'en';
    var isEn = lang === 'en';

    return (isEn ?
      'You are VoltXAmpere\'s AI circuit assistant. You help users design, analyze, and learn about electronic circuits.' :
      'Sen VoltXAmpere devre simülatörünün AI asistanısın. Kullanıcıların devre tasarlamasına, analiz etmesine ve öğrenmesine yardım ediyorsun.'
    ) + '\n\n' +
    'CAPABILITIES:\n' +
    '- Create circuits from natural language descriptions using addComponent and addWire tools\n' +
    '- Analyze existing circuits with getCircuitState\n' +
    '- Run simulations and interpret results\n' +
    '- Calculate component values (Ohm\'s law, filter calculations, biasing)\n' +
    '- Detect and fix circuit errors\n' +
    '- Explain concepts for education\n\n' +
    'RULES:\n' +
    '- Always call getCircuitState FIRST to understand the current circuit before making changes\n' +
    '- Place components on a 20px grid (coordinates must be multiples of 20)\n' +
    '- Typical spacing: 80-160px between components\n' +
    '- Wire endpoints must match pin positions exactly\n' +
    '- Show calculations with formulas and results\n' +
    '- Suggest nearest E12/E24 standard values when applicable\n' +
    '- Respond in ' + (isEn ? 'English' : 'Turkish') + '\n' +
    '- After creating a circuit, briefly explain what was built and key values\n' +
    '- Use saveUndo before bulk changes so user can undo\n\n' +
    'COMPONENT TYPES (use exact string for type parameter):\n' +
    'resistor, capacitor, inductor, dcSource, acSource, diode, led, npn, pnp, nmos, pmos, opamp, switch, fuse, ground, zener, vccLabel, gndLabel, netLabel\n\n' +
    'PIN LAYOUT (pins indexed from 0):\n' +
    '- 2-pin (R,C,L,diode,LED,switch,fuse,dcSource,acSource): pins at dx=[-40,0] and [+40,0] relative to center. Pin 0=left, Pin 1=right when rot=0.\n' +
    '- ground/vcc/gnd labels: single pin at [0,-20] or [0,0].\n' +
    '- NPN/PNP: 3 pins. Pin layout depends on rotation.\n' +
    '- NMOS/PMOS: 3 pins.\n' +
    '- Op-Amp: 3 pins (+in, -in, out).\n\n' +
    'WIRING: Use addWire with x1,y1,x2,y2 coordinates (the pin positions). To connect componentA pin0 to componentB pin1, get their pin coordinates from getCircuitState response and wire between those exact coordinates.\n\n' +
    'GRID: Components at multiples of 20. Common Y positions: 100, 200, 300. Common X positions: 100, 200, 300, 400.\n\n' +
    'ERROR DETECTION:\n' +
    '- When user asks to analyze or check a circuit, use detectErrors tool\n' +
    '- Explain each error clearly and suggest fixes\n' +
    '- If auto-fix is available (hasFix=true), offer to apply it with fixError tool\n' +
    '- After building a circuit, run detectErrors to verify\n\n' +
    'GENERATIVE DESIGN:\n' +
    '- Plan component layout before placing: source left, load right, ground bottom\n' +
    '- Use 120-160px horizontal spacing, 80-120px vertical\n' +
    '- Always add ground reference\n' +
    '- Calculate values: LED R=(Vs-Vf)/If with E12 series, voltage divider Vout=Vin*R2/(R1+R2), RC filter fc=1/(2piRC)\n' +
    '- For CE amplifier: Av=-Rc/Re, bias Vce=Vcc/2\n\n' +
    'EDUCATION MODE:\n' +
    '- When user wants to learn, build the circuit step by step with explanations\n' +
    '- After building, start simulation and explain key measurements\n' +
    '- Topics: Ohm law, voltage divider, LED circuits, RC filters, transistor amplifier, op-amp basics';
  }

  // ===== TOOL DEFINITIONS =====
  var TOOLS = [
    {
      name: 'getCircuitState',
      description: 'Get current circuit state: all components with IDs, positions, pin coordinates, values, connections, and simulation results. ALWAYS call this first before making changes.',
      input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'addComponent',
      description: 'Add a component to the circuit. Returns the new component ID and pin positions.',
      input_schema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Component type', enum: ['resistor','capacitor','inductor','dcSource','acSource','diode','led','npn','pnp','nmos','pmos','opamp','switch','fuse','ground','zener','vccLabel','gndLabel','netLabel'] },
          x: { type: 'number', description: 'X position (multiple of 20)' },
          y: { type: 'number', description: 'Y position (multiple of 20)' },
          value: { type: 'number', description: 'Component value: ohms for R, farads for C, henrys for L, volts for sources' },
          rotation: { type: 'number', description: 'Rotation: 0, 1, 2, or 3 (each = 90 degrees clockwise). Default 0.' },
          frequency: { type: 'number', description: 'Frequency in Hz for AC source' }
        },
        required: ['type', 'x', 'y']
      }
    },
    {
      name: 'addWire',
      description: 'Add a wire between two points. Use exact pin coordinates from getCircuitState or addComponent responses.',
      input_schema: {
        type: 'object',
        properties: {
          x1: { type: 'number', description: 'Start X coordinate' },
          y1: { type: 'number', description: 'Start Y coordinate' },
          x2: { type: 'number', description: 'End X coordinate' },
          y2: { type: 'number', description: 'End Y coordinate' }
        },
        required: ['x1', 'y1', 'x2', 'y2']
      }
    },
    {
      name: 'removeComponent',
      description: 'Remove a component by ID.',
      input_schema: {
        type: 'object',
        properties: { componentId: { type: 'number', description: 'Component ID (number)' } },
        required: ['componentId']
      }
    },
    {
      name: 'setComponentValue',
      description: 'Change a component value or parameter.',
      input_schema: {
        type: 'object',
        properties: {
          componentId: { type: 'number', description: 'Component ID' },
          value: { type: 'number', description: 'New value (ohms, farads, volts, etc.)' },
          frequency: { type: 'number', description: 'New frequency in Hz (for AC sources)' }
        },
        required: ['componentId']
      }
    },
    {
      name: 'startSimulation',
      description: 'Start or stop the simulation. After starting, call getCircuitState to read voltage/current values.',
      input_schema: {
        type: 'object',
        properties: { action: { type: 'string', enum: ['start', 'stop', 'toggle'], description: 'Default: toggle' } },
        required: []
      }
    },
    {
      name: 'clearCircuit',
      description: 'Remove all components and wires.',
      input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'loadPreset',
      description: 'Load a preset example circuit by ID or index (1-35).',
      input_schema: {
        type: 'object',
        properties: { presetId: { type: 'string', description: 'Preset ID string (e.g. "voltage_divider") or index' } },
        required: ['presetId']
      }
    },
    {
      name: 'saveUndo',
      description: 'Save an undo checkpoint before making multiple changes. Call this once before a batch of addComponent/addWire calls.',
      input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'detectErrors',
      description: 'Scan the circuit for common errors: floating nodes, missing ground, LEDs without resistors, short circuits, power overload. Returns error list with fix suggestions. Use this after building a circuit or when user asks to check/analyze.',
      input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'fixError',
      description: 'Apply an automatic fix for a detected error. Use detectErrors first to get available fixes.',
      input_schema: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Fix action from detectErrors: addGround, addResistorForLED' },
          partId: { type: 'number', description: 'Component ID for component-specific fixes' },
          resistorValue: { type: 'number', description: 'Resistor value in ohms (for addResistorForLED)' }
        },
        required: ['action']
      }
    }
  ];

  // ===== TOOL IMPLEMENTATIONS =====
  function executeTool(name, input) {
    try {
      switch (name) {
        case 'getCircuitState': return toolGetCircuitState();
        case 'addComponent': return toolAddComponent(input);
        case 'addWire': return toolAddWire(input);
        case 'removeComponent': return toolRemoveComponent(input);
        case 'setComponentValue': return toolSetValue(input);
        case 'startSimulation': return toolSimulation(input);
        case 'clearCircuit': return toolClear();
        case 'loadPreset': return toolLoadPreset(input);
        case 'saveUndo': return toolSaveUndo();
        case 'detectErrors': return toolDetectErrors();
        case 'fixError': return toolFixError(input);
        default: return { error: 'Unknown tool: ' + name };
      }
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }

  function toolGetCircuitState() {
    var comps = S.parts.map(function(p) {
      var pins = getPartPins(p);
      var pinCoords = pins.map(function(pin, idx) { return { index: idx, x: pin.x, y: pin.y }; });
      return {
        id: p.id, type: p.type, name: p.name,
        x: p.x, y: p.y, rot: p.rot || 0,
        value: p.val, freq: p.freq || 0,
        pins: pinCoords,
        voltage: p._v || 0, current: p._i || 0, power: p._p || 0,
        damaged: !!p.damaged
      };
    });
    var wires = S.wires.map(function(w) {
      return { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 };
    });
    return {
      componentCount: comps.length, wireCount: wires.length,
      simRunning: S.sim.running, simTime: S.sim.t,
      components: comps, wires: wires
    };
  }

  function toolAddComponent(input) {
    var p = VXA.addComponent(input.type, input.x, input.y, {
      rot: input.rotation || 0,
      val: input.value,
      freq: input.frequency || 0
    });
    if (!p) return { error: 'Failed to add component. Check type: ' + input.type };
    // Apply model if available
    if (input.value !== undefined) p.val = input.value;
    if (input.frequency) p.freq = input.frequency;
    var pins = getPartPins(p);
    var pinCoords = pins.map(function(pin, idx) { return { index: idx, x: pin.x, y: pin.y }; });
    return { id: p.id, name: p.name, type: p.type, x: p.x, y: p.y, pins: pinCoords };
  }

  function toolAddWire(input) {
    VXA.addWire(input.x1, input.y1, input.x2, input.y2);
    return { success: true, from: [input.x1, input.y1], to: [input.x2, input.y2] };
  }

  function toolRemoveComponent(input) {
    var id = input.componentId;
    var found = S.parts.some(function(p) { return p.id === id; });
    if (!found) return { error: 'Component not found: ' + id };
    VXA.removeComponent(id);
    return { success: true, removed: id };
  }

  function toolSetValue(input) {
    var p = S.parts.find(function(pp) { return pp.id === input.componentId; });
    if (!p) return { error: 'Component not found: ' + input.componentId };
    if (input.value !== undefined) p.val = input.value;
    if (input.frequency !== undefined) p.freq = input.frequency;
    needsRender = true;
    if (S.sim.running) buildCircuitFromCanvas();
    return { success: true, id: p.id, value: p.val, freq: p.freq };
  }

  function toolSimulation(input) {
    var action = (input && input.action) || 'toggle';
    if (action === 'start' && !S.sim.running) toggleSim();
    else if (action === 'stop' && S.sim.running) toggleSim();
    else if (action === 'toggle') toggleSim();
    return { running: S.sim.running };
  }

  function toolClear() {
    saveUndo();
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (S.sim.running) toggleSim();
    needsRender = true;
    return { success: true, message: 'Circuit cleared' };
  }

  function toolLoadPreset(input) {
    var id = input.presetId;
    // Try by index
    var idx = parseInt(id);
    if (!isNaN(idx) && idx >= 1 && idx <= PRESETS.length) {
      loadPreset(PRESETS[idx - 1].id);
      return { success: true, loaded: PRESETS[idx - 1].name };
    }
    // Try by id string
    var pr = PRESETS.find(function(p) { return p.id === id; });
    if (pr) { loadPreset(pr.id); return { success: true, loaded: pr.name }; }
    // Try keyword match
    var kw = id.toLowerCase();
    pr = PRESETS.find(function(p) { return p.name.toLowerCase().indexOf(kw) >= 0 || p.id.toLowerCase().indexOf(kw) >= 0; });
    if (pr) { loadPreset(pr.id); return { success: true, loaded: pr.name }; }
    return { error: 'Preset not found: ' + id + '. Available: ' + PRESETS.slice(0, 10).map(function(p) { return p.id; }).join(', ') + '...' };
  }

  function toolSaveUndo() {
    saveUndo();
    return { success: true };
  }

  function toolDetectErrors() {
    if (!VXA.AIErrors) return { error: 'AIErrors module not loaded' };
    var errors = VXA.AIErrors.detect();
    var summary = VXA.AIErrors.getSummary(errors);
    return {
      errorCount: summary.errors, warningCount: summary.warnings, total: summary.total,
      errors: errors.map(function(e) {
        return {
          type: e.type.id, severity: e.type.severity, icon: e.type.icon,
          partId: e.partId || null, pin: e.pin !== undefined ? e.pin : null,
          message: e.message,
          hasFix: !!e.fix,
          fix: e.fix ? { action: e.fix.action, partId: e.fix.partId, resistorValue: e.fix.resistorValue, description: e.fix.description } : null
        };
      })
    };
  }

  function toolFixError(input) {
    if (!VXA.AIErrors) return { error: 'AIErrors module not loaded' };
    return VXA.AIErrors.applyFix(input);
  }

  // ===== API KEY =====
  function getKey() { return localStorage.getItem('vxa_ai_key') || ''; }
  function setKey(k) { localStorage.setItem('vxa_ai_key', k || ''); }
  function hasKey() { return getKey().length > 10; }

  // ===== MAIN SEND =====
  return {
    setApiKey: function(k) { setKey(k); },
    getApiKey: function() { return getKey(); },
    hasApiKey: function() { return hasKey(); },

    onMessage: function(fn) { _onMessage = fn; },
    onToolUse: function(fn) { _onToolUse = fn; },
    onError: function(fn) { _onError = fn; },
    onProcessing: function(fn) { _onProcessing = fn; },

    isProcessing: function() { return _isProcessing; },
    getHistory: function() { return _history.slice(); },
    clearHistory: function() { _history = []; },
    getRemainingMessages: function() { return hasKey() ? Infinity : 0; },

    quickCommand: function(cmd) {
      if (cmd === 'clear') { toolClear(); return 'Circuit cleared.'; }
      if (cmd === 'state') { return JSON.stringify(toolGetCircuitState(), null, 2); }
      if (cmd === 'sim') { toolSimulation({ action: 'toggle' }); return 'Simulation toggled.'; }
      return null;
    },

    send: function(userMessage) {
      if (_isProcessing) return Promise.resolve();
      if (!userMessage || !userMessage.trim()) return Promise.resolve();
      if (!hasKey()) {
        if (_onError) _onError({ type: 'no_key', message: currentLang === 'tr' ? 'AI asistanı kullanmak için API anahtarı ekleyin.' : 'Add an API key to use the AI assistant.' });
        return Promise.resolve();
      }

      _isProcessing = true;
      if (_onProcessing) _onProcessing(true);

      _history.push({ role: 'user', content: userMessage });
      if (_history.length > MAX_HISTORY * 2) _history = _history.slice(-MAX_HISTORY * 2);

      var self = this;
      return self._callAPI()
        .then(function(response) { return self._processResponse(response, 0); })
        .catch(function(err) {
          if (_onError) _onError({ type: 'api_error', message: err.message || String(err) });
        })
        .then(function() {
          _isProcessing = false;
          if (_onProcessing) _onProcessing(false);
        });
    },

    _processResponse: function(response, round) {
      if (round >= 5) return Promise.resolve(); // Safety limit

      var hasToolUse = false;
      var toolResults = [];
      var self = this;

      if (!response || !response.content) return Promise.resolve();

      for (var i = 0; i < response.content.length; i++) {
        var block = response.content[i];

        if (block.type === 'text' && block.text) {
          if (_onMessage) _onMessage({ type: 'assistant', content: block.text });
        }

        if (block.type === 'tool_use') {
          hasToolUse = true;
          var result = executeTool(block.name, block.input);
          if (_onToolUse) _onToolUse(block.name, block.input, result);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        }
      }

      _history.push({ role: 'assistant', content: response.content });

      if (hasToolUse && toolResults.length > 0) {
        _history.push({ role: 'user', content: toolResults });
        return self._callAPI().then(function(resp) {
          return self._processResponse(resp, round + 1);
        });
      }

      return Promise.resolve();
    },

    _callAPI: function() {
      var body = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(),
        tools: TOOLS,
        messages: _history
      };

      return fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      }).then(function(resp) {
        if (!resp.ok) {
          return resp.text().then(function(t) {
            throw new Error('API ' + resp.status + ': ' + t.substring(0, 200));
          });
        }
        return resp.json();
      });
    },

    // Expose for testing
    _executeTool: function(name, input) { return executeTool(name, input); },
    getTools: function() { return TOOLS; }
  };
})();
