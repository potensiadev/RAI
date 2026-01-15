from PIL import Image, ImageDraw
import math
import os

script_dir = os.path.dirname(os.path.abspath(__file__))

# Render at 4x for antialiasing
render_size = 2048
final_size = 512
s = render_size / 512

img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Deep navy - trustworthy, institutional
navy = (21, 40, 72)

# Rounded rectangle background
corner_radius = int(85 * s)
draw.rounded_rectangle(
    [(0, 0), (render_size-1, render_size-1)],
    radius=corner_radius,
    fill=navy
)

white = (255, 255, 255)

# Parameters
stroke_width = int(54 * s)
half_stroke = stroke_width // 2

center_x = render_size // 2
center_y = render_size // 2

# The S is two arcs that flow into each other
# Top arc opens to the right, bottom arc opens to the left
arc_radius = int(95 * s)

# Position arcs so they connect in the middle
gap = int(8 * s)  # Small gap between arc centers for better S shape
top_arc_cy = center_y - arc_radius + gap
bot_arc_cy = center_y + arc_radius - gap

def draw_smooth_arc(draw, cx, cy, radius, stroke, start_deg, end_deg, color, steps=200):
    """Draw smooth thick arc"""
    outer_r = radius + stroke / 2
    inner_r = radius - stroke / 2

    points = []
    for i in range(steps + 1):
        angle = math.radians(start_deg + (end_deg - start_deg) * i / steps)
        x = cx + outer_r * math.cos(angle)
        y = cy - outer_r * math.sin(angle)
        points.append((x, y))

    for i in range(steps, -1, -1):
        angle = math.radians(start_deg + (end_deg - start_deg) * i / steps)
        x = cx + inner_r * math.cos(angle)
        y = cy - inner_r * math.sin(angle)
        points.append((x, y))

    draw.polygon(points, fill=color)

# Top arc - opening to the right (C shape facing right)
# From 30° (upper right) counterclockwise to 240° (lower left)
draw_smooth_arc(draw, center_x, top_arc_cy, arc_radius, stroke_width, 30, 240, white)

# Bottom arc - opening to the left (C shape facing left)
# From -60° (lower right) counterclockwise to 150° (upper left)
draw_smooth_arc(draw, center_x, bot_arc_cy, arc_radius, stroke_width, -60, 150, white)

# Add rounded end caps at the open ends of the S
# Top-right end of top arc (at 30°)
end1_x = center_x + arc_radius * math.cos(math.radians(30))
end1_y = top_arc_cy - arc_radius * math.sin(math.radians(30))
draw.ellipse([
    end1_x - half_stroke,
    end1_y - half_stroke,
    end1_x + half_stroke,
    end1_y + half_stroke
], fill=white)

# Bottom-left end of bottom arc (at 150°)
end2_x = center_x + arc_radius * math.cos(math.radians(150))
end2_y = bot_arc_cy - arc_radius * math.sin(math.radians(150))
draw.ellipse([
    end2_x - half_stroke,
    end2_y - half_stroke,
    end2_x + half_stroke,
    end2_y + half_stroke
], fill=white)

# Bottom-right end of bottom arc (at -60°)
end3_x = center_x + arc_radius * math.cos(math.radians(-60))
end3_y = bot_arc_cy - arc_radius * math.sin(math.radians(-60))
draw.ellipse([
    end3_x - half_stroke,
    end3_y - half_stroke,
    end3_x + half_stroke,
    end3_y + half_stroke
], fill=white)

# Top-left end of top arc (at 240°)
end4_x = center_x + arc_radius * math.cos(math.radians(240))
end4_y = top_arc_cy - arc_radius * math.sin(math.radians(240))
draw.ellipse([
    end4_x - half_stroke,
    end4_y - half_stroke,
    end4_x + half_stroke,
    end4_y + half_stroke
], fill=white)

# High-quality downscale
img_final = img.resize((final_size, final_size), Image.Resampling.LANCZOS)

output_path = os.path.join(script_dir, 'srchd-icon-512.png')
img_final.save(output_path, 'PNG')
print(f'Icon created: {output_path}')

# 32px favicon
img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
output_path_32 = os.path.join(script_dir, 'srchd-icon-32.png')
img_32.save(output_path_32, 'PNG')
print(f'Favicon created: {output_path_32}')
