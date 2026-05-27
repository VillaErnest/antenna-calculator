"""Loop Antenna calculator.

Pure-Python calculation core (numpy + scipy) suitable for use from
both a CLI and the web front-end via Pyodide. The original Tkinter
GUI has been removed; visualisation is now the front-end's job.
"""

import numpy as np
import scipy.special as sc

APP_TITLE = "Loop Antenna Calculator"


# -- Core formulas

def calc_radiation_resistance(f_mhz, a, N=1.0, mu_r=1.0):
    """Radiation resistance (ohms) of a small/multi-turn loop."""
    lam = 300.0 / f_mhz
    area = np.pi * (a ** 2)
    return 320.0 * (np.pi ** 4) * ((N * mu_r * area) / (lam ** 2)) ** 2


def calc_pattern_and_directivity(f_mhz, a, n_points=361):
    """Return (theta, U, D0) for a circular loop antenna.

    theta : ndarray of angles in radians (0..pi)
    U     : relative radiation intensity at each theta
    D0    : maximum directivity (linear)
    """
    lam = 300.0 / f_mhz
    k = 2.0 * np.pi / lam
    theta = np.linspace(0.001, np.pi, n_points)
    U = (sc.j1(k * a * np.sin(theta))) ** 2

    integrand = U * np.sin(theta)
    p_rad = 2 * np.pi * np.trapz(integrand, theta)
    if p_rad == 0:
        d0 = 1.5
    else:
        d0 = 4 * np.pi * np.max(U) / p_rad
    return theta, U, d0


# -- Pure compute function (used by both CLI and web)

def compute(f_mhz, a, N=1.0, mu_r=1.0, loss_resistance=None, n_points=361):
    """Run the full loop-antenna calculation.

    Returns a JSON-friendly dict. Pattern arrays are returned as plain lists
    so they cross the Pyodide/JS bridge cleanly.
    """
    f_mhz = float(f_mhz)
    a = float(a)
    N = float(N)
    mu_r = float(mu_r)

    if f_mhz <= 0 or a <= 0:
        raise ValueError("Frequency and radius must be positive.")

    rr = calc_radiation_resistance(f_mhz, a, N, mu_r)
    theta, U, d0 = calc_pattern_and_directivity(f_mhz, a, n_points)

    d0_db = float(10 * np.log10(d0)) if d0 > 0 else float("-inf")

    # Normalised pattern in dB, clipped at -40
    u_norm = U / np.max(U)
    u_db = 10 * np.log10(u_norm + 1e-10)
    u_db = np.clip(u_db, -40, 0)

    result = {
        "frequency_mhz": f_mhz,
        "radius": a,
        "turns": N,
        "mu_reff": mu_r,
        "radiation_resistance": float(rr),
        "directivity_linear": float(d0),
        "directivity_db": d0_db,
        "theta_rad": theta.tolist(),
        "pattern_db": u_db.tolist(),
    }

    if loss_resistance is not None:
        rl = float(loss_resistance)
        efficiency = rr / (rr + rl) if (rr + rl) > 0 else 0.0
        gain = efficiency * d0
        gain_db = float(10 * np.log10(gain)) if gain > 0 else float("-inf")
        result.update(
            {
                "loss_resistance": rl,
                "efficiency": float(efficiency),
                "gain_linear": float(gain),
                "gain_db": gain_db,
            }
        )

    return result


# ==========================================================
# CLI
# ==========================================================

def _prompt_float(prompt, default=None, allow_blank=False):
    raw = input(prompt).strip()
    if not raw:
        if allow_blank:
            return default
        raise ValueError(f"{prompt!r} is required.")
    return float(raw)


def _display(c):
    print("\n========== RESULTS ==========\n")
    print(f"Frequency:               {c['frequency_mhz']:.4g} MHz")
    print(f"Loop radius:             {c['radius']:.4g} m")
    print(f"Turns:                   {c['turns']:.4g}")
    print(f"Effective permeability:  {c['mu_reff']:.4g}")
    print(f"Radiation Resistance:    {c['radiation_resistance']:.4f} ohms")
    print(
        f"Directivity (D0):        {c['directivity_linear']:.4f} "
        f"({c['directivity_db']:.4f} dB)"
    )
    if "gain_linear" in c:
        print(f"Loss Resistance:         {c['loss_resistance']:.4f} ohms")
        print(f"Efficiency:              {c['efficiency'] * 100:.2f}%")
        print(f"Gain:                    {c['gain_linear']:.4f} ({c['gain_db']:.4f} dB)")
    print("\n=============================\n")


def main():
    print(f"\n===== {APP_TITLE.upper()} =====\n")
    try:
        f_mhz = _prompt_float("Frequency (MHz): ")
        a = _prompt_float("Loop radius 'a' (m): ")
        N = _prompt_float("Number of turns N [1]: ", default=1.0, allow_blank=True)
        mu_r = _prompt_float("Effective permeability mu_reff [1]: ", default=1.0, allow_blank=True)
        rl = _prompt_float(
            "Loss Resistance RL (ohms, blank to skip gain): ", default=None, allow_blank=True
        )
    except ValueError as e:
        print(f"\n[ERROR] Invalid input: {e}\n")
        return

    try:
        results = compute(f_mhz, a, N, mu_r, loss_resistance=rl)
    except ValueError as e:
        print(f"\n[ERROR] {e}\n")
        return

    _display(results)


if __name__ == "__main__":
    main()
