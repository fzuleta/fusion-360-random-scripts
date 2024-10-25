# Adjusting the Python function to account for the updated target power reserve (72 hours), material (Nivaflex), and vph (28,800)
import math

def calculate_mainspring_for_automatic(inner_diameter_of_barrel, barrel_depth, thickness_of_lid, power_reserve_hours, material_factor=1.0):
    """
    Calculate the thickness, length, and width of the mainspring for an automatic movement.
    
    Parameters:
    inner_diameter_of_barrel (float): The inner diameter of the barrel in mm.
    barrel_depth (float): The depth of the barrel in mm.
    thickness_of_lid (float): The thickness of the barrel lid in mm.
    power_reserve_hours (float): The desired power reserve in hours (e.g., 72 hours).
    material_factor (float): A factor to account for the material (default is 1.0 for standard material, adjust for Nivaflex).
    
    Returns:
    dict: A dictionary containing the calculated thickness, length, and width of the mainspring.
    """
    # Adjusting the formula for length based on the desired power reserve
    # Adjust the length based on the formula for longer power reserves
    length = inner_diameter_of_barrel * (45 + (power_reserve_hours - 48) / 24 * 5) * material_factor  # Length formula adjusted for power reserve

    # Calculate mainspring thickness (inner_diameter_of_barrel / 87)
    thickness = inner_diameter_of_barrel / 87 * material_factor  # Thickness adjusted for Nivaflex
    
    # Calculate mainspring width (barrel_depth - thickness_of_lid - 0.1 mm clearance)
    width = barrel_depth - thickness_of_lid - 0.1  # 0.1 mm clearance
    
    return {
        "thickness": round(thickness, 2),
        "length": round(length, 2),
        "width": round(width, 2)
    }

# Example values for automatic movement with 72-hour power reserve and Nivaflex material
inner_diameter_of_barrel = 11.6  # Inner diameter of the barrel in mm
barrel_depth = 1.63  # Barrel depth in mm
thickness_of_lid = 0.2  # Thickness of the lid in mm
power_reserve_hours = 72  # Target power reserve
material_factor = 0.95  # Nivaflex (thinner, more durable material)
# material_factor = 1  # Elinvar or 1095 steel

# Calculate mainspring dimensions for the given specs
mainspring_auto_dimensions = calculate_mainspring_for_automatic(inner_diameter_of_barrel, barrel_depth, thickness_of_lid, power_reserve_hours, material_factor)
print(mainspring_auto_dimensions)