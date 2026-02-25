extends Area2D

## Collectible passenger at taxi stop

var speed: float = 0.0
var collected: bool = false

@onready var body: Polygon2D = $Body
@onready var indicator: Polygon2D = $Indicator


func _ready() -> void:
	add_to_group("passengers")


func setup(lane_x: float, start_y: float, scroll_speed: float) -> void:
	position = Vector2(lane_x, start_y)
	speed = scroll_speed


func collect() -> void:
	if collected:
		return
	collected = true
	GameManager.collect_passenger()
	# Animate collection
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "scale", Vector2(1.5, 1.5), 0.2)
	tween.tween_property(self, "modulate:a", 0.0, 0.3)
	tween.chain().tween_callback(queue_free)


func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAYING:
		return
	position.y += speed * delta
	# Bob the indicator
	if indicator:
		indicator.position.y = -45 + sin(Time.get_ticks_msec() / 200.0) * 5.0
	if position.y > get_viewport_rect().size.y + 100:
		queue_free()
