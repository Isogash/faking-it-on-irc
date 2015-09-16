
var irc = require('irc'); // Main IRC interface entry point.

var fakeit_game = require('./game.js'); // Actual game that the IRC interface hooks into.
var config 		= require('./config/irc.json'); // Configuration file for the IRC connection. Used locally.

var bots 	= []; // Stores bot information as well as gamestate specific variables per connection.
var games 	= []; // Stores the currently instantiated games.

var fakeit_irc = {}; // Main IRC interface global. Is passed on when using 'require'.

module.exports = fakeit_irc; // Module export for external use.

// Create a new bot using a network template. Also generates channel game settings.
// This function does not return a bot to extend. It only creates a new IRC connection that interacts with games.
fakeit_irc.newBot = function(network, channel) {
	if(config.servers[network]) {
		// Create a bot for the network if there is none.
		if(!bots[network]) {
			bots[network] = new irc.Client(config.servers[network].server, config.servers[network].nick, config.servers[network]);
		}

		// Create the new game now that the bot has been instantiated.
		fakeit_irc.addGame(network, channel);

	} else {
		console.log(network + ' was not found in the configuration file and will be skipped.\nPlease check if it\'s been added before trying to connect!')
	}
}

// Start a new game.
fakeit_irc.addGame = function(network, channel) {
	if(bots[network]) {
		var gamename = network + '_' + channel;
		var prefix = config.settings.general.commandprefix;
		if(!games[gamename]) {

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
				'idle': 'Use \'play\' to start a new game. You can view the rules at any point using \'rules\'. All commands can also be sent directly to the bot.',
				'lobby': 'Use \'join\' to enter the currently running game. If you are the host you can start and stop the game using the \'start\' and \'stop\' commands. You can view the rules at any point using \'rules\'. All commands can also be sent directly to the bot.',
				'warmup': 'The game is currently waiting for the setter to chose his topic. If you are the setter, message the bot using the topic command and a topic (.topic [topic]). If you are the host you can stop the game using the \'stop\' command. You can view the rules at any point using \'rules\'. All commands can also be sent directly to the bot.',
				'playing': 'To cast a vote for a given player use the \'vote\' command. If you are the host you can stop the game using the \'stop\' command. You can view the rules at any point using \'rules\'. All commands can also be sent directly to the bot.'
			}
			// Main listener function. Receives IRC messages and converts them to possible commands.
			// This needs to be converted to a per channel basis so that games don't intersect.
			bots[network].addListener('message' + channel, function(nick, text) {
				var arguments = text.split(' '); // Split the string to compose message arguments.

				if(arguments[0][0] == prefix) {
					if(!arguments[1]) {
						games[gamename].fire(nick, arguments[0].substring(1));
					} else {
						games[gamename].fire(nick, arguments[0].substring(1), arguments[1]);
					}
				}
			});

			// Message listener. Receives a topic from the designated topic setter.
			bots[network].addListener('pm', function(nick, text) {
				var arguments = text.split(' '); // Split the string to compose message arguments.

				if(arguments[0][0] == config.settings.general.commandprefix) {
					if(!arguments[1]) {
						games[gamename].fireSilent(nick, arguments[0].substring(1));
					} else {
						games[gamename].fireSilent(nick, arguments[0].substring(1), arguments[1]);
					}
				}
			});

			// Logs errors in case any pop up.
			bots[network].addListener('error', function(text) {
				console.log(text);
			});

		} else {
			console.log('There is already a game socket open in the channel of ' + channel + '.');	
		}
	} else {
		console.log('Please create a bot before creating a new game socket.');
	}
}

// Stop a game.
fakeit_irc.delGame = function(network, channel) {
	// TODO
}

// Removes a bot from a channel but keeps the settings.
fakeit_irc.stopBot = function(network, channel) {
	// TODO
}

// Completely deletes a bot and it's settings. Does not require the bot to be active.
fakeit_irc.delBot = function(network, channel) {
	// TODO
}

fakeit_irc.init = function() {
	// We will read the config later on and then connect from there.
	fakeit_irc.newBot("esper", "#fakeit");
}

fakeit_irc.init();