extends Node

## Global game state manager (autoload singleton)

signal score_changed(new_score: int)
signal speed_changed(new_speed: float)
signal game_state_changed(new_state: String)
signal passenger_collected(total: int)

enum State { MENU, PLAYING, GAME_OVER }

var state: State = State.MENU
var score: int = 0
var high_score: int = 0
var passengers_collected: int = 0
var base_speed: float = 300.0
var current_speed: float = 300.0
var max_speed: float = 800.0
var speed_increment: float = 5.0  # per second of play
var distance_traveled: float = 0.0
var play_time: float = 0.0

# Difficulty scaling
var obstacle_spawn_interval: float = 1.5
var min_spawn_interval: float = 0.4
var passenger_spawn_chance: float = 0.3

const SAVE_PATH = "user://highscore.save"


func _ready() -> void:
	_load_high_score()


func start_game() -> void:
	score = 0
	passengers_collected = 0
	current_speed = base_speed
	distance_traveled = 0.0
	play_time = 0.0
	obstacle_spawn_interval = 1.5
	state = State.PLAYING
	score_changed.emit(score)
	speed_changed.emit(current_speed)
	game_state_changed.emit("playing")


func end_game() -> void:
	state = State.GAME_OVER
	if score > high_score:
		high_score = score
		_save_high_score()
	game_state_changed.emit("game_over")


func go_to_menu() -> void:
	state = State.MENU
	game_state_changed.emit("menu")


func add_score(points: int) -> void:
	score += points
	score_changed.emit(score)


func collect_passenger() -> void:
	passengers_collected += 1
	add_score(50)
	passenger_collected.emit(passengers_collected)


func _process(delta: float) -> void:
	if state != State.PLAYING:
		return
	play_time += delta
	distance_traveled += current_speed * delta
	# Gradually increase speed
	current_speed = min(base_speed + play_time * speed_increment, max_speed)
	speed_changed.emit(current_speed)
	# Increase difficulty
	obstacle_spawn_interval = max(1.5 - play_time * 0.02, min_spawn_interval)
	# Score from distance
	var distance_score = int(distance_traveled / 50.0)
	if distance_score > score - passengers_collected * 50:
		score = distance_score + passengers_collected * 50
		score_changed.emit(score)


func _save_high_score() -> void:
	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_var(high_score)


func _load_high_score() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
		if file:
			high_score = file.get_var()
