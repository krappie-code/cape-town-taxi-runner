extends Node2D

## Game manager scene — state machine (menu/playing/game_over)

@onready var road: Node2D = $Road
@onready var player: Area2D = $Player
@onready var hud = $HUD
@onready var menu = $Menu
@onready var obstacle_timer: Timer = $ObstacleTimer
@onready var camera: Camera2D = $Camera2D
@onready var parallax_bg: ParallaxBackground = $ParallaxBackground

const LANE_SPACING: float = 128.0
var spawn_y: float = -200.0


func _ready() -> void:
	menu.play_pressed.connect(_start_game)
	player.hit_obstacle.connect(_on_hit)
	player.collected_passenger.connect(_on_passenger)
	obstacle_timer.timeout.connect(_spawn_obstacle)
	
	GameManager.game_state_changed.connect(_on_state_changed)
	GameManager.go_to_menu()


func _start_game() -> void:
	# Clear existing obstacles
	get_tree().call_group("obstacles", "queue_free")
	get_tree().call_group("passengers", "queue_free")
	
	player.current_lane = 1
	player.position.x = 0
	player.visible = true
	
	GameManager.start_game()


func _on_hit() -> void:
	_screen_shake()
	GameManager.end_game()


func _on_passenger() -> void:
	# Small positive feedback shake
	_screen_shake(3.0, 0.1)


func _on_state_changed(new_state: String) -> void:
	match new_state:
		"menu":
			menu._reset_labels()
			menu.show_menu()
			hud.hide_hud()
			player.visible = false
			obstacle_timer.stop()
		"playing":
			menu.hide_menu()
			hud.show_hud()
			player.visible = true
			obstacle_timer.start(GameManager.obstacle_spawn_interval)
		"game_over":
			menu.show_game_over()
			obstacle_timer.stop()


func _spawn_obstacle() -> void:
	if GameManager.state != GameManager.State.PLAYING:
		return
	
	var lane = randi() % 3
	var lane_x = (lane - 1) * LANE_SPACING
	
	# Decide: obstacle or passenger
	if randf() < GameManager.passenger_spawn_chance:
		_spawn_passenger(lane_x)
	else:
		_spawn_obstacle_at(lane, lane_x)
	
	# Update timer interval based on difficulty
	obstacle_timer.wait_time = GameManager.obstacle_spawn_interval


func _spawn_obstacle_at(lane: int, lane_x: float) -> void:
	var obs = _create_obstacle_node()
	var type_roll = randf()
	var obs_type: int
	if type_roll < 0.5:
		obs_type = 0  # CAR
	elif type_roll < 0.8:
		obs_type = 1  # POTHOLE
	else:
		obs_type = 2  # VENDOR
	
	obs.setup(obs_type, lane_x, spawn_y, GameManager.current_speed * 0.3)
	add_child(obs)


func _spawn_passenger(lane_x: float) -> void:
	var p = _create_passenger_node()
	p.setup(lane_x, spawn_y, GameManager.current_speed * 0.3)
	add_child(p)


func _create_obstacle_node() -> Area2D:
	var obs = Area2D.new()
	obs.set_script(load("res://scenes/obstacle.gd"))
	
	var body = Polygon2D.new()
	body.name = "Body"
	body.polygon = PackedVector2Array([
		Vector2(0, -30), Vector2(30, 0),
		Vector2(0, 30), Vector2(-30, 0),
	])
	body.color = Color(0.85, 0.15, 0.15)
	obs.add_child(body)
	
	var shape = CollisionShape2D.new()
	var rect = RectangleShape2D.new()
	rect.size = Vector2(50, 50)
	shape.shape = rect
	obs.add_child(shape)
	
	obs.collision_layer = 2
	obs.collision_mask = 1
	
	return obs


func _create_passenger_node() -> Area2D:
	var p = Area2D.new()
	p.set_script(load("res://scenes/passenger.gd"))
	
	var body = Polygon2D.new()
	body.name = "Body"
	body.polygon = PackedVector2Array([
		Vector2(0, -18), Vector2(15, 0),
		Vector2(0, 18), Vector2(-15, 0),
	])
	body.color = Color(0.2, 0.85, 0.3)
	p.add_child(body)
	
	var indicator = Polygon2D.new()
	indicator.name = "Indicator"
	indicator.polygon = PackedVector2Array([
		Vector2(0, -8), Vector2(6, 0),
		Vector2(0, 8), Vector2(-6, 0),
	])
	indicator.color = Color(1, 1, 0.2)
	indicator.position.y = -45
	p.add_child(indicator)
	
	var shape = CollisionShape2D.new()
	var rect = RectangleShape2D.new()
	rect.size = Vector2(30, 30)
	shape.shape = rect
	p.add_child(shape)
	
	p.collision_layer = 4
	p.collision_mask = 1
	
	return p


func _screen_shake(intensity: float = 8.0, duration: float = 0.3) -> void:
	var original = camera.offset
	var tween = create_tween()
	for i in 6:
		var offset = Vector2(randf_range(-intensity, intensity), randf_range(-intensity, intensity))
		tween.tween_property(camera, "offset", offset, duration / 6.0)
	tween.tween_property(camera, "offset", original, duration / 6.0)


func _process(_delta: float) -> void:
	# Scroll parallax with game speed
	if GameManager.state == GameManager.State.PLAYING:
		parallax_bg.scroll_offset.y += GameManager.current_speed * _delta * 0.5
