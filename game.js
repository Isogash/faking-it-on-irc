
var fakeit_game = {}; // Main module to contain the game functions. Used by the IRC and server interfaces.

var debug = false; // If true will notify the console about missfired events.

module.exports = fakeit_game; // Module export for external use.

// Helper function to convert seconds into a nice timestamp.
function mmss(secs) {
	var minutes = Math.floor(secs / 60);
	minutes = minutes % 60;
	secs = secs % 60;

	return minutes + ":" + ("0" + secs).slice(-2)
}

// Creates a new game object.
// pubfunc is the callback that handles public messages while pvtfunc handles direct player messages.
// All outside interaction should be done through the 'fire' method to insure gamestate handling.
fakeit_game.Game = function(pubfunc, pvtfunc) {
	// Check if the callback functions were supplied.
	if(!pubfunc || !pvtfunc) {
		console.log("Please make sure that your message callbacks are specified correctly.");
		console.log("Aborting game creation...");
		return
	}

	var game = {} // The new game object that will be returned.

	// Assignment of public and private message callbacks.
	game.announce = pubfunc;
	game.message = pvtfunc;

	// General game settings.
	game.gametopic = "";
	game.gamestate = "idle";
	game.timeleft = 0;
	game.timer = 0;

	// Players and game roles.
	game.players = {};
	game.hostid = "";
	game.setterid = "";
	game.fakerid = "";

	// Custom game options.
	game.votemin = 0;
	game.timelimit = 300;
	game.majority = true;

	// Object containing the game states and their help messages. Can be overridden.
	game.helpMessages = {
		"idle": "",
		"lobby": "",
		"warmup": "",
		"playing": ""
	}

	// ------------- Game state based commands --------------- //

	// These methods should in theory never be called from the outside. Use the 'fire' and 'fireSilent' methods instead.

	// Displays help based on the current game state.
	game.showHelp = function(player) {
		// Send basic game information to the player. Build a string of information.
		var information = "The game's current mode is: " + game.gamestate;
		if(game.players[player]) {
			if(game.players[player].isHost) information += " | You are this game's host!";
			if(game.players[player].isSetter) information += " | You are this game's topic setter.";
			if(game.players[player].isFaker) information += " | You do not have the game's topic and are faking it! Don't let anyone know!";

		} else {
			information += " | You are not in the game.";
		}

		game.message(player, information);

		// Send the help string to the player if it exists.
		var helpstring = game.helpMessages[game.gamestate];
		if(helpstring) game.message(player, helpstring);
	}

	// Message a given player with the game rules.
	game.showRules = function(player) {
		game.message(player,
			"Fake It is a simple hidden role social deception game! Each round, " +
			"one person is secretly chosen at random to choose a topic. When the " +
			"topic is chosen, all of the other players will be told the topic except " +
			"one chosen at random (who wasn\'t the topic setter.)\nThe players' jobs " +
			"are to find who it is who doesn\'t know the topic without letting them " +
			"know what the topic is. Players have 5 minutes to do their detecting " +
			"and cast their votes.\nIf a majority decision is made before the time " +
			"is up, the game ends and the faker is revealed. You may switch votes " +
			"as many times as you like, but cannot withdraw. If the timer ends before " +
			"a majority is reached, the faker wins!"
		);
	}

	// When called starts a new game by resetting and prompts players to join.
	// The player specified is the new host.
	game.launch = function(player) {
		game.gamestate = "lobby";
		game.players = {};

		game.announce(player + " has started a new game of Fake It! Join now!");
		game.message(player, "You can start the game once you have at least 3 players.");

		game.hostid = player;
		game.players[player] = {};

		game.players[player].isHost = true;
	}

	// The player specified is entered in the game.
	game.join = function(player) {
		if(!game.players[player]) {
			game.players[player] = {};
			game.message(player, "You have joined this game! Waiting for " + game.hostid + " to start.");

		} else {
			if(game.players[player].isHost) {
				game.message(player, "You can not join again - you are the host!");

			} else {
				game.message(player, "You are already in the game. Please wait for the host to begin!");
			}
		}
	}

	// Warmup section. A game topic setter is chosen.
	game.warmup = function(player) {
		if(game.players[player].isHost) {
			if(Object.keys(game.players).length < 3) {
				game.message(player, "Make sure you have at least 3 players!");
				return
			}

			game.gamestate = "warmup";

			var keys = Object.keys(game.players);
			game.setterid = keys[Math.floor(Math.random() * keys.length)];
			game.players[game.setterid].isSetter = true;

			game.announce("A topic setter has been chosen, please wait for them to choose a topic!");
			game.message(game.setterid, "You are the topic setter!");

		} else {
			game.message(player, "Only the host is allowed to start the game!");
		}
	}

	// Starts a new game after the topic setter has selected his topic.
	game.begin = function(player, topic){
		if(game.players[player]) {
			if(game.players[player].isSetter) {
				if(topic == "") {
					game.message(player, "Please enter a valid non empty topic for the game to begin!");

				} else {
					game.gametopic = topic;
					game.gamestate = "playing";
			
					var keys = Object.keys(game.players);
					game.votemin = Math.floor(keys.length / 2) + 1;
					game.fakerid = keys[Math.floor(Math.random() * (keys.length - 1))];

					if(game.players[game.fakerid].isSetter) game.fakerid = keys[keys.length - 1];

					game.players[game.fakerid].isFaker = true;

					game.announce("The topic has been set, you have " + mmss(game.timelimit) + " to figure out who's faking it!");

					for(var id in game.players) {
						game.players[id].voted = false;
						game.players[id].votes = 0;

						if(game.players[id].isFaker) {
							game.message(id, "The topic is a secret from you. Don't let the others find out! Good luck!");
						} else {
							game.message(id, "The topic is: " + game.gametopic);
						}
					}

					game.announce("You can always switch your vote before the time is up!");
					game.timeleft = game.timelimit;
					game.timer = setInterval(game.tick, 1000);
				}

			} else {
				game.message(player, "Sorry you are not the setter. Just sit tight!");
			}

		} else {
			game.message(player, "You are not part of the game! You can join in the next round.");
		}
	}

	// Handler for the vote command.
	game.vote = function(player, vote) {
		if(game.players[player]) {
			if(!vote) {
				game.message(player, "Please specify a player!");
				return
			}

			if(!game.players[vote]) {
				game.message(player, "That player does not exist!");
				return
			}

			if(player === vote) {
				game.message(player, "You can't vote for yourself!");
				return
			}

			if(!game.players[player].voted) {
				game.players[player].voted = vote;
				game.players[vote].votes++;

			} else {
				if (game.players[player].voted != vote) {
					game.players[game.players[player].voted].votes--;
					game.players[player].voted = vote;
					game.players[vote].votes++;

				} else {
					game.message(player, "You already voted for that user...");
				}
			}

			if(game.players[vote].votes < game.votemin) {
				game.announce(vote + " received a vote from " + player + " and now has a total of " + game.players[vote].votes + " votes. " + (game.votemin - game.players[vote].votes) + " more are required for a majority.");

			} else {
				game.announce("STOP! " + player + " has voted, creating a majority of " + game.votemin + " players to have made their decision, and they were...");
				game.conclusion(vote);
			}
		} else {
			game.message(player, "You are not part of the game! You can join in the next round.");
		}
	}

	// Player game resetting function.
	game.playerReset = function(player) {
		if(game.players[player].isHost) {
			// Perform the reset and announce it to the other players.
			game.announce("The game has been reset by the host, " + game.hostid + ".");
			game.reset();

		} else {
			game.message(player, "Sorry you are not allowed to execute this command.");
		}
	}

	// Resets game values and prepares the game for the next launch.
	game.reset = function() {
		// Reset variables.
		game.gamestate = "idle";
		game.players = {};
		game.hostid = "";
		game.gametopic = "";

		// Disable the timer.
		clearInterval(game.timer);
	}

	// ------------- Game flow and announcement functions --------------- //

	// Gameover announcement function. Calls 'reset' to reset the game.
	game.gameover = function() {
		game.announce("The topic, chosen by " + game.setterid + ", was: " + game.gametopic);
		game.reset();
	}

	// Evaluation function that announces the game's outcome. The player specified is that player received the most votes.
	game.conclusion = function(suspect) {
		if(suspect === game.fakerid) {
			game.announce("Correct! " + game.fakerid + " was faking it the entire time!");
		} else {
			game.announce("Wrong! " + suspect + " knew everything! In fact, " + game.fakerid + " was faking it the entire time!");
		}

		game.gameover();
	}

	// Function called when the game hits the time limit.
	game.timeout = function() {
		game.announce("TIMES UP!");

		if(game.majority) {
			game.announce("The players failed to reach a majority but it was obvious that " + game.fakerid + " was faking it the entire time!");
			game.gameover();

		} else {
			var highest = 0;
			var voted = "";
			var draw = false;

			for(var id in game.players) {
				if(game.players[id].votes == highest) {
					draw = true;

				} else if(game.players[id].votes > highest) {
					draw = false;
					highest = game.players[id].votes;
					voted = id;
				}
			}

			if(draw) {
				game.announce("The vote was inconclusive but it was obvious that " + game.isFaker + " was faking it the entire time!");
				game.gameover();

			} else {
				game.announce("The highest number of votes was " + highest + ", for " + voted + ", and they were...");
				game.conclusion(voted);
			}
		}
	}

	// Timer function.
	game.tick = function() {
		game.timeleft--;

		if(game.timeleft > 0) {
			if(game.timeleft % 60 == 0) {
				game.announce(Math.floor(game.timeleft / 60) + ":00 remaining!");
			}

			switch (game.timeleft) {
				case 30:
					game.announce("0:30 remaining!");
				break;

				case 10:
					game.announce("0:10 remaining! Final chance to vote!");
				break;
			}
		} else {
			game.timeout();
		}
	}

	// ------------------ Event handler ---------------------- //

	// Game event tree. Is used by the 'fire' method to handle game logic. Can be extended.
	// Commands with the '&' can only be called outside of the main chat.
	game.logictree = {
		"idle": {
			"fakeit": game.launch,
			"rules": game.showRules,
			"help": game.showHelp,
		},

		"lobby": {
			"join": game.join,
			"start": game.warmup,
			"stop": game.playerReset,
			"rules": game.showRules,
			"help": game.showHelp
		},

		"warmup": {
			"&topic": game.begin,
			"rules": game.showRules,
			"stop": game.playerReset,
			"help": game.showHelp
		},

		"playing": {
			"vote": game.vote,
			"stop": game.playerReset,
			"rules": game.showRules,
			"help": game.showHelp
		}
	};

	// Displays a list of available commands. Takes in a second argument as the optional command prefix.
	game.showCommands = function(player, prefix) {
		if(!prefix) prefix = "";

		game.message(player, prefix + Object.keys(game.logictree[game.gamestate]).join().replace(/,/g, " " + prefix));
	}

	// Sends a command with content to a game to interpret depending on the gamestate.
	game.fire = function(player, name, content) {
		if(player && name) { // Make sure the arguments were supplied.
			// Check if an entry with the given name exists in the current gamestate.
			if(game.logictree[game.gamestate][name]) {
				if(content === null) content = "";

				return game.logictree[game.gamestate][name](player, content);

			} else {
				if(debug) console.log("The current gamestate of '" + game.gamestate + "' does not contain an entry for the command of " + name);
			}

		} else {
			if(debug) console.log("Please fill at least the 'name' and 'player' arguments required by the 'fire' method.");
		}
	}

	// Silent assumes that it received the command outside of the main game chat meaning it is to be handled in a special way.
	// However, normal commands can also be sent this way.
	game.fireSilent = function(player, name, content) {
		if(player && name) { // Make sure the arguments were supplied.
			if(game.logictree[game.gamestate][name]) {
				if(content === null) content = "";

				return game.logictree[game.gamestate][name](player, content);

			} else if(game.logictree[game.gamestate]["&" + name]) {
				if(content === null) content = "";

				return game.logictree[game.gamestate]["&" + name](player, content);

			} else {
				if(debug) console.log("The current gamestate of '" + game.gamestate + "' does not contain an entry for the command of " + name);
			}

		} else {
			if(debug) console.log("Please fill at least the 'name' and 'player' arguments required by the 'fireSilent' method.");
		}
	}

	return game
}