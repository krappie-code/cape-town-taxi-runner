@tool
extends SceneTree

func _init():
	# Try to load all scenes and report errors
	var scenes = [
		"res://scenes/main.tscn",
		"res://scenes/road.tscn",
		"res://scenes/player.tscn",
		"res://scenes/obstacle.tscn",
		"res://scenes/passenger.tscn",
		"res://scenes/hud.tscn",
		"res://scenes/menu.tscn",
	]
	
	for path in scenes:
		if ResourceLoader.exists(path):
			var res = ResourceLoader.load(path)
			if res:
				print("OK: ", path)
			else:
				print("FAIL TO LOAD: ", path)
		else:
			print("NOT FOUND: ", path)
	
	# Check autoloads
	var scripts = [
		"res://scripts/game_manager.gd",
		"res://scripts/input_handler.gd",
		"res://scripts/road_generator.gd",
	]
	
	for path in scripts:
		if ResourceLoader.exists(path):
			var res = ResourceLoader.load(path)
			if res:
				print("OK: ", path)
			else:
				print("FAIL TO LOAD: ", path)
		else:
			print("NOT FOUND: ", path)
	
	quit()
