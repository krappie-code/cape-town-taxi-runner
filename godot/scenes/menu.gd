extends Control

## Start screen with title, high score, and play button

@onready var title_label: Label = $VBoxContainer/TitleLabel
@onready var subtitle_label: Label = $VBoxContainer/SubtitleLabel
@onready var high_score_label: Label = $VBoxContainer/HighScoreLabel
@onready var play_button: Button = $VBoxContainer/PlayButton
@onready var tap_label: Label = $VBoxContainer/TapLabel

signal play_pressed


func _ready() -> void:
	play_button.pressed.connect(_on_play)
	InputHandler.tap.connect(_on_tap)
	_animate_title()


func show_menu() -> void:
	visible = true
	high_score_label.text = "HIGH SCORE: " + str(GameManager.high_score)
	_animate_title()


func show_game_over() -> void:
	visible = true
	title_label.text = "GAME OVER"
	subtitle_label.text = "Score: " + str(GameManager.score)
	high_score_label.text = "HIGH SCORE: " + str(GameManager.high_score)
	tap_label.text = "TAP TO RETRY"
	play_button.text = "▶ RETRY"


func hide_menu() -> void:
	visible = false


func _on_play() -> void:
	play_pressed.emit()


func _on_tap() -> void:
	if visible and (GameManager.state == GameManager.State.MENU or GameManager.state == GameManager.State.GAME_OVER):
		play_pressed.emit()


func _animate_title() -> void:
	if title_label:
		title_label.modulate.a = 0
		var tween = create_tween()
		tween.tween_property(title_label, "modulate:a", 1.0, 0.8)
	if tap_label:
		# Pulsing "tap to play" text
		var pulse = create_tween().set_loops()
		pulse.tween_property(tap_label, "modulate:a", 0.3, 1.0)
		pulse.tween_property(tap_label, "modulate:a", 1.0, 1.0)


func _reset_labels() -> void:
	title_label.text = "CAPE TOWN\nTAXI RUNNER"
	subtitle_label.text = "Dodge. Collect. Survive."
	tap_label.text = "TAP TO PLAY"
	play_button.text = "▶ PLAY"
