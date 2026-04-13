// ──────── SPRINT 7: GERÇEKÇI BİLEŞEN MODELLERİ ────────

// 7.1: SPICE MODEL PARAMETRE KÜTÜPHANESİ
VXA.Models = (function() {
  var BJT = {
    'Generic':{ type:'NPN', IS:1e-14, BF:100, NF:1, VAF:100, IKF:1000, BR:1, NR:1, VAR:1000, ISE:0, NE:1.5, ISC:0, NC:2, RB:0, RC:0, RE:0, CJE:0, VJE:0.75, MJE:0.33, CJC:0, VJC:0.75, MJC:0.33, TF:0, TR:0, desc:'Generic NPN' },
    '2N2222':{ type:'NPN', IS:14.34e-15, BF:255.9, NF:1, VAF:74.03, IKF:0.2847, ISE:14.34e-15, NE:1.307, BR:6.092, NR:1, VAR:28, RB:10, RC:1, RE:0, CJE:22.01e-12, VJE:0.7, MJE:0.377, CJC:7.306e-12, VJC:0.75, MJC:0.3416, TF:411.1e-12, TR:46.91e-9, desc:'General purpose NPN, TO-92, 800mA' },
    '2N3904':{ type:'NPN', IS:6.734e-15, BF:416.4, NF:1, VAF:74.03, IKF:66.78e-3, ISE:6.734e-15, NE:1.259, BR:0.7389, NR:1, VAR:28, RB:10, RC:1, RE:0, CJE:3.638e-12, VJE:0.65, MJE:0.3085, CJC:4.493e-12, VJC:0.75, MJC:0.2593, TF:301.2e-12, TR:239.5e-9, desc:'Small signal NPN, TO-92, 200mA' },
    '2N3906':{ type:'PNP', IS:1.41e-15, BF:180.7, NF:1, VAF:18.7, IKF:80e-3, BR:4.977, NR:1, VAR:28, RB:10, RC:2.5, RE:0, CJE:9.728e-12, VJE:0.8, MJE:0.4, CJC:8.063e-12, VJC:0.75, MJC:0.33, TF:450e-12, TR:100e-9, desc:'Small signal PNP, TO-92, 200mA' },
    'BC547':{ type:'NPN', IS:1.8e-14, BF:400, NF:0.9955, VAF:80, IKF:0.14, ISE:5e-14, NE:1.46, BR:35.5, NR:1, VAR:12.5, RB:280, RC:22, RE:1, CJE:12e-12, VJE:0.58, MJE:0.35, CJC:5e-12, VJC:0.65, MJC:0.33, TF:500e-12, TR:10e-9, desc:'Low noise NPN, TO-92, 100mA' },
    'BC557':{ type:'PNP', IS:2e-14, BF:290, NF:1, VAF:50, IKF:0.1, RB:250, RC:20, RE:1, CJE:10e-12, VJE:0.6, MJE:0.35, CJC:6e-12, VJC:0.65, MJC:0.33, TF:640e-12, TR:50e-9, desc:'PNP complement BC547' },
    'BD139':{ type:'NPN', IS:1e-13, BF:100, VAF:80, IKF:1.5, RB:2, RC:0.5, RE:0.1, CJE:100e-12, CJC:30e-12, TF:10e-9, TR:100e-9, desc:'Medium power NPN, TO-126, 1.5A' },
    'TIP31C':{ type:'NPN', IS:1e-12, BF:40, VAF:80, IKF:3, RB:1, RC:0.2, RE:0.05, CJE:200e-12, CJC:50e-12, TF:20e-9, TR:200e-9, desc:'Power NPN, TO-220, 3A 40W' },
  };
  var MOSFET = {
    'Generic':{ type:'NMOS', VTO:2.0, KP:110e-6, LAMBDA:0.04, desc:'Generic NMOS' },
    'IRF540N':{ type:'NMOS', VTO:3.5, KP:20.8, LAMBDA:0.01, RD:0.022, RS:0.022, CGS:1.8e-9, CGDO:0.1e-9, CBD:1.4e-9, desc:'N-ch power, TO-220, 33A 100V, RDS=44mΩ' },
    'IRF9540':{ type:'PMOS', VTO:3.5, KP:10, LAMBDA:0.01, RD:0.117, RS:0.117, CGS:1.2e-9, CBD:1.5e-9, desc:'P-ch power, TO-220, 23A -100V' },
    '2N7000':{ type:'NMOS', VTO:1.7, KP:0.15, LAMBDA:0.04, RD:7.5, RS:7.5, CBD:35e-12, CGS:20e-12, CGDO:2e-12, desc:'Small signal N-ch, TO-92, 200mA 60V' },
    'BS170':{ type:'NMOS', VTO:1.5, KP:0.3, LAMBDA:0.02, RD:5, RS:5, CBD:50e-12, CGS:30e-12, desc:'Small signal N-ch, TO-92, 500mA 60V' },
    'IRF3205':{ type:'NMOS', VTO:3.0, KP:40, LAMBDA:0.005, RD:0.004, RS:0.004, CBD:3e-9, CGS:3.2e-9, desc:'Logic level N-ch, TO-220, 110A, RDS=8mΩ' },
  };
  var DIODE = {
    'Generic':{ IS:1e-14, N:1, RS:0, BV:100, CJO:0, VJ:0.7, M:0.5, TT:0, desc:'Generic Si diode' },
    '1N4148':{ IS:2.52e-9, N:1.752, RS:0.568, BV:100, IBV:100e-6, CJO:4e-12, VJ:0.3, M:0.4, TT:11.54e-9, desc:'Small signal Si, fast, BV=100V' },
    '1N4007':{ IS:76.9e-9, N:1.45, RS:0.042, BV:1000, IBV:5e-6, CJO:26.5e-12, VJ:0.3, M:0.5, TT:4.32e-6, desc:'Rectifier 1A 1000V, DO-41' },
    '1N4001':{ IS:29.5e-9, N:1.45, RS:0.042, BV:50, CJO:26.5e-12, VJ:0.3, M:0.5, TT:4.32e-6, desc:'Rectifier 1A 50V, DO-41' },
    '1N5819':{ IS:3.17e-5, N:1.05, RS:0.042, BV:40, CJO:110e-12, VJ:0.35, M:0.5, TT:5e-9, desc:'Schottky 1A 40V, Vf=0.3V' },
    'BAT54':{ IS:1e-7, N:1.03, RS:1, BV:30, CJO:10e-12, VJ:0.25, M:0.35, TT:5e-9, desc:'Schottky 200mA 30V, SOT-23' },
  };
  var LED = {
    'RED_5MM':{ IS:93.2e-12, N:3.73, RS:0.636, BV:5, CJO:2e-12, Vf_typ:1.8, If_max:0.02, color:'#f0454a', desc:'Red LED 5mm, 20mA' },
    'GREEN_5MM':{ IS:93.2e-12, N:4.0, RS:0.9, BV:5, CJO:2e-12, Vf_typ:2.2, If_max:0.02, color:'#22c55e', desc:'Green LED 5mm, 20mA' },
    'BLUE_5MM':{ IS:93.2e-12, N:5.0, RS:1.2, BV:5, CJO:2e-12, Vf_typ:3.2, If_max:0.02, color:'#3b82f6', desc:'Blue LED 5mm, 20mA' },
    'YELLOW_5MM':{ IS:93.2e-12, N:3.9, RS:0.8, BV:5, CJO:2e-12, Vf_typ:2.0, If_max:0.02, color:'#eab308', desc:'Yellow LED 5mm, 20mA' },
    'WHITE_5MM':{ IS:93.2e-12, N:4.5, RS:1.0, BV:5, CJO:2e-12, Vf_typ:3.3, If_max:0.02, color:'#e0e7f0', desc:'White LED 5mm, 20mA' },
    'IR_5MM':{ IS:1e-10, N:2.0, RS:0.4, BV:5, CJO:2e-12, Vf_typ:1.3, If_max:0.05, color:'#440000', desc:'IR LED 940nm, 50mA' },
    'POWER_1W':{ IS:1e-11, N:3.5, RS:0.3, BV:5, CJO:5e-12, Vf_typ:3.2, If_max:0.35, color:'#e0e7f0', desc:'Power LED 1W, 350mA' },
  };
  var ZENER = {
    '1N4728':{ Vz:3.3, Zz:10, Iz:76e-3, Pd:1, desc:'3.3V Zener 1W' },
    '1N4733':{ Vz:5.1, Zz:7, Iz:49e-3, Pd:1, desc:'5.1V Zener 1W' },
    '1N4737':{ Vz:7.5, Zz:6, Iz:34e-3, Pd:1, desc:'7.5V Zener 1W' },
    '1N4742':{ Vz:12, Zz:9, Iz:21e-3, Pd:1, desc:'12V Zener 1W' },
    '1N4744':{ Vz:15, Zz:14, Iz:17e-3, Pd:1, desc:'15V Zener 1W' },
    '1N4749':{ Vz:24, Zz:25, Iz:10.5e-3, Pd:1, desc:'24V Zener 1W' },
  };
  var OPAMP = {
    'Ideal':{ Aol:1e5, GBW:1e9, SR:1e9, Vos:0, Rin:1e9, Rout:0.1, desc:'Ideal op-amp' },
    'LM741':{ Aol:2e5, GBW:1e6, SR:0.5e6, Vos:1e-3, Ib:80e-9, Rin:2e6, Rout:75, Iout:25e-3, Vs_min:-15, Vs_max:15, desc:'Classic GP, DIP-8, single' },
    'TL072':{ Aol:2e5, GBW:3e6, SR:13e6, Vos:3e-3, Ib:65e-12, Rin:1e12, Rout:100, desc:'Low noise JFET, DIP-8, dual' },
    'TL082':{ Aol:2e5, GBW:4e6, SR:13e6, Vos:6e-3, Ib:30e-12, Rin:1e12, Rout:100, desc:'JFET input, DIP-8, dual' },
    'LM358':{ Aol:1e5, GBW:1e6, SR:0.3e6, Vos:2e-3, Ib:45e-9, Rin:1e6, Rout:150, Vs_min:0, Vs_max:32, desc:'Dual, single supply, DIP-8' },
    'LM324':{ Aol:1e5, GBW:1e6, SR:0.4e6, Vos:2e-3, Ib:45e-9, Rin:1e6, Rout:150, Vs_min:0, Vs_max:32, desc:'Quad, single supply, DIP-14' },
    'NE5532':{ Aol:1e5, GBW:10e6, SR:9e6, Vos:0.5e-3, Ib:200e-9, Rin:300e3, Rout:30, desc:'Low noise audio, DIP-8, dual' },
    'OPA2134':{ Aol:5e5, GBW:8e6, SR:20e6, Vos:0.5e-3, Ib:5e-12, Rin:1e13, Rout:50, desc:'Audio FET, SOP-8, dual' },
    'LM386':{ Aol:46, GBW:300e3, SR:0.2e6, Vos:2e-3, Rin:50e3, Rout:8, Vs_min:4, Vs_max:12, desc:'Audio power amp, DIP-8, 0.7W' },
  };
  var REGULATOR = {
    '7805':{ Vout:5, Vdropout:2, Imax:1.5, desc:'5V fixed, TO-220, 1.5A' },
    '7809':{ Vout:9, Vdropout:2, Imax:1.5, desc:'9V fixed, TO-220' },
    '7812':{ Vout:12, Vdropout:2, Imax:1.5, desc:'12V fixed, TO-220' },
    '7815':{ Vout:15, Vdropout:2, Imax:1.5, desc:'15V fixed, TO-220' },
    '7905':{ Vout:-5, Vdropout:2, Imax:1.5, desc:'-5V fixed, TO-220' },
    '7912':{ Vout:-12, Vdropout:2, Imax:1.5, desc:'-12V fixed, TO-220' },
    'LM317':{ Vref:1.25, Vdropout:2.5, Imax:1.5, Vout_min:1.25, Vout_max:37, adjustable:true, desc:'Adjustable 1.25-37V, TO-220' },
  };
  function getModel(type, name) {
    var map = { npn:BJT, pnp:BJT, nmos:MOSFET, pmos:MOSFET, diode:DIODE, schottky:DIODE, led:LED, zener:ZENER, opamp:OPAMP, comparator:OPAMP, vreg:REGULATOR };
    var lib = map[type]; return lib ? (lib[name] || null) : null;
  }
  function listModels(type) {
    var map = { npn:BJT, pnp:BJT, nmos:MOSFET, pmos:MOSFET, diode:DIODE, schottky:DIODE, led:LED, zener:ZENER, opamp:OPAMP, comparator:OPAMP, vreg:REGULATOR };
    var lib = map[type]; if (!lib) return [];
    return Object.keys(lib).filter(function(k) {
      var v = lib[k];
      if (type === 'npn' && v.type === 'PNP') return false;
      if (type === 'pnp' && v.type === 'NPN') return false;
      if (type === 'nmos' && v.type === 'PMOS') return false;
      if (type === 'pmos' && v.type === 'NMOS') return false;
      return true;
    }).map(function(k) { return { name: k, desc: lib[k].desc || '' }; });
  }
  function addCustomModel(type, name, params) {
    var map = { npn:BJT, pnp:BJT, nmos:MOSFET, pmos:MOSFET, diode:DIODE, schottky:DIODE, led:LED, zener:ZENER, opamp:OPAMP, vreg:REGULATOR };
    var lib = map[type]; if (lib) lib[name] = params;
  }
  // Default model assignments for new parts
  var DEFAULTS = { npn:'2N2222', pnp:'2N3906', nmos:'2N7000', pmos:'Generic', diode:'1N4148', schottky:'1N5819', led:'RED_5MM', zener:'1N4733', opamp:'LM741', vreg:'7805' };
  function getDefault(type) { return DEFAULTS[type] || null; }
  return { getModel:getModel, listModels:listModels, addCustomModel:addCustomModel, getDefault:getDefault, BJT:BJT, MOSFET:MOSFET, DIODE:DIODE, LED:LED, ZENER:ZENER, OPAMP:OPAMP, REGULATOR:REGULATOR };
})();