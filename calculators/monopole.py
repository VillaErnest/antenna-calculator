"""Quarter-Wave Monopole Antenna calculator."""
import math

C = 3e8
FREQ_UNITS = {"Hz": 1, "kHz": 1e3, "MHz": 1e6, "GHz": 1e9}
LEN_UNITS = {"m": 1, "cm": 0.01, "mm": 0.001}
_40PI2 = 40 * (math.pi ** 2)
_160PI2 = 160 * (math.pi ** 2)
ETA_0 = 120 * math.pi

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


# ---------------------------------------------------------------------------
# Individual parameter solver (used by the "Solve Parameter" UI tab)
# ---------------------------------------------------------------------------

def _bisect_pattern(target_F, n=60):
    """Return theta (radians) in (0, pi/2] such that F(theta) ≈ target_F."""
    lo, hi = 1e-6, math.pi / 2
    for _ in range(n):
        mid = (lo + hi) / 2
        if calc_f_theta(mid) < target_F:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


_SOLVERS = {
    # --- Radiation Resistance ---
    "rr_short":       lambda p: _40PI2 * ((p["lam"] / 4) / p["lam"]) ** 2,
    "rr_uniform":     lambda p: _160PI2 * ((p["lam"] / 4) / p["lam"]) ** 2,
    "rr_from_power":  lambda p: p["Prad"] / p["Irms"] ** 2,
    "rr_constant":    lambda p: 36.5,
    "L_from_rr":      lambda p: p["lam"] * math.sqrt(p["Rr"] / _40PI2),
    "lam_from_rr":    lambda p: p["L"] / math.sqrt(p["Rr"] / _40PI2),
    "Prad_from_rr":   lambda p: p["Irms"] ** 2 * p["Rr"],
    "Irms_from_rr":   lambda p: math.sqrt(p["Prad"] / p["Rr"]),
    # --- Efficiency ---
    "eff_resistances": lambda p: p["Rr"] / (p["Rr"] + p["Rloss"]),
    "eff_powers":      lambda p: p["Prad"] / p["Pin"],
    "eff_from_gain":   lambda p: p["G"] / p["D"],
    "rr_from_eff":     lambda p: (p["eff"] * p["Rloss"]) / (1 - p["eff"]),
    "rloss_from_eff":  lambda p: p["Rr"] / p["eff"] - p["Rr"],
    "Prad_from_eff":   lambda p: p["eff"] * p["Pin"],
    "Pin_from_eff":    lambda p: p["Prad"] / p["eff"],
    # --- Gain ---
    "G_from_eff_D":    lambda p: p["eff"] * p["D"],
    "G_from_intensity":lambda p: (4 * math.pi * p["Umax"]) / p["Pin"],
    "G_from_aperture": lambda p: (4 * math.pi * p["Ae"]) / p["lam"] ** 2,
    "G_from_dB":       lambda p: 10 ** (p["GdB"] / 10),
    "GdB_from_G":      lambda p: 10 * math.log10(p["G"]),
    "Umax_from_G_Pin": lambda p: (p["G"] * p["Pin"]) / (4 * math.pi),
    "Pin_from_G_Umax": lambda p: (4 * math.pi * p["Umax"]) / p["G"],
    "Ae_from_G_lam":   lambda p: (p["lam"] ** 2 / (4 * math.pi)) * p["G"],
    "lam_from_Ae_G":   lambda p: math.sqrt((4 * math.pi * p["Ae"]) / p["G"]),
    # --- Directivity ---
    "D_standard":      lambda p: 3.28,
    "D_short":         lambda p: 3.0,
    "D_from_intensity":lambda p: (4 * math.pi * p["Umax"]) / p["Prad"],
    "D_from_gain":     lambda p: p["G"] / p["eff"],
    "D_from_omega":    lambda p: (4 * math.pi) / p["OmegaA"],
    "Umax_from_Prad_D":lambda p: (p["Prad"] * p["D"]) / (4 * math.pi),
    "Prad_from_Umax_D":lambda p: (4 * math.pi * p["Umax"]) / p["D"],
    "OmegaA_from_D":   lambda p: (4 * math.pi) / p["D"],
    # --- U_max ---
    "Umax_from_E_r":   lambda p: (p["r"] ** 2 * p["E"] ** 2) / (2 * ETA_0),
    "Umax_from_H_r":   lambda p: (ETA_0 * p["r"] ** 2 * p["H"] ** 2) / 2,
    "r_from_Umax_E":   lambda p: math.sqrt((2 * ETA_0 * p["Umax"]) / p["E"] ** 2),
    "r_from_Umax_H":   lambda p: (1 / p["H"]) * math.sqrt((2 * p["Umax"]) / ETA_0),
    "E_from_Umax_r":   lambda p: math.sqrt((2 * ETA_0 * p["Umax"]) / p["r"] ** 2),
    "H_from_Umax_r":   lambda p: (1 / p["r"]) * math.sqrt((2 * p["Umax"]) / ETA_0),
    # --- E / H fields ---
    "E_from_H":        lambda p: p["H"] * ETA_0,
    "H_from_E":        lambda p: p["E"] / ETA_0,
    # --- Antenna Dimensions (λ/4 monopole) ---
    "L_from_lam":      lambda p: p["lam"] / 4,
    "lam_from_L_dim":  lambda p: 4 * p["L"],
    "f_from_L_dim":    lambda p: C / (4 * p["L"]),
    # --- Radiation pattern ---
    "F_from_theta":    lambda p: calc_f_theta(p["theta"] if p.get("is_rad") else math.radians(p["theta"])),
    "theta_from_F":    lambda p: _bisect_pattern(p["F"]),
}

_DERIVED_FNS: dict = {
    "rr_short":   lambda p: {"L": p["lam"] / 4},
    "rr_uniform": lambda p: {"L": p["lam"] / 4},
}

SOLVER_META = {
    "rr_short":        {"label": "Rr = 40π²(L/λ)²,  L = λ/4",     "inputs": ["lam"],              "derived": ["L"],  "unit": "Ω",    "category": "Radiation Resistance", "target": "Rr"},
    "rr_uniform":      {"label": "Rr = 160π²(L/λ)², L = λ/4",    "inputs": ["lam"],              "derived": ["L"],  "unit": "Ω",    "category": "Radiation Resistance", "target": "Rr"},
    "rr_from_power":   {"label": "Rr = Prad / Irms²",         "inputs": ["Prad", "Irms"],     "unit": "Ω",    "category": "Radiation Resistance", "target": "Rr"},
    "rr_constant":     {"label": "Rr = 36.5 Ω (λ/4)",        "inputs": [],                   "unit": "Ω",    "category": "Radiation Resistance", "target": "Rr"},
    "L_from_rr":       {"label": "L = λ√(Rr / 40π²)",        "inputs": ["Rr", "lam"],        "unit": "m",    "category": "Radiation Resistance", "target": "L"},
    "lam_from_rr":     {"label": "λ = L / √(Rr / 40π²)",     "inputs": ["L", "Rr"],          "unit": "m",    "category": "Radiation Resistance", "target": "λ"},
    "Prad_from_rr":    {"label": "Prad = Irms² × Rr",         "inputs": ["Irms", "Rr"],       "unit": "W",    "category": "Radiation Resistance", "target": "Prad"},
    "Irms_from_rr":    {"label": "Irms = √(Prad / Rr)",       "inputs": ["Prad", "Rr"],       "unit": "A",    "category": "Radiation Resistance", "target": "Irms"},
    "eff_resistances": {"label": "η = Rr / (Rr + Rloss)",     "inputs": ["Rr", "Rloss"],      "unit": "",     "category": "Efficiency",           "target": "η"},
    "eff_powers":      {"label": "η = Prad / Pin",             "inputs": ["Prad", "Pin"],      "unit": "",     "category": "Efficiency",           "target": "η"},
    "eff_from_gain":   {"label": "η = G / D",                  "inputs": ["G", "D"],           "unit": "",     "category": "Efficiency",           "target": "η"},
    "rr_from_eff":     {"label": "Rr = (η·Rloss)/(1-η)",      "inputs": ["eff", "Rloss"],     "unit": "Ω",    "category": "Efficiency",           "target": "Rr"},
    "rloss_from_eff":  {"label": "Rloss = Rr/η - Rr",         "inputs": ["Rr", "eff"],        "unit": "Ω",    "category": "Efficiency",           "target": "Rloss"},
    "Prad_from_eff":   {"label": "Prad = η × Pin",             "inputs": ["eff", "Pin"],       "unit": "W",    "category": "Efficiency",           "target": "Prad"},
    "Pin_from_eff":    {"label": "Pin = Prad / η",             "inputs": ["Prad", "eff"],      "unit": "W",    "category": "Efficiency",           "target": "Pin"},
    "G_from_eff_D":    {"label": "G = η × D",                  "inputs": ["eff", "D"],         "unit": "",     "category": "Gain",                 "target": "G"},
    "G_from_intensity":{"label": "G = 4π·Umax / Pin",         "inputs": ["Umax", "Pin"],      "unit": "",     "category": "Gain",                 "target": "G"},
    "G_from_aperture": {"label": "G = 4π·Ae / λ²",            "inputs": ["Ae", "lam"],        "unit": "",     "category": "Gain",                 "target": "G"},
    "G_from_dB":       {"label": "G = 10^(GdB/10)",            "inputs": ["GdB"],              "unit": "",     "category": "Gain",                 "target": "G"},
    "GdB_from_G":      {"label": "GdB = 10·log10(G)",         "inputs": ["G"],                "unit": "dB",   "category": "Gain",                 "target": "GdB"},
    "Umax_from_G_Pin": {"label": "Umax = G·Pin / 4π",         "inputs": ["G", "Pin"],         "unit": "W/sr", "category": "Gain",                 "target": "Umax"},
    "Pin_from_G_Umax": {"label": "Pin = 4π·Umax / G",         "inputs": ["Umax", "G"],        "unit": "W",    "category": "Gain",                 "target": "Pin"},
    "Ae_from_G_lam":   {"label": "Ae = (λ²/4π)·G",           "inputs": ["lam", "G"],         "unit": "m²",   "category": "Gain",                 "target": "Ae"},
    "lam_from_Ae_G":   {"label": "λ = √(4π·Ae/G)",           "inputs": ["Ae", "G"],          "unit": "m",    "category": "Gain",                 "target": "λ"},
    "D_standard":      {"label": "D = 3.28 (λ/4 monopole)",   "inputs": [],                   "unit": "",     "category": "Directivity",          "target": "D"},
    "D_short":         {"label": "D = 3.0 (short monopole)",   "inputs": [],                   "unit": "",     "category": "Directivity",          "target": "D"},
    "D_from_intensity":{"label": "D = 4π·Umax / Prad",        "inputs": ["Umax", "Prad"],     "unit": "",     "category": "Directivity",          "target": "D"},
    "D_from_gain":     {"label": "D = G / η",                  "inputs": ["G", "eff"],         "unit": "",     "category": "Directivity",          "target": "D"},
    "D_from_omega":    {"label": "D = 4π / ΩA",               "inputs": ["OmegaA"],           "unit": "",     "category": "Directivity",          "target": "D"},
    "Umax_from_Prad_D":{"label": "Umax = Prad·D / 4π",        "inputs": ["Prad", "D"],        "unit": "W/sr", "category": "Directivity",          "target": "Umax"},
    "Prad_from_Umax_D":{"label": "Prad = 4π·Umax / D",        "inputs": ["Umax", "D"],        "unit": "W",    "category": "Directivity",          "target": "Prad"},
    "OmegaA_from_D":   {"label": "ΩA = 4π / D",              "inputs": ["D"],                "unit": "sr",   "category": "Directivity",          "target": "ΩA"},
    "Umax_from_E_r":   {"label": "Umax = r²|E|² / (2η₀)",    "inputs": ["r", "E"],           "unit": "W/sr", "category": "Radiation Intensity",  "target": "Umax"},
    "Umax_from_H_r":   {"label": "Umax = η₀·r²·|H|² / 2",   "inputs": ["r", "H"],           "unit": "W/sr", "category": "Radiation Intensity",  "target": "Umax"},
    "r_from_Umax_E":   {"label": "r = √(2η₀·Umax / |E|²)",  "inputs": ["Umax", "E"],        "unit": "m",    "category": "Radiation Intensity",  "target": "r"},
    "r_from_Umax_H":   {"label": "r = (1/|H|)·√(2Umax/η₀)", "inputs": ["Umax", "H"],        "unit": "m",    "category": "Radiation Intensity",  "target": "r"},
    "E_from_Umax_r":   {"label": "|E| = √(2η₀·Umax / r²)",  "inputs": ["Umax", "r"],        "unit": "V/m",  "category": "Radiation Intensity",  "target": "|E|"},
    "H_from_Umax_r":   {"label": "|H| = (1/r)·√(2Umax/η₀)", "inputs": ["Umax", "r"],        "unit": "A/m",  "category": "Radiation Intensity",  "target": "|H|"},
    "E_from_H":        {"label": "|E| = |H|·η₀",             "inputs": ["H"],                "unit": "V/m",  "category": "Field Strengths",      "target": "|E|"},
    "H_from_E":        {"label": "|H| = |E| / η₀",           "inputs": ["E"],                "unit": "A/m",  "category": "Field Strengths",      "target": "|H|"},
    "L_from_lam":      {"label": "L = λ/4",                      "inputs": ["lam"],              "unit": "m",    "category": "Antenna Dimensions",   "target": "L"},
    "lam_from_L_dim":  {"label": "λ = 4L",                      "inputs": ["L"],               "unit": "m",    "category": "Antenna Dimensions",   "target": "λ"},
    "f_from_L_dim":    {"label": "f = c / (4L)",               "inputs": ["L"],               "unit": "Hz",   "category": "Antenna Dimensions",   "target": "f"},
    "F_from_theta":    {"label": "F(θ) = cos(π/2·cosθ)/sinθ","inputs": ["theta"],            "unit": "",     "category": "Radiation Pattern",    "target": "F(θ)"},
    "theta_from_F":    {"label": "θ via bisection [F(θ)≈T]", "inputs": ["F"],                "unit": "rad",  "category": "Radiation Pattern",    "target": "θ"},
}

INPUT_LABELS = {
    "L":      "Physical Length L (m)",
    "lam":    "Wavelength λ (m)",
    "Prad":   "Radiated Power Prad (W)",
    "Irms":   "Current Irms (A)",
    "Rr":     "Radiation Resistance Rr (Ω)",
    "Rloss":  "Loss Resistance Rloss (Ω)",
    "eff":    "Efficiency η (0–1)",
    "Pin":    "Input Power Pin (W)",
    "G":      "Gain G (linear)",
    "GdB":    "Gain GdB (dB)",
    "D":      "Directivity D (linear)",
    "Umax":   "Max Rad. Intensity Umax (W/sr)",
    "Ae":     "Effective Aperture Ae (m²)",
    "OmegaA": "Beam Solid Angle ΩA (sr)",
    "r":      "Distance r (m)",
    "E":      "E-field |E| (V/m)",
    "H":      "H-field |H| (A/m)",
    "theta":  "Angle θ",
    "F":      "Pattern value F (0–1)",
}


def solve(solver_key, params):
    """Solve for a single antenna parameter.

    Parameters
    ----------
    solver_key : str
        One of the keys defined in _SOLVERS / SOLVER_META.
    params : dict
        Numeric input values required by the solver.

    Returns
    -------
    dict with keys:
        result      – numeric answer
        unit        – SI unit string
        label       – human-readable formula label
        solver_key  – echo of the key
        solver_meta – full metadata dict for this solver
        input_labels– dict mapping param name → human label
    """
    if solver_key not in _SOLVERS:
        raise ValueError(f"Unknown solver key: {solver_key!r}")
    fn = _SOLVERS[solver_key]
    result = fn(params)
    meta = SOLVER_META[solver_key]
    derived = {}
    if solver_key in _DERIVED_FNS:
        derived = _DERIVED_FNS[solver_key](params)
    return {
        "result": result,
        "unit": meta["unit"],
        "label": meta["label"],
        "solver_key": solver_key,
        "solver_meta": meta,
        "input_labels": {k: INPUT_LABELS.get(k, k) for k in meta["inputs"]},
        "derived": derived,
    }


def get_solver_catalog():
    """Return the full SOLVER_META dict enriched with human-readable input_labels."""
    enriched = {}
    for key, meta in SOLVER_META.items():
        entry = dict(meta)
        entry["input_labels"] = {k: INPUT_LABELS.get(k, k) for k in meta["inputs"]}
        enriched[key] = entry
    return enriched
