

# 🛠️ Wheel & Pinion G-code Generator for Elara 2 (Mach4)

This project generates precise G-code for cutting watch wheels and pinions using the NSCNC Elara 2 4-axis CNC mill. It supports both wheel and pinion profiles and outputs safe, Mach4-compatible G-code.

---

## 📦 Installation

```bash
npm install
```

---

## 🚀 Usage

### 💡 Run via NPM scripts:

#### ➤ Mill a Wheel

```bash
npm run mill:wheel -- m=0.13 Z=112
```

You can also optionally specify the pinion it mates with:

```bash
npm run mill:wheel -- m=0.13 Z=112 z=14
```

#### ➤ Mill a Pinion

```bash
npm run mill:pinion -- m=0.13 z=10
```

⚠️ Note: When milling a pinion, **only `z=` should be passed**, not `Z=`.

---

## 🧠 How It Works

The script:
- Accepts module (`m`), number of teeth (`Z` for wheel, `z` for pinion)
- Uses pre-defined NIHS geometry factors for tooth shape
- Outputs a G-code sequence that:
  - Homes axes and sets modal states
  - Rotates the A-axis for each tooth
  - Feeds along X using a negative-shape cutter
  - Fully retracts and moves to the next tooth
  - Ends with coolant/spindle off and homing

---

## 🛠 Machine Kinematics

| Axis | Range          | Description                     |
|------|----------------|---------------------------------|
| X    | -200 to 0      | Linear left-right               |
| Y    | 0 to 173.45    | Toward/away from spindle center |
| Z    | -135.131 to 0  | Vertical (spindle)              |
| A    | 0 to 360°      | Rotary axis (parallel to X)     |

- **Spindle:** mounted on Z, facing down.
- **A axis:** rotates the cylindrical stock (wheel or pinion).
- **G54 origin:** center of stock, at the left face of the cylinder.

---

## 📋 G-code Notes

- Includes modal-safe headers (`G90 G94 G40 G49`, etc.)
- Automatically applies tool offset with `G43 Hn`
- Cutting strategy:
  - Rotate to tooth angle
  - Feed cutter in from Y safe zone
  - Cut along X
  - Retract
- Ends with full reset and `M30`

---

## ✏️ Example Output

```gcode
(Milling a wheel with 112 teeth)
G90 G94 G91.1 G40 G49 G17
G21
G28 G91 Z0.
G90
T1 M6
G54
G0 G43 Z-61.78 H1
S10000 M3
M8
G0 A0.
G0 X10.0000 Y-61.78
...
(Tooth 1)
G0 Y-61.78
G0 X10.0000 Z0
G0 A0.0000
G0 Y28.56
G1 X-10 F30
G0 Y-61.78
...
M30
```


