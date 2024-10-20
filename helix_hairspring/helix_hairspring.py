import adsk.core, adsk.fusion, adsk.cam, traceback, math

def mm(cm): return cm / 10  # Conversion function from cm to mm

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = app.activeProduct
        rootComp = design.rootComponent

        # Parameters for the flat spiral (in millimeters)
        R = mm(0.65)  # Inner start radius in mm
        revolutions = 13  # Number of revolutions
        P = mm(0.17)  # Pitch (P) per revolution in mm (radial growth)
        rectWidth = mm(0.05)  # Width of the rectangular profile (in mm)
        rectHeight = mm(0.18)  # Height of the rectangular profile (in mm)

        # 1. Create the flat spiral path on the XY plane
        points_per_revolution = 50
        total_points = revolutions * points_per_revolution
        angle_increment = 2 * math.pi / points_per_revolution

        # Create an object collection to store the points for the spiral
        spiralPoints = adsk.core.ObjectCollection.create()
        guideRailPoints = adsk.core.ObjectCollection.create()  # Points for the guide rail

        for i in range(total_points + 1):
            theta = i * angle_increment  # Current angle in radians
            current_radius = R + P * (theta / (2 * math.pi))  # Linear growth of radius with pitch (P)

            # X and Y coordinates of the flat spiral (Z = 0 for flatness)
            x = current_radius * math.cos(theta)
            y = current_radius * math.sin(theta)
            z = 0  # Flat spiral, no Z height

            # Create points for the spiral and the guide rail
            point = adsk.core.Point3D.create(x, y, z)
            guideRailPoint = adsk.core.Point3D.create(x, y, rectHeight)  # Lift the guide rail along Z

            spiralPoints.add(point)
            guideRailPoints.add(guideRailPoint)

        # Create the 3D spline (flat spiral) using the points in the XY plane
        sketches = rootComp.sketches
        spiralSketch = sketches.add(rootComp.xYConstructionPlane)
        spline = spiralSketch.sketchCurves.sketchFittedSplines.add(spiralPoints)

        # 2. Create the guide rail using the same path but lifted in Z (for control)
        guideRailSketch = sketches.add(rootComp.xYConstructionPlane)
        guideRail = guideRailSketch.sketchCurves.sketchFittedSplines.add(guideRailPoints)

        # 3. Create a construction plane for the rectangular profile
        planes = rootComp.constructionPlanes
        planeInput = planes.createInput()

        # Use the XZ plane and move it to the start point's Z-axis
        startPoint = spiralPoints.item(0)
        planeInput.setByOffset(rootComp.xZConstructionPlane, adsk.core.ValueInput.createByReal(startPoint.y))
        normalPlane = planes.add(planeInput)

        # 4. Create the rectangular profile on the XZ plane
        rectangleSketch = sketches.add(normalPlane)
        rectangleSketch.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(startPoint.x - rectWidth / 2, startPoint.z - rectHeight / 2, 0),
            adsk.core.Point3D.create(startPoint.x + rectWidth / 2, startPoint.z + rectHeight / 2, 0)
        )

        # 5. Sweep the rectangle along the flat spiral using the guide rail
        sweepFeats = rootComp.features.sweepFeatures

        # Create the sweep input with guide rail
        pathInput = rootComp.features.createPath(spline)
        guideRailInput = rootComp.features.createPath(guideRail)  # Guide rail added here
        profile = rectangleSketch.profiles.item(0)
        sweepInput = sweepFeats.createInput(profile, pathInput, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
        sweepInput.guideRail = guideRailInput  # Assign guide rail path to the sweep input

        # Set the sweep options and perform the sweep
        sweepFeats.add(sweepInput)

        ui.messageBox('Sweep with guide rail along flat spiral created successfully.')

    except:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

