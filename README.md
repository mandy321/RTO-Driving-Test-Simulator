# 🚗 RTO Driving Test Simulator

An interactive, highly polished, browser-based driving test simulator designed according to the Automated Driving Test Track (ADTT) standards. Features realistic top-down rigid-body vehicle kinematics, dual-canvas pixel-level collision detection, traffic cone obstacle courses, and real-time audio synthesis.

## 🔗 Live Application
Play the simulator instantly in your browser:  
👉 **[RTO Driving Test Simulator Live Demo](https://mandy321.github.io/RTO-Driving-Test-Simulator/)**

---

## 🚦 Test Tracks

The simulator features three distinct tracks, each testing different driving proficiencies:

1. **8-Track (Figure 8)**
   - **Proficiency**: Double-curve continuous steering and turning geometry.
   - **Path**: Driver starts on the left loop, completes a figure-8 path crossing through the middle intersection, and parks in the designated green finish zone on the right.
2. **H-Track (Reverse S)**
   - **Proficiency**: Reversing, pocket maneuvers, and tight-corner turning.
   - **Path**: Drive forward from the bottom-left up to the top-left pocket, reverse through the center road into the bottom-right pocket, and drive forward out to the top-right finish.
3. **Parallel Parking**
   - **Proficiency**: Precision reversing and parking alignment.
   - **Path**: Drive forward past the parking bay, reverse back parallel into the designated bay between two parked cars, and align the vehicle parallel to the curb.

---

## 📖 RTO Study Guide & Citizen Rights

To maximize the educational benefit, the sidebar includes an interactive **Study Guide** tab containing:
1. **Traffic Signs Reference**: Vector drawings of standard RTO road signs (Stop, No Entry, Speed Limit 50, Zebra Crossing, No Parking, Silent Zone, One Way, etc.) along with their legal meaning.
2. **Challan Fines Guide**: Breakdown of official penalties under the Motor Vehicles Act (e.g., Driving without License, Speeding, Drunken Driving, Seatbelt/Helmet violations, Mobile usage).
3. **Citizen Rights & Protections**: Vital legal facts for drivers stopped in India:
   - **Challan Authority**: Only a police officer of rank **Sub-Inspector (SI)** or above can collect spot fines. Constables/Head Constables have no authority to issue challans or demand money.
   - **Digital Documents**: DigiLocker and mParivahan digital documents are 100% legally valid (IT Act, Section 4).
   - **Ignition Keys**: Snatching keys out of the ignition or deflating tires is illegal.
   - **Female Driver Protection**: Female drivers cannot be detained or taken to a police station after sunset (6 PM) and before sunrise (6 AM) without a female officer present.

---

## 🎮 Controls

The simulator supports simultaneous keypresses for fluid maneuvering:

| Key | Action |
| --- | --- |
| **`↑` / `W`** | Accelerate (in the direction of selected Gear) |
| **`↓` / `S`** | Brake / Decelerate (stops at 0) |
| **`←` / `A`** | Turn Steering Wheel Left |
| **`→` / `D`** | Turn Steering Wheel Right |
| **`Spacebar`** | Handbrake (heavy deceleration) |
| **`Shift`** | Toggle Transmission Gear: **Drive (D)** ⇄ **Reverse (R)** |
| **`R`** | Restart current simulator test |

*Note: Gear indicators (D / R) on the HUD can also be clicked directly to change gears.*

---

## 🛠️ Technical Specifications

### 1. Vehicle Physics (Ackermann Bicycle Model)
The vehicle's physical model tracks position ($x$, $y$), velocity ($v$), heading angle ($\theta$), and steering wheel angle ($\phi$). The update loops model the center of gravity of the chassis:
$$\beta = \arctan(0.5 \cdot \tan(\phi))$$
$$\frac{dx}{dt} = v \cdot \cos(\theta + \beta)$$
$$\frac{dy}{dt} = v \cdot \sin(\theta + \beta)$$
$$\frac{d\theta}{dt} = \frac{v}{L} \cdot \tan(\phi) \cdot \cos(\beta)$$

- **$\beta$**: Slip angle at center of gravity (COG).
- **$L$**: Wheelbase (Sedan: 36px, Hatchback: 28px).
- Front wheels render steering rotation matching the exact steering angle $\phi$. Rear taillights brighten when braking, and front headlights illuminate the road dynamically.

### 2. Collision & Scoring Engine
- **Boundary Infractions**: Evaluated using an offscreen canvas. Track lines are drawn in solid red. The coordinates of the car's 4 outer corners are computed and scanned against the offscreen map. Touching a line triggers screen flash alerts and boundary penalty tallies. Crossing lines 3 times results in test failure.
- **Obstacle Collisions**: Traffic cones are treated as circles. Car-to-cone collision is evaluated using an **Oriented Bounding Box (OBB) vs Circle** distance algorithm, ensuring precise bumper-to-cone physics. Colliding with a cone causes immediate test failure.
- **Curb Parallelism Check**: The parallel parking test measures the heading angle deviation of the vehicle when stopped inside the parking bay. The driver passes only if the vehicle is parked within $\pm 12.5^\circ$ parallel to the curb.

### 3. Integrated Web Audio Synthesis
All sounds are synthesized natively in real-time using the browser's Web Audio API (no external file assets needed):
- **Engine Sound**: Triangle oscillator pitch modulated by the car's absolute speed.
- **Alerts & Warnings**: High-frequency sine beeps on gear changes or line touches.
- **Crash**: Sawtooth decaying thump sound upon hitting a cone.
- **Test Outcomes**: Arpeggiated synthesizer cords play for PASS or FAIL modal sequences.

---

## 💻 Local Setup & Development

Since this project is built using vanilla HTML5, CSS, and Tailwind CSS (CDN), no installation is required.

1. Clone this repository:
   ```bash
   git clone https://github.com/mandy321/RTO-Driving-Test-Simulator.git
   ```
2. Open `index.html` in your browser.
3. (Optional) Run a local development server:
   ```bash
   python3 -m http.server 8000
   ```
   Then open `http://localhost:8000` in your web browser.

---

## 📜 License
This project is open-source and available under the MIT License.
