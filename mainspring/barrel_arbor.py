import math
def calculate_arbor_diameter(e1):
    """
    Calculate the arbor diameter (d3) based on the mainspring thickness (e1).
    
    Parameters:
    e1 (float): Thickness of the mainspring in mm.
    
    Returns:
    float: Calculated arbor diameter (d3) in mm.
    """
    d3 = 21 * e1
    # Round down to the nearest multiple of 0.10 mm as per NIHS 11-02 rule
    d3 = round(d3 - (d3 % 0.10), 2)
    return d3

# Example value for e1
e1 = 0.13  # Thickness of the mainspring in mm 

# Calculate the arbor diameter for the given e1 value
arbor_diameter = calculate_arbor_diameter(e1)
print(arbor_diameter)
