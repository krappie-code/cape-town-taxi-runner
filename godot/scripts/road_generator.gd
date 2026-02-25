extends Node2D
class_name RoadGenerator

## Procedural isometric road segment generation and recycling

# Isometric tile dimensions (2:1 ratio)
const TILE_WIDTH: float = 256.0
const TILE_HEIGHT: float = 128.0

# Road configuration
const ROAD_WIDTH: int = 5  # tiles wide (1 sidewalk + 3 lanes + 1 sidewalk)
const SEGMENT_DEPTH: int = 4  # tiles per segment
const NUM_SEGMENTS: int = 8  # segments in pool
const LANE_COUNT: int = 3

# Lane positions in map coordinates (center of each lane)
var lane_map_positions: Array[float] = [1.0, 2.0, 3.0]

var segments: Array[Node2D] = []
var scroll_offset: float = 0.0
var segment_height_px: float = 0.0


func _ready() -> void:
	segment_height_px = SEGMENT_DEPTH * TILE_HEIGHT
	_create_segments()


func _create_segments() -> void:
	for i in NUM_SEGMENTS:
		var seg = _build_segment()
		seg.position.y = -i * segment_height_px
		segments.append(seg)
		add_child(seg)


func _build_segment() -> Node2D:
	var seg = Node2D.new()
	
	for row in SEGMENT_DEPTH:
		for col in ROAD_WIDTH:
			var tile = Polygon2D.new()
			# Isometric diamond shape
			tile.polygon = PackedVector2Array([
				Vector2(0, -TILE_HEIGHT / 2),
				Vector2(TILE_WIDTH / 2, 0),
				Vector2(0, TILE_HEIGHT / 2),
				Vector2(-TILE_WIDTH / 2, 0),
			])
			
			# Color: sidewalks darker, lanes lighter with lane markings
			if col == 0 or col == ROAD_WIDTH - 1:
				tile.color = Color(0.35, 0.35, 0.38)  # sidewalk
			else:
				tile.color = Color(0.45, 0.45, 0.48)  # road
			
			# Isometric position
			var screen_x = (col - row) * TILE_WIDTH / 2
			var screen_y = (col + row) * TILE_HEIGHT / 2
			tile.position = Vector2(screen_x, screen_y)
			seg.add_child(tile)
		
		# Lane dividers (dashed lines between lanes)
		if row % 2 == 0:
			for lane_div in [1.5, 2.5]:
				var dash = Polygon2D.new()
				dash.polygon = PackedVector2Array([
					Vector2(-15, -3), Vector2(15, -3),
					Vector2(15, 3), Vector2(-15, 3),
				])
				dash.color = Color(1, 1, 1, 0.6)
				var sx = (lane_div - row) * TILE_WIDTH / 2
				var sy = (lane_div + row) * TILE_HEIGHT / 2
				dash.position = Vector2(sx, sy)
				dash.rotation = -0.4636  # atan(TILE_HEIGHT/TILE_WIDTH)
				seg.add_child(dash)
	
	return seg


func scroll(speed: float, delta: float) -> void:
	scroll_offset += speed * delta
	
	for seg in segments:
		seg.position.y += speed * delta
	
	# Recycle segments that scroll past the bottom
	var viewport_h = get_viewport_rect().size.y
	for seg in segments:
		if seg.position.y > viewport_h + segment_height_px:
			# Find the topmost segment
			var min_y = INF
			for s in segments:
				if s.position.y < min_y:
					min_y = s.position.y
			seg.position.y = min_y - segment_height_px


## Convert lane index (0-2) to screen position
func lane_to_screen(lane: int) -> Vector2:
	var map_x = lane_map_positions[clampi(lane, 0, LANE_COUNT - 1)]
	var map_y = float(SEGMENT_DEPTH) / 2.0
	var sx = (map_x - map_y) * TILE_WIDTH / 2
	var sy = (map_x + map_y) * TILE_HEIGHT / 2
	return Vector2(sx, sy)


## Get the isometric Y offset for depth sorting at a given screen Y
func get_depth_y(screen_y: float) -> float:
	return screen_y
