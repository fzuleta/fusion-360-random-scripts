def find_multipliers(a, b, x, decimals=3, increment=0.01):
    """
    Finds values of `c` within the range from `a` to `b` (incremented by 0.01) such that `x / c`
    is an integer when rounded to the specified number of decimal places.

    Parameters:
    a (float): The starting value of the range.
    b (float): The ending value of the range.
    x (float): The target integer that we want `x / c` to result in an integer.
    decimals (int): Number of decimal places to round `c` and `x / c` to (default is 3).

    Returns:
    list: A list of values for `c` where `x / c` results in an integer, within the specified range.
    
    Example:
    >>> find_multipliers(4, 10, 60, decimals=3)
    [4.0, 5.0, 6.67, ...]
    
    Notes:
    - `c` is incremented by 0.01 in each iteration, rounded to the specified decimal places.
    - The function stops iterating if `c` reaches `b` or if `a * c` exceeds `x`.
    """
    
    c = a
    results = []
    
    while True:
        c = round(c + increment, decimals)  # Increment c and round to specified decimals

        # Check if x divided by c, rounded to 'decimals' places, is an integer
        quotient = round(x / c, decimals)
        if quotient.is_integer():
            results.append([c, quotient])
        
        # Break if we've exceeded the target or the upper limit
        if a * c > x or c >= b:
            break
    
    return results

# Example usage:
multipliers = find_multipliers(4, 20, 60, decimals=3, increment=0.001)
print(multipliers)