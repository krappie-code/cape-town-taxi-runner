extends CanvasLayer

## HUD overlay — score, speed, passenger count

@onready var score_label: Label = $ScoreContainer/ScoreLabel
@onready var speed_label: Label = $SpeedContainer/SpeedLabel
@onready var passenger_label: Label = $PassengerContainer/PassengerLabel

var displayed_score: int = 0
var target_score: int = 0


func _ready() -> void:
	GameManager.score_changed.connect(_on_score_changed)
	GameManager.speed_changed.connect(_on_speed_changed)
	GameManager.passenger_collected.connect(_on_passenger_collected)
	_update_display()


func _on_score_changed(new_score: int) -> void:
	target_score = new_score


func _on_speed_changed(new_speed: float) -> void:
	var kmh = int(new_speed / 10.0)
	speed_label.text = str(kmh) + " km/h"


func _on_passenger_collected(total: int) -> void:
	passenger_label.text = "🧑 x" + str(total)
	# Punch animation
	var tween = create_tween()
	tween.tween_property(passenger_label, "scale", Vector2(1.3, 1.3), 0.1)
	tween.tween_property(passenger_label, "scale", Vector2.ONE, 0.15)


func _process(delta: float) -> void:
	# Animated score counter
	if displayed_score < target_score:
		displayed_score = mini(displayed_score + maxi(1, int((target_score - displayed_score) * delta * 10)), target_score)
		score_label.text = str(displayed_score)


func _update_display() -> void:
	score_label.text = "0"
	speed_label.text = "0 km/h"
	passenger_label.text = "🧑 x0"


func show_hud() -> void:
	visible = true
	_update_display()
	displayed_score = 0
	target_score = 0


func hide_hud() -> void:
	visible = false
