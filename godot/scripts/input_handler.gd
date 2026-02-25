extends Node

## Unified touch + keyboard input with swipe detection

signal swipe_left
signal swipe_right
signal swipe_up
signal tap

var touch_start_pos: Vector2 = Vector2.ZERO
var touch_start_time: float = 0.0
var is_touching: bool = false

const SWIPE_MIN_DISTANCE: float = 50.0
const SWIPE_MAX_TIME: float = 0.5  # seconds
const TAP_MAX_DISTANCE: float = 20.0
const TAP_MAX_TIME: float = 0.3


func _input(event: InputEvent) -> void:
	# Touch / mouse input
	if event is InputEventScreenTouch or event is InputEventMouseButton:
		var pressed: bool
		var pos: Vector2
		if event is InputEventScreenTouch:
			pressed = event.pressed
			pos = event.position
		else:
			pressed = event.pressed
			pos = event.position
		
		if pressed:
			touch_start_pos = pos
			touch_start_time = Time.get_ticks_msec() / 1000.0
			is_touching = true
		elif is_touching:
			is_touching = false
			_process_touch_end(pos)
	
	# Keyboard input
	if event.is_action_pressed("move_left"):
		swipe_left.emit()
	elif event.is_action_pressed("move_right"):
		swipe_right.emit()
	elif event.is_action_pressed("jump"):
		swipe_up.emit()
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ENTER:
		tap.emit()


func _process_touch_end(end_pos: Vector2) -> void:
	var elapsed = Time.get_ticks_msec() / 1000.0 - touch_start_time
	var diff = end_pos - touch_start_pos
	var distance = diff.length()
	
	if distance < TAP_MAX_DISTANCE and elapsed < TAP_MAX_TIME:
		tap.emit()
		return
	
	if distance < SWIPE_MIN_DISTANCE or elapsed > SWIPE_MAX_TIME:
		return
	
	# Determine swipe direction
	if abs(diff.x) > abs(diff.y):
		# Horizontal swipe
		if diff.x < 0:
			swipe_left.emit()
		else:
			swipe_right.emit()
	else:
		# Vertical swipe
		if diff.y < 0:
			swipe_up.emit()
