/**
 * Complex number arithmetic for AC (frequency domain) analysis.
 *
 * Immutable value type — all operations return new instances.
 * This is the backbone of AC analysis: every node voltage, branch current,
 * and matrix element becomes a complex number.
 */

export class Complex {
  constructor(
    public readonly re: number,
    public readonly im: number,
  ) {}

  static readonly ZERO = new Complex(0, 0);
  static readonly ONE = new Complex(1, 0);
  static readonly J = new Complex(0, 1);

  /** Create from polar form: r × e^(jθ) */
  static fromPolar(magnitude: number, phaseRad: number): Complex {
    return new Complex(
      magnitude * Math.cos(phaseRad),
      magnitude * Math.sin(phaseRad),
    );
  }

  /** Create a pure real number. */
  static real(r: number): Complex {
    return new Complex(r, 0);
  }

  /** Create a pure imaginary number. */
  static imag(i: number): Complex {
    return new Complex(0, i);
  }

  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }

  sub(other: Complex): Complex {
    return new Complex(this.re - other.re, this.im - other.im);
  }

  mul(other: Complex): Complex {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re,
    );
  }

  div(other: Complex): Complex {
    const denom = other.re * other.re + other.im * other.im;
    if (denom === 0) throw new Error('Complex division by zero');
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom,
    );
  }

  /** Scalar multiplication. */
  scale(s: number): Complex {
    return new Complex(this.re * s, this.im * s);
  }

  /** Complex conjugate: a - jb */
  get conj(): Complex {
    return new Complex(this.re, -this.im);
  }

  /** Negation: -a - jb */
  neg(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /** Magnitude: |z| = √(a² + b²) */
  get magnitude(): number {
    return Math.sqrt(this.re * this.re + this.im * this.im);
  }

  /** Phase angle in radians: atan2(b, a) */
  get phase(): number {
    return Math.atan2(this.im, this.re);
  }

  /** Magnitude in decibels: 20 × log10(|z|) */
  get magnitudeDB(): number {
    return 20 * Math.log10(this.magnitude);
  }

  /** Phase angle in degrees */
  get phaseDeg(): number {
    return (this.phase * 180) / Math.PI;
  }

  /** Check if effectively zero. */
  isZero(tol: number = 1e-30): boolean {
    return Math.abs(this.re) < tol && Math.abs(this.im) < tol;
  }
}
