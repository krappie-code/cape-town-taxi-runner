extends Area2D

## Spawnable obstacle — other cars, potholes, street vendors

enum ObstacleType { CAR, POTHOLE, VENDOR }

var obstacle_type: ObstacleType = ObstacleType.CAR
var speed: float = 0.0

@onready var body: Polygon2D = $Body


func _ready() -> void:
	add_to_group("obstacles")
	_setup_visual()


func setup(type: ObstacleType, lane_x: float, start_y: float, scroll_speed: float) -> void:
	obstacle_type = type
	position = Vector2(lane_x, start_y)
	speed = scroll_speed


func _setup_visual() -> void:
	match obstacle_type:
		ObstacleType.CAR:
			body.color = Color(0.85, 0.15, 0.15)  # Red car
			body.polygon = PackedVector2Array([
				Vector2(0, -30), Vector2(30, 0),
				Vector2(0, 30), Vector2(-30, 0),
			])
		ObstacleType.POTHOLE:
			body.color = Color(0.2, 0.2, 0.2)  # Dark pothole
			body.polygon = PackedVector2Array([
				Vector2(0, -15), Vector2(25, 0),
				Vector2(0, 15), Vector2(-25, 0),
			])
		ObstacleType.VENDOR:
			body.color = Color(0.9, 0.5, 0.1)  # Orange vendor
			body.polygon = PackedVector2Array([
				Vector2(0, -20), Vector2(20, 0),
				Vector2(0, 20), Vector2(-20, 0),
			])


func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAYING:
		return
	position.y += speed * delta
	# Remove when off screen
	if position.y > get_viewport_rect().size.y + 100:
		queue_free()
