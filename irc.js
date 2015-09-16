
// TODO: 
// - Game currently crashes because listeners are not removed when the bot parts from a channel.
// - Saving of game settings and channels needs to be implemented.
// - PMs must have a channel added to them to avoid game intersections.
// - Additional admin commands should be added if needed.
// - Hosts should be able to modify game settings.
// - Commenting on the admin verification section.
// - Admin sessions should timeout after a certain amount of time.

var irc = require("irc"); // Main IRC entry point.

var fakeit_game	= require("./game.js"); // Actual game that the IRC interface hooks into.
var config = require("./config/irc.json"); // Configuration file for the IRC connection. Used locally.

// Shorten config variables to make them look less cluttered.
var prefix = config.settings.general.commandprefix;

var admins	= []; // Stores verified admins.
var bots 	= []; // Stores bot information as well as gamestate specific variables per connection.
var games 	= []; // Stores the currently instantiated games.

var fakeit_irc = {}; // Main IRC interface global. Is passed on when using 'require'.

module.exports = fakeit_irc; // Module export for external use.

// Create a new bot using a network template. Also generates channel game settings.
// This function does not return a bot to extend. It only creates a new IRC connection that interacts with games.
// The channel argument is required to assign the bot to a base channel.
fakeit_irc.newBot = function(network) {
	if(config.servers[network]) {
		// Create a bot for the network if there is none.
		if(!bots[network]) {
			bots[network] = new irc.Client(config.servers[network].server, config.servers[network].nick, config.servers[network]);

			// Event listener for admin messages. Precedes all other game related listeners and is solely based on the IRC interface's methods.
			bots[network].addListener("pm", function(nick, text) {
				var arguments = text.split(" "); // Split the string to compose message arguments.

				if(arguments[0][0] == prefix) {
					var command = arguments[0].substring(1);

					if(command == "admin") {
						var name = nick.toLowerCase();

						// If the admin lock is active only allow verification with the fixed names.
						if(config.settings.general.adminlock === true) {
							if(!config.settings.admins[name]) return
						}

						// Check if the admin is already verified.
						if(!admins[name]) {
							if(arguments[1] == "verify") {
								if(config.settings.general.adminlock === false) {
									if(!arguments[2]) {
										bots[network].notice(nick, "Please provide a password when verifying.");
										return
									}

									if(arguments[2] == config.settings.admins[name]) {
										bots[network].notice(nick, "You have been verified for the username of " + nick + "!");
										admins[name] = true;

									} else {
										bots[network].notice(nick, "Please enter a valid key when verifying.");
									}

								} else {
									if(!arguments[2] || !arguments[3]) {
										bots[network].notice(nick, "Please provide a name and a password when verifying.");
										return
									}

									if(config.settings.admins[arguments[2]]) {
										if(arguments[3] == config.settings.admins[arguments[2]]) {
											bots[network].notice(nick, "You have been verified for the username of " + nick + "!");
											admins[name] = true;

										} else {
											bots[network].notice(nick, "Please enter a valid key when verifying.");
										}

									} else {
										bots[network].notice(nick, "Please enter a valid name when verifying.");
									}
								}

							} else {
								bots[network].notice(nick, "Please verify your identity! Example: " + prefix + "admin verify [password]");
							}

						} else {
							if(!arguments[1] || !arguments[2]) {
								bots[network].notice(nick, "Please provide a command and content. Example: " + prefix + "admin join [#channel]");
								return
							}

							if(arguments[1] == "join") {
								fakeit_irc.addGame(network, arguments[2]);

							} else if (arguments[1] == "part") {
								fakeit_irc.stopGame(network, arguments[2]);
							}
						}
					}
				}
			});

		} else {
			console.log(network + " was not found in the configuration file and will be skipped.\nPlease check if it's been added before trying to connect!");
		}
	}
}

// Shuts down a bot.
fakeit_irc.stopBot = function(network) {
	if(bots[network]) {
		bots[network].disconnect("This bot is shutting down.");
		delete bots[network];
	}
}

// Start a new game.
fakeit_irc.addGame = function(network, channel) {
	if(bots[network]) {
		var gamename = network + "_" + channel;

		if(!games[gamename]) {
			// Connect the bot to the new game channel.
			bots[network].join(channel);

			// Create the callback functions. Announce handles public channel messages.
			function announce(content) {
				bots[network].say(channel, content);
			}

			// The message function handles direct player messages.
			function message(nick, content) {
				bots[network].notice(nick, content);
			}

			// Create a new game and pass the callbacks to it.
			games[gamename] = new fakeit_game.Game(announce, message);

			// Edit the help messages to work better with the IRC interface.
			games[gamename].helpMessages = {
				"idle": "Use 'play' to start a new game. You can view the rules at any point using 'rules'. All commands can also be sent directly to the bot using /msg [channel] [command] [content].",
				"lobby": "Use 'join' to enter the currently running game. If you are the host you can start and stop the game using the 'start' and 'stop' commands. You can view the rules at any point using 'rules'. All commands can also be sent directly to the bot using /msg [channel] [command] [content].",
				"warmup": "The game is currently waiting for the setter to chose his topic. If you are the setter, message the bot using the topic command and a topic (.topic [topic]). If you are the host you can stop the game using the 'stop' command. You can view the rules at any point using 'rules'. All commands can also be sent directly to the bot using /msg [channel] [command] [content].",
				"playing": "To cast a vote for a given player use the 'vote' command. If you are the host you can stop the game using the 'stop' command. You can view the rules at any point using 'rules'. All commands can also be sent directly to the bot using /msg [channel] [command] [content]."
			}

			// Main listener function. Receives IRC messages and converts them to possible commands.
			// This needs to be converted to a per channel basis so that games don't intersect.
			bots[network].addListener("message" + channel, function(nick, text) {
				var arguments = text.split(" "); // Split the string to compose message arguments.

				if(arguments[0][0] == prefix) {
					var command = arguments[0].substring(1);

					if(!arguments[1]) {
						games[gamename].fire(nick, command);
					} else {
						games[gamename].fire(nick, command, arguments[1]);
					}
				}
			});

			// Message listener. Receives a topic from the designated topic setter.
			bots[network].addListener("pm", function(nick, text) {
				var arguments = text.split(" "); // Split the string to compose message arguments.

				// TODO: Channel handling.
				if(arguments[0][0] == prefix) {
					var command = arguments[0].substring(1);

					if(!arguments[1]) {
						games[gamename].fireSilent(nick, command);
					} else {
						games[gamename].fireSilent(nick, command, arguments[1]);
					}
				}
			});

			// Logs errors in case any pop up.
			bots[network].addListener("error", function(text) {
				console.log("[ERROR] " + gamename + ": " + text);
			});

		} else {
			console.log("There is already a game socket open in the channel of " + channel + ".");	
		}
	} else {
		console.log("Please create a bot before creating a new game socket.");
	}
}

// Stop a game. Also disconnects the bot from the given channel.
fakeit_irc.stopGame = function(network, channel) {
	var gamename = network + "_" + channel;
	if(games[gamename]) {
		// Reset the game as a precaution to avoid any false data being written.
		games[gamename].reset();

		// Save the game's data.
		fakeit_irc.saveGame(network, channel);

		delete games[gamename];

		// If there are no games left shut down the bot.
		if(games.length == 0 && config.settings.general.nullshutdown === true) {
			fakeit_irc.stopBot(network);
		}
	}
}

fakeit_irc.saveGame = function(network, channel) {
	// TODO
}

fakeit_irc.deleteGame = function(network, channel) {
	// TODO
}

fakeit_irc.init = function() {
	for(var serveralias in config.servers) {
		// Create a new bot connection.
		fakeit_irc.newBot(serveralias);

		var numchannels = 0
		if(config.servers[serveralias].channels.length > 0) {
			for(i = 0; i < config.servers[serveralias].channels.length; i++){
				fakeit_irc.addGame(serveralias, config.servers[serveralias].channels[i]);
			}
		}
	}
}

fakeit_irc.init();