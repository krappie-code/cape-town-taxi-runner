extends Node2D

## Isometric scrolling road with 3 lanes and infinite scroll

@onready var road_gen: RoadGenerator = $RoadGenerator


func _process(delta: float) -> void:
	if GameManager.state == GameManager.State.PLAYING:
		road_gen.scroll(GameManager.current_speed, delta)


func get_lane_screen_x(lane: int) -> float:
	# Return screen X for lane 0, 1, 2 relative to road center
	return road_gen.lane_to_screen(lane).x
