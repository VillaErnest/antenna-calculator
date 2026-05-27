import json
import numpy as np
import scipy.constants as const


# =====================================================================
# MATHEMATICAL ENGINE
# =====================================================================

class YagiCalculator:
    def __init__(self, freq_mhz, len_driven, len_reflector, len_directors, spacings, radius_mm, conductivity):
        self.freq = freq_mhz * 1e6
        self.wl = const.c / self.freq
        self.k = 2 * np.pi / self.wl
        self.a = radius_mm * 1e-3
        self.sigma = conductivity

        self.lengths = [len_reflector, len_driven] + len_directors
        self.N = len(self.lengths)

        self.positions = [0.0]
        current_x = 0.0
        for space in spacings:
            current_x += space
            self.positions.append(current_x)

        self.I = self._solve_currents()

    def _calc_mutual_impedance(self, L1, L2, d):
        eta = const.physical_constants['characteristic impedance of vacuum'][0]

        # Vectorised trapezoidal integration — avoids per-point Python callbacks
        # that make scipy.integrate.quad slow inside Pyodide.
        n = 300
        z2 = np.linspace(-L2 / 2, L2 / 2, n)

        r1 = np.sqrt(d**2 + (z2 - L1 / 2)**2)
        r2 = np.sqrt(d**2 + (z2 + L1 / 2)**2)
        r0 = np.sqrt(d**2 + z2**2)

        Ez = (-1j * eta / (4 * np.pi)) * (
            np.exp(-1j * self.k * r1) / r1
            + np.exp(-1j * self.k * r2) / r2
            - 2 * np.cos(self.k * L1 / 2) * np.exp(-1j * self.k * r0) / r0
        )

        I2 = np.sin(self.k * (L2 / 2 - np.abs(z2)))
        integral = np.trapz(Ez * I2, z2)

        norm = np.sin(self.k * L1 / 2) * np.sin(self.k * L2 / 2)
        if abs(norm) < 1e-10:
            norm = 1e-10

        return -integral / norm

    def _solve_currents(self):
        Z = np.zeros((self.N, self.N), dtype=complex)
        for i in range(self.N):
            for j in range(self.N):
                if i == j:
                    Z[i, j] = self._calc_mutual_impedance(self.lengths[i], self.lengths[i], self.a)
                else:
                    d = abs(self.positions[i] - self.positions[j])
                    Z[i, j] = self._calc_mutual_impedance(self.lengths[i], self.lengths[j], d)
        V = np.zeros(self.N, dtype=complex)
        V[1] = 1.0 + 0j
        return np.linalg.solve(Z, V)

    def get_input_impedance(self):
        return 1.0 / self.I[1]

    def calculate_2d_patterns(self, points=360):
        alpha = np.linspace(0, 2 * np.pi, points)
        U_E = np.zeros_like(alpha, dtype=complex)
        U_H = np.zeros_like(alpha, dtype=complex)

        for n in range(self.N):
            E_el_E = (np.cos(self.k * self.lengths[n] / 2 * np.sin(alpha)) - np.cos(self.k * self.lengths[n] / 2)) / (np.cos(alpha) + 1e-10)
            AF_E = np.exp(1j * self.k * self.positions[n] * np.cos(alpha))
            U_E += self.I[n] * E_el_E * AF_E

            E_el_H = 1 - np.cos(self.k * self.lengths[n] / 2)
            AF_H = np.exp(1j * self.k * self.positions[n] * np.cos(alpha))
            U_H += self.I[n] * E_el_H * AF_H

        return alpha, np.abs(U_E)**2, np.abs(U_H)**2

    def get_directivity(self):
        theta = np.linspace(0, np.pi, 60)
        phi = np.linspace(0, 2 * np.pi, 90)
        THETA, PHI = np.meshgrid(theta, phi)

        U_3D = np.zeros_like(THETA, dtype=complex)
        for n in range(self.N):
            numerator = np.cos(self.k * self.lengths[n] / 2 * np.cos(THETA)) - np.cos(self.k * self.lengths[n] / 2)
            E_el = numerator / (np.sin(THETA) + 1e-10)
            AF = np.exp(1j * self.k * self.positions[n] * np.sin(THETA) * np.cos(PHI))
            U_3D += self.I[n] * E_el * AF

        U = np.abs(U_3D)**2
        U_max = np.max(U)

        d_theta = theta[1] - theta[0]
        d_phi = phi[1] - phi[0]
        P_rad = np.sum(U * np.sin(THETA)) * d_theta * d_phi

        D = 4 * np.pi * U_max / P_rad
        return D, 10 * np.log10(D)

    def get_efficiency(self):
        R_rad = np.real(self.get_input_impedance())
        R_loss = (self.lengths[1] / (4 * np.pi * self.a)) * np.sqrt(
            (np.pi * self.freq * const.mu_0) / self.sigma
        )
        return R_rad / (R_rad + R_loss)


# =====================================================================
# WEB INTERFACE
# =====================================================================

MATERIALS = {
    "copper":   5.96e7,
    "aluminum": 3.50e7,
    "silver":   6.30e7,
}


def _to_db_list(U):
    U_n = U / max(float(np.max(U)), 1e-30)
    U_n = np.maximum(U_n, 1e-10)
    return (10 * np.log10(U_n)).tolist()


def compute(freq_mhz, len_driven, len_reflector, len_directors, spacings,
            radius_mm, material="copper"):
    # Coerce iterables (handles Pyodide JsProxy as well as plain lists)
    len_directors = [float(x) for x in len_directors]
    spacings = [float(x) for x in spacings]

    n_dirs = len(len_directors)
    n_spaces = len(spacings)
    expected_spaces = 1 + n_dirs
    if n_spaces != expected_spaces:
        raise ValueError(
            f"Need exactly {expected_spaces} spacing(s) for {n_dirs} director(s), "
            f"got {n_spaces}."
        )

    conductivity = MATERIALS.get(str(material).lower(), MATERIALS["copper"])

    calc = YagiCalculator(
        float(freq_mhz),
        float(len_driven),
        float(len_reflector),
        len_directors,
        spacings,
        float(radius_mm),
        conductivity,
    )

    Zin = calc.get_input_impedance()
    D_linear, D_db = calc.get_directivity()
    eff = calc.get_efficiency()
    G_linear = max(eff * D_linear, 1e-30)
    G_db = 10 * np.log10(G_linear)

    alpha, U_E, U_H = calc.calculate_2d_patterns(181)

    return {
        "zin_real":          float(np.real(Zin)),
        "zin_imag":          float(np.imag(Zin)),
        "directivity_linear": float(D_linear),
        "directivity_db":    float(D_db),
        "efficiency_pct":    float(eff * 100),
        "gain_db":           float(G_db),
        "pattern_theta_deg": (alpha * 180.0 / np.pi).tolist(),
        "pattern_e_plane_db": _to_db_list(U_E),
        "pattern_h_plane_db": _to_db_list(U_H),
    }


# =====================================================================
# CLI
# =====================================================================

def _get_input(prompt, default):
    user_input = input(f"{prompt} [{default}]: ").strip()
    return user_input if user_input else default


def main():
    print("=" * 60)
    print("   YAGI-UDA ANTENNA CALCULATOR")
    print("=" * 60)
    print("Press ENTER to use the default values shown in [].\n")

    try:
        freq    = float(_get_input("Frequency (MHz)", "432.0"))
        len_ref = float(_get_input("Reflector length (m)", "0.34"))
        len_drv = float(_get_input("Driven element length (m)", "0.33"))

        dir_str  = _get_input("Director lengths (m, comma-separated)", "0.31, 0.30, 0.29")
        len_dirs = [float(x.strip()) for x in dir_str.split(",") if x.strip()]

        sp_str   = _get_input("Spacings (m, comma-separated)", "0.15, 0.12, 0.12, 0.12")
        spacings = [float(x.strip()) for x in sp_str.split(",") if x.strip()]

        radius = float(_get_input("Wire radius (mm)", "2.0"))

        print("\nMaterial:")
        print("  1. Copper   (5.96e7 S/m)")
        print("  2. Aluminum (3.50e7 S/m)")
        print("  3. Silver   (6.30e7 S/m)")
        mat_map = {"1": "copper", "2": "aluminum", "3": "silver"}
        material = mat_map.get(_get_input("Choice (1/2/3)", "1"), "copper")

        print("\nCalculating... please wait.\n")

        result = compute(freq, len_drv, len_ref, len_dirs, spacings, radius, material)

        zin_sign = "+" if result["zin_imag"] >= 0 else ""
        print(f"  Input Impedance  : {result['zin_real']:.2f} {zin_sign}{result['zin_imag']:.2f}j Ω")
        print(f"  Directivity      : {result['directivity_db']:.2f} dBi")
        print(f"  Gain             : {result['gain_db']:.2f} dBi")
        print(f"  Efficiency       : {result['efficiency_pct']:.2f} %")

        show = _get_input("\nVisualize radiation patterns? (y/n)", "y").lower()
        if show == "y":
            try:
                import matplotlib.pyplot as plt
            except ImportError:
                print("matplotlib not available.")
                return

            alpha_deg = result["pattern_theta_deg"]
            alpha_rad = [x * np.pi / 180 for x in alpha_deg]
            U_E_db = result["pattern_e_plane_db"]
            U_H_db = result["pattern_h_plane_db"]

            fig, (ax1, ax2) = plt.subplots(1, 2, subplot_kw={"projection": "polar"}, figsize=(10, 5))
            ax1.plot(alpha_rad, U_E_db, color="blue", linewidth=2)
            ax1.fill(alpha_rad, U_E_db, color="blue", alpha=0.15)
            ax1.set_title("E-Plane (dB)", pad=20)
            ax2.plot(alpha_rad, U_H_db, color="red", linewidth=2)
            ax2.fill(alpha_rad, U_H_db, color="red", alpha=0.15)
            ax2.set_title("H-Plane (dB)", pad=20)
            for ax in (ax1, ax2):
                ax.set_rticks([-20, -10, 0])
                ax.set_rlabel_position(45)
            plt.tight_layout()
            plt.show()

    except ValueError as e:
        print(f"\n[!] Input error: {e}")
    except Exception as e:
        print(f"\n[!] Unexpected error: {e}")


if __name__ == "__main__":
    main()
