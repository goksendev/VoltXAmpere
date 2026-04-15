// ──────── SPRINT 44: CIRCUIT SERIALIZER ────────
// Converts the live SIM object (built by sim-legacy.js) into a JSON-safe
// transferable payload for the Web Worker. DOM-free, function-free.

VXA.CircuitSerializer = (function() {
  'use strict';

  // Fields we copy verbatim from an MNA component (anything function or DOM
  // is intentionally dropped).
  var PRIMITIVE_KEYS = [
    'type','n1','n2','n3','n4','nA','nK','nG','nP','nN','nO','nD','nS','nB',
    'nIn','nOut','nGnd','nVCC','nTRIG','nTHR','nOUT','nDIS','nRST','nCTRL',
    'val','freq','phase','dcOffset','amplitude','duty','td','tr','tf','pw','per',
    'IS','N','BF','BR','NF','NR','VAF','IKF','polarity','VTO','KP','LAMBDA',
    'vPrev','iPrev','ratio','gain','gm','alpha','rm','vz','A','Rin','Rout',
    'v1','v2','bi','isAC','isPulse','isPWL','isEXP','isSFFM','isNoise',
    'isMeter','isBuzzer','isSpeaker','isDACOutput','isBSIM3'
  ];

  function serializeComp(c) {
    if (!c) return null;
    var out = {};
    for (var i = 0; i < PRIMITIVE_KEYS.length; i++) {
      var k = PRIMITIVE_KEYS[i];
      var v = c[k];
      if (v === undefined) continue;
      if (typeof v === 'function') continue;
      out[k] = v;
    }
    // Arrays/objects copied by reference are fine for postMessage (structured clone handles them)
    if (Array.isArray(c.points)) out.points = c.points.map(function(p) { return p.slice(); });
    if (c.expParams) out.expParams = Object.assign({}, c.expParams);
    if (c.sffmParams) out.sffmParams = Object.assign({}, c.sffmParams);
    if (c.bsim3) out.bsim3 = Object.assign({}, c.bsim3);
    // Skip c.part — it's the live DOM-bound part, not clonable.
    return out;
  }

  function serialize(simObj, scopeNodes, dt) {
    if (!simObj) return null;
    var comps = Array.isArray(simObj.comps) ? simObj.comps.map(serializeComp).filter(Boolean) : [];
    // Count voltage-source-like branch variables (V, L, VCVS, CCVS, CCCS, OA, IC555)
    var branchTypes = { V: 1, L: 1, VCVS: 1, CCVS: 1, CCCS: 1, OA: 1, IC555: 1 };
    var branchCount = 0;
    for (var i = 0; i < comps.length; i++) {
      if (branchTypes[comps[i].type]) branchCount++;
    }
    return {
      N: simObj.N || 0,
      branchCount: branchCount,
      dt: dt || 1e-5,
      scopeNodes: Array.isArray(scopeNodes) ? scopeNodes.slice() : [],
      comps: comps
    };
  }

  return { serialize: serialize, serializeComp: serializeComp, PRIMITIVE_KEYS: PRIMITIVE_KEYS };
})();
