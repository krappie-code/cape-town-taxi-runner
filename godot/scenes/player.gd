extends Area2D

## Player taxi with lane switching, jump, and collision

signal hit_obstacle
signal collected_passenger

const LANE_COUNT: int = 3
const LANE_SPACING: float = 128.0  # horizontal spacing between lanes in screen coords

var current_lane: int = 1  # Start in middle lane (0, 1, 2)
var target_x: float = 0.0
var is_jumping: bool = false
var jump_height: float = 0.0
var base_y: float = 0.0

# Smooth movement
var move_tween: Tween = null
const LANE_SWITCH_DURATION: float = 0.2

# Jump parameters
const JUMP_PEAK: float = 120.0
const JUMP_DURATION: float = 0.5

@onready var body: Polygon2D = $Body
@onready var shadow: Polygon2D = $Shadow
@onready var collision: CollisionShape2D = $CollisionShape2D
@onready var exhaust: GPUParticles2D = $Exhaust


func _ready() -> void:
	base_y = position.y
	target_x = _lane_to_x(current_lane)
	position.x = target_x
	
	# Connect input signals
	InputHandler.swipe_left.connect(_on_swipe_left)
	InputHandler.swipe_right.connect(_on_swipe_right)
	InputHandler.swipe_up.connect(_on_jump)
	
	# Connect area signals
	area_entered.connect(_on_area_entered)


func _lane_to_x(lane: int) -> float:
	return (lane - 1) * LANE_SPACING


func switch_lane(direction: int) -> void:
	var new_lane = clampi(current_lane + direction, 0, LANE_COUNT - 1)
	if new_lane == current_lane:
		return
	current_lane = new_lane
	target_x = _lane_to_x(current_lane)
	
	# Smooth tween to new lane
	if move_tween:
		move_tween.kill()
	move_tween = create_tween()
	move_tween.set_ease(Tween.EASE_OUT)
	move_tween.set_trans(Tween.TRANS_CUBIC)
	move_tween.tween_property(self, "position:x", target_x, LANE_SWITCH_DURATION)


func jump() -> void:
	if is_jumping:
		return
	is_jumping = true
	var tween = create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_QUAD)
	tween.tween_property(self, "jump_height", JUMP_PEAK, JUMP_DURATION / 2)
	tween.set_ease(Tween.EASE_IN)
	tween.set_trans(Tween.TRANS_QUAD)
	tween.tween_property(self, "jump_height", 0.0, JUMP_DURATION / 2)
	tween.tween_callback(func(): is_jumping = false)


func _process(_delta: float) -> void:
	# Apply jump offset to visual only (collision stays grounded for potholes)
	body.position.y = -jump_height
	shadow.modulate.a = remap(jump_height, 0, JUMP_PEAK, 0.4, 0.15)
	shadow.scale = Vector2.ONE * remap(jump_height, 0, JUMP_PEAK, 1.0, 1.3)
	
	# Disable collision when jumping high enough (dodge potholes)
	collision.position.y = -jump_height * 0.5


func _on_swipe_left() -> void:
	if GameManager.state == GameManager.State.PLAYING:
		switch_lane(-1)

func _on_swipe_right() -> void:
	if GameManager.state == GameManager.State.PLAYING:
		switch_lane(1)

func _on_jump() -> void:
	if GameManager.state == GameManager.State.PLAYING:
		jump()


func _on_area_entered(area: Area2D) -> void:
	if not GameManager.state == GameManager.State.PLAYING:
		return
	if area.is_in_group("obstacles"):
		if is_jumping and jump_height > JUMP_PEAK * 0.3:
			return  # Jumped over it
		hit_obstacle.emit()
	elif area.is_in_group("passengers"):
		collected_passenger.emit()
		area.collect()
