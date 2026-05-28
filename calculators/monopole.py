"""Quarter-Wave Monopole Antenna calculator."""
import math

C = 3e8
FREQ_UNITS = {"Hz": 1, "kHz": 1e3, "MHz": 1e6, "GHz": 1e9}
LEN_UNITS = {"m": 1, "cm": 0.01, "mm": 0.001}

def to_hz(v, unit): return max(float(v), 0.0) * FREQ_UNITS.get(unit, 1)
def to_m(v, unit): return max(float(v), 0.0) * LEN_UNITS.get(unit, 1)
def calc_lambda(f): return C / f if f > 0 else 0.0
def calc_rrad(L, lam): return 40 * (math.pi ** 2) * ((L / lam) ** 2) if lam > 0 else 0.0
def calc_efficiency(rrad, rl):
    den = rrad + rl
    return rrad / den if den > 0 else 1.0
def calc_f_theta(theta_rad):
    s = math.sin(theta_rad)
    if abs(s) < 1e-10: return 0.0
    return abs(math.cos((math.pi / 2) * math.cos(theta_rad)) / s)
def calc_pattern_arrays():
    # A monopole over a perfect ground plane only radiates into the upper
    # hemisphere. We sweep the polar plot angle from 0 deg (right horizon)
    # through 90 deg (zenith) to 180 deg (left horizon). The antenna's
    # elevation angle theta (measured from the vertical antenna axis) maps
    # to the plot angle by theta = |90 - plot_angle|.
    plot_deg = list(range(181))
    e_db = []
    for p in plot_deg:
        antenna_theta = math.radians(abs(90 - p))
        F = calc_f_theta(antenna_theta)
        e_db.append(max(20 * math.log10(max(F, 1e-10)), -40.0))
    return plot_deg, e_db, [0.0] * 181
def validate_monopole(L, lam):
    if lam <= 0: return "error"
    r = L / lam
    if r < 0.2: return "warning"
    return "valid" if r <= 0.3 else "error"
def compute(freq_value, freq_unit, length_value, length_unit, current, loss_resistance, distance, theta_deg):
    f = to_hz(freq_value, freq_unit)
    L = to_m(length_value, length_unit)
    I = max(float(current), 0.0)
    RL = max(float(loss_resistance), 0.0)
    d = max(float(distance), 0.0)
    theta = float(theta_deg)
    if f <= 0 or L <= 0 or d <= 0:
        raise ValueError("Frequency, length, and distance must be positive.")
    lam = calc_lambda(f)
    rrad = calc_rrad(L, lam)
    ecd = calc_efficiency(rrad, RL)
    D = 3.28
    gain = ecd * D
    ae = (lam ** 2 * gain) / (4 * math.pi) if lam > 0 else 0.0
    omega_a = (4 * math.pi) / D
    prad = I ** 2 * rrad
    theta_rad = math.radians(theta)
    F = calc_f_theta(theta_rad)
    eta_0 = 120 * math.pi
    u = (D * prad * F ** 2) / (4 * math.pi)
    e_field = math.sqrt(2 * eta_0 * u) / d if d > 0 and u > 0 else 0.0
    h_field = e_field / eta_0
    pt, pe_db, ph_db = calc_pattern_arrays()
    state = validate_monopole(L, lam)
    return {
        "frequency": f, "length": L, "lambda": lam,
        "radiation_resistance": rrad, "efficiency": ecd, "directivity": D,
        "gain": gain, "effective_area": ae, "beam_solid_angle": omega_a,
        "radiated_power": prad, "radiation_intensity": u,
        "e_field": e_field, "h_field": h_field, "f_theta": F,
        "pattern_theta_deg": pt, "pattern_e_db": pe_db, "pattern_h_db": ph_db,
        "state": state,
    }
