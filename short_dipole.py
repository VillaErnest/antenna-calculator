"""Short Dipole Antenna calculator.

Exposes a pure `compute()` function used by both the CLI and the web
front-end (via Pyodide). CLI-only dependencies (pyperclip, reportlab)
are imported lazily so the module can be loaded in environments where
they are unavailable (e.g. the browser).
"""

import math

APP_TITLE = "Short Dipole Antenna Calculator"
INSTITUTION = "University of Science and Technology of Southern Philippines"
COURSE = "ECE 325 - Transmission Media, Antenna System Design"

C = 3e8

FREQ_UNITS = {"Hz": 1, "kHz": 1e3, "MHz": 1e6, "GHz": 1e9}
LEN_UNITS = {"m": 1, "cm": 0.01, "mm": 0.001}


# -- Unit conversion

def to_hz(v, unit):
    return max(float(v), 0.0) * FREQ_UNITS.get(unit, 1)


def to_m(v, unit):
    return max(float(v), 0.0) * LEN_UNITS.get(unit, 1)


# -- Core formulas

def calc_lambda(f):
    return C / f if f > 0 else 0.0


def calc_rrad(L, lam):
    # Rrad = 80 * pi^2 * (L / lambda)^2
    return 80 * (math.pi ** 2) * ((L / lam) ** 2) if lam > 0 else 0.0


def calc_efficiency(rrad, rl):
    den = rrad + rl
    return rrad / den if den > 0 else 1.0


def calc_gain(ecd):
    return 1.5 * ecd


def calc_ae(lam, gain):
    return (lam ** 2 * gain) / (4 * math.pi) if lam > 0 else 0.0


def calc_dtheta(theta_deg):
    return 1.5 * (math.sin(math.radians(theta_deg)) ** 2)


def calc_prad(I, rrad):
    return (I ** 2) * rrad


def calc_u(prad, theta_deg):
    return (3 * prad / (8 * math.pi)) * (math.sin(math.radians(theta_deg)) ** 2)


def calc_le(L):
    return L / 2.0


def calc_e_field(I, le, d, theta_deg):
    return (60 * I * le * math.sin(math.radians(theta_deg))) / d if d > 0 else 0.0


def validate_short_dipole(L, lam):
    if lam <= 0:
        return "error"
    ratio = L / lam
    if ratio < 0.09:
        return "warning"
    if ratio <= 0.1:
        return "valid"
    return "error"


# -- Pure compute function (used by both CLI and web)

def compute(
    freq_value,
    freq_unit,
    length_value,
    length_unit,
    current,
    loss_resistance,
    distance,
    theta_deg,
    reactance,
):
    """Run the full short-dipole calculation and return a results dict.

    All inputs are plain floats / strings (unit codes). The return value is
    JSON-friendly (complex impedance is split into real/imag).
    """
    f = to_hz(freq_value, freq_unit)
    L = to_m(length_value, length_unit)
    I = max(float(current), 0.0)
    RL = max(float(loss_resistance), 0.0)
    d = max(float(distance), 0.0)
    theta = float(theta_deg)
    XA = float(reactance)

    if f <= 0 or L <= 0 or d <= 0:
        raise ValueError("Frequency, length and distance must be positive.")

    lam = calc_lambda(f)
    rrad = calc_rrad(L, lam)
    ecd = calc_efficiency(rrad, RL)
    gain = calc_gain(ecd)
    ae = calc_ae(lam, gain)
    dmax = 1.5
    dtheta = calc_dtheta(theta)
    prad = calc_prad(I, rrad)
    u = calc_u(prad, theta)
    le = calc_le(L)
    e_field = calc_e_field(I, le, d, theta)
    state = validate_short_dipole(L, lam)

    return {
        "frequency": f,
        "length": L,
        "lambda": lam,
        "radiation_resistance": rrad,
        "efficiency": ecd,
        "gain": gain,
        "effective_area": ae,
        "dmax": dmax,
        "d_theta": dtheta,
        "radiated_power": prad,
        "radiation_intensity": u,
        "effective_length": le,
        "e_field": e_field,
        "impedance_real": rrad + RL,
        "impedance_imag": XA,
        "state": state,
    }


# ==========================================================
# CLI
# ==========================================================

def _prompt_inputs():
    raw_f = float(input("Frequency value: "))
    freq_unit = input("Frequency unit (Hz/kHz/MHz/GHz): ").strip() or "Hz"
    raw_L = float(input("Length value: "))
    len_unit = input("Length unit (m/cm/mm): ").strip() or "m"
    I = float(input("Current (A): "))
    RL = float(input("Loss Resistance RL (ohms): "))
    d = float(input("Distance d (m): "))
    theta = float(input("Theta angle (degrees): "))
    XA = float(input("Reactance XA (ohms): "))
    return compute(raw_f, freq_unit, raw_L, len_unit, I, RL, d, theta, XA)


def _display(c):
    print("\n========== RESULTS ==========\n")
    print(f"Wavelength (lambda):    {c['lambda']:.4g} m")
    print(f"Radiation Resistance:   {c['radiation_resistance']:.4g} ohms")
    print(f"Efficiency:             {c['efficiency'] * 100:.2f}%")
    print(f"Gain:                   {c['gain']:.4g}")
    print(f"Effective Area:         {c['effective_area']:.4g} m^2")
    print(f"Dmax:                   {c['dmax']:.4g}")
    print(f"D(theta):               {c['d_theta']:.4g}")
    print(f"Radiated Power:         {c['radiated_power']:.4g} W")
    print(f"Radiation Intensity:    {c['radiation_intensity']:.4g} W/sr")
    print(f"Effective Length:       {c['effective_length']:.4g} m")
    print(f"E-Field:                {c['e_field']:.4g} V/m")
    print(f"Impedance:              ({c['impedance_real']:.4g} + j{c['impedance_imag']:.4g}) ohms")
    print(f"\nShort Dipole Status:    {c['state'].upper()}")
    print("\n=============================\n")


def _copy_results(c):
    try:
        import pyperclip
    except ImportError:
        print("[WARNING] pyperclip is not installed.")
        return
    txt = (
        f"{APP_TITLE}\n\n"
        f"Lambda: {c['lambda']:.4g} m\n"
        f"Rrad: {c['radiation_resistance']:.4g} ohms\n"
        f"Efficiency: {c['efficiency'] * 100:.2f}%\n"
        f"Gain: {c['gain']:.4g}\n"
        f"E-field: {c['e_field']:.4g} V/m\n"
    )
    try:
        pyperclip.copy(txt)
        print("[INFO] Results copied to clipboard.")
    except Exception:
        print("[WARNING] Clipboard copy failed.")


def _export_pdf(c):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors as rlcolors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
    except ImportError:
        print("[ERROR] reportlab is not installed.")
        return

    import datetime
    import os

    filename = f"short_dipole_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "title", parent=styles["Title"], textColor=rlcolors.HexColor("#1E3A8A"), fontSize=18
    )

    story = [Paragraph(APP_TITLE, title), Spacer(1, 0.2 * inch)]
    data = [
        ["Parameter", "Value"],
        ["Lambda", f"{c['lambda']:.4g} m"],
        ["Rrad", f"{c['radiation_resistance']:.4g} ohms"],
        ["Efficiency", f"{c['efficiency'] * 100:.2f}%"],
        ["Gain", f"{c['gain']:.4g}"],
        ["Effective Area", f"{c['effective_area']:.4g} m^2"],
        ["E-Field", f"{c['e_field']:.4g} V/m"],
    ]
    table = Table(data, colWidths=[3 * inch, 3 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), rlcolors.HexColor("#1E3A8A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), rlcolors.white),
                ("GRID", (0, 0), (-1, -1), 1, rlcolors.black),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    print(f"[INFO] PDF exported successfully.")
    print(f"[INFO] Saved to: {os.path.abspath(filename)}")


def main():
    print(f"\n===== {APP_TITLE.upper()} =====\n")
    try:
        results = _prompt_inputs()
    except ValueError as e:
        print(f"\n[ERROR] Invalid input values: {e}\n")
        return

    _display(results)

    while True:
        print("OPTIONS:")
        print("1 - Copy Results")
        print("2 - Export PDF")
        print("3 - Exit")
        choice = input("\nEnter choice: ").strip()
        if choice == "1":
            _copy_results(results)
        elif choice == "2":
            _export_pdf(results)
        elif choice == "3":
            print("Exiting program...")
            break
        else:
            print("Invalid option.")


if __name__ == "__main__":
    main()
