import math

def mm(cm): return cm / 10  # Conversion function from cm to mm

# Define the list of numbers extracted from the table
numbers = [
    0.0100, 0.100, 1.00, 10.0, 100,
    0.0106, 0.106, 1.06, 10.6, 106,
    0.0112, 0.112, 1.12, 11.2, 112,
    0.0118, 0.118, 1.18, 11.8, 118,
    0.0125, 0.125, 1.25, 12.5, 125,
    0.0132, 0.132, 1.32, 13.2, 132,
    0.0140, 0.140, 1.40, 14.0, 140,
    0.0150, 0.150, 1.50, 15.0, 150,
    0.0160, 0.160, 1.60, 16.0, 160,
    0.0170, 0.170, 1.70, 17.0, 170,
    0.0180, 0.180, 1.80, 18.0, 180,
    0.0190, 0.190, 1.90, 19.0, 190,
    0.0200, 0.200, 2.00, 20.0, 200,
    0.0212, 0.212, 2.12, 21.2, 212,
    0.0224, 0.224, 2.24, 22.4, 224,
    0.0236, 0.236, 2.36, 23.6, 236,
    0.0250, 0.250, 2.50, 25.0, 250,
    0.0265, 0.265, 2.65, 26.5, 265,
    0.0280, 0.280, 2.80, 28.0, 280,
    0.0300, 0.300, 3.00, 30.0, 300,
    0.0315, 0.315, 3.15, 31.5, 315,
    0.0335, 0.335, 3.35, 33.5, 335,
    0.0355, 0.355, 3.55, 35.5, 355,
    0.0375, 0.375, 3.75, 37.5, 375,
    0.0400, 0.400, 4.00, 40.0, 400,
    0.0425, 0.425, 4.25, 42.5, 425,
    0.0450, 0.450, 4.50, 45.0, 450,
    0.0475, 0.475, 4.75, 47.5, 475,
    0.0500, 0.500, 5.00, 50.0, 500,
    0.0530, 0.530, 5.30, 53.0, 530,
    0.0560, 0.560, 5.60, 56.0, 560,
    0.0600, 0.600, 6.00, 60.0, 600,
    0.0630, 0.630, 6.30, 63.0, 630,
    0.0670, 0.670, 6.70, 67.0, 670,
    0.0710, 0.710, 7.10, 71.0, 710,
    0.0750, 0.750, 7.50, 75.0, 750,
    0.0800, 0.800, 8.00, 80.0, 800,
    0.0850, 0.850, 8.50, 85.0, 850,
    0.0900, 0.900, 9.00, 90.0, 900,
    0.0950, 0.950, 9.50, 95.0, 950
]

# Function to sort the list in ascending order
def sort_numbers_ascending(nums):
    return sorted(nums)

# Function to find the closest number to a given input
def find_closest_number(nums, target):
    return min(nums, key=lambda x: abs(x - target))

def calculate_nihs(I, D, d, f):
    """
    Calculate elastic torque (M), hairspring stiffness (K) in dyne·cm²/rad,
    and K in the units of the NIHS 35-10 table (10^-2 N·mm³/rad).
    Additionally, match the closest K value from the provided CGS table.

    Parameters:
    I (float): Moment of inertia (mg·cm²)
    D (float): Outer diameter of the hairspring (cm)
    d (float): Inner diameter of the hairspring (cm)
    f (float): Frequency (Hz)

    Returns:
    M (float): Elastic torque (mg·cm²·s²/rad)
    K (float): Hairspring stiffness (dyne·cm²/rad)
    K_closest_match (float): Closest CGS value from the table
    """    
    # Calculate elastic torque (M)
    M = I * 4 * math.pi**2 * f**2
    
    # Calculate hairspring stiffness (K) in dyne·cm²/rad
    K = M * (D**2 - d**2)
    
    # Convert K to the table unit (10^-2 N·mm³/rad)
    K_table_units = K * 10**-3
    
    # Find the closest match in the CGS table
    K_closest_match = find_closest_number(sort_numbers_ascending(numbers), K_table_units)
    
    return M, K, K_closest_match

I = 12.5 # mg·cm² 
D = mm(6.0) # cm (This is the outer diameter of the hairspring)
d = mm(1.3) # cm (This is the inner diameter of the hairspring, which corresponds to the attachment at the virole (the collet) that fits at the center of the balance wheel.)
f = 4 # Hz (4=28,800 vph 5=36000)

M, K, K_closest_match = calculate_nihs(I, D, d, f)
print(f"Elastic Torque (M): {M} mg·cm²·s²/rad")
print(f"Hairspring Stiffness (K): {K} dyne·cm²/rad")
print(f"Closest Match from Table: {K_closest_match} (10^-2 N·mm³/rad)")