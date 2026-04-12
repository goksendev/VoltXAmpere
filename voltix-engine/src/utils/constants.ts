/** Boltzmann constant (J/K) */
export const BOLTZMANN = 1.380649e-23;

/** Elementary charge (C) */
export const CHARGE = 1.602176634e-19;

/** Nominal temperature (K) — 27°C */
export const T_NOMINAL = 300.15;

/** Thermal voltage at nominal temperature (V) — kT/q ≈ 25.86mV */
export const VT_NOMINAL = (BOLTZMANN * T_NOMINAL) / CHARGE;

/** Minimum conductance for convergence (S) */
export const GMIN = 1e-12;

/** Absolute tolerance for current convergence (A) */
export const ABSTOL = 1e-12;

/** Relative tolerance for convergence */
export const RELTOL = 1e-3;

/** Voltage tolerance for convergence (V) */
export const VTOL = 1e-6;
