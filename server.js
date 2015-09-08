var irc = require('irc')

var config = {
	server: "irc.esper.net",
	nick: "FakeItBot",
	userName: "FakeItBot",
	realName: "Play Fake It using this bot",
	port: 6667,
	debug: true,
	showErrors: true,
	autoRejoin: true,
	autoConnect: true,
	channels: ["#fakeit"],
	secure: false,
	selfSigned: false,
	certExpired: false,
	floodProtection: false,
	floodProtectionDelay: 1000,
	sasl: false,
	stripColors: false,
	channelPrefixes: "&#",
	messageSplit: 512
}

// Game variables. Will be handled for each channel the bot is connected to.
var gamevars = {
	channel: config.channels[0],
	players: {},
	host: "",
	topic: "",
	setter: "",
	faker: "",
	gamestate: "idle",
	timeleft: 0,
	timer: 0,
	votemin: 0,
	majority: true
}

var bot = new irc.Client(config.server, config.nick, config);

// Main listener function. Receives IRC messages and converts them to possible commands.
// This needs to be converted to a per channel basis so that games don't intersect.
bot.addListener("message" + gamevars.channel, function(nick, text) {
	var args = text.split(" ");
	switch (gamevars.gamestate) {
		case "idle":
			switch (args[0]) {
				case ".play":
					newgame(nick);
				break;

				case ".help":
					bot.notice(nick, "If you want to play 'Fake It', type '.play'. For rules type '.rules'");
				break;

				case ".rules":
					bot.notice(nick,
						"Faking It is a simple hidden role social deception game! " +
						"Each round, one person is secretly chosen at random to choose a topic. " + 
						"When the topic is chosen, all of the other players will be told the " + 
						"topic except one chosen at random (who wasn't the topic setter.)\n" +
						"The players' jobs are to find who it is who doesn't know the topic " +
						"without letting them know what the topic is. Players have 5 minutes " +
						"to do their detecting and cast their votes. If a majority decision is " +
						"made before the time is up, the game ends and the faker is revealed.\n" +
						"You may switch votes as many times as you like, but cannot withdraw. " +
						"If the timer ends before a majority is reached, the faker wins!"
					);
				break;
			}
		break;

		case "lobby":
			switch (args[0]) {
				case ".play":
					joingame(nick);
				break;

				case ".start":
					if(gamevars.players[nick] && gamevars.players[nick].host) {
						delete gamevars.players[nick].host;
						warmup(nick);
					}
				break; 

				case ".stop":
					if(gamevars.players[nick].host != false) {
						finish();
					}
				break
			}
		break;

		case "playing":
			switch (args[0]) {
				case ".vote":
					if(gamevars.players[nick] && args.length > 1) {
						vote(nick, args[1]);
					}
				break;

				case ".stop":
					if(gamevars.players[nick].host != false) {
						finish();
					}
				break
			}
		break;
	}
});

// Message listener. Receives a topic from the designated topic setter.
bot.addListener("pm", function(nick, text) {
	if(gamevars.gamestate === "warmup" && gamevars.players[nick] && gamevars.players[nick].topic) {
		startgame(text);
	}
});

// Logs errors in case any pop up.
bot.addListener("error", function(message) {
	console.log(message);
});

// Starts a new game by resetting and prompts players to join.
function newgame(nick) {
	gamevars.gamestate = 'lobby';
	gamevars.players = {};

	bot.say(gamevars.channel, nick + " has started a new game of Fake It! Type .play to join!");
	bot.notice(nick, "When you have at least 3 players, type .start to play.");

	gamevars.host = nick;
	gamevars.players[nick] = {};
	gamevars.players[nick].host = true;
}

// Inserts a nick into the player array.
function joingame(nick) {
	gamevars.players[nick] = {};
	bot.notice(nick, "You have joined this game! Waiting for " + gamevars.host + " to start.");
}

function warmup(nick) {
	if(Object.keys(gamevars.players).length < 3) {
		bot.notice(nick, "Make sure you have at least 3 players!");
		return;
	}

	gamevars.gamestate = "warmup";

	var keys = Object.keys(gamevars.players);
	gamevars.setter = keys[Math.floor(Math.random() * keys.length)];
	gamevars.players[gamevars.setter].topic = true;

	bot.say(gamevars.channel, "A topic setter has been chosen, please wait for them to choose a topic!");
	bot.notice(gamevars.setter, "You are the topic setter, type /msg " + config.nick + " [your topic]");
}

function startgame(newtopic) {
	gamevars.gamestate = "playing";
	gamevars.topic = newtopic;
	
	var keys = Object.keys(gamevars.players);
	gamevars.votemin = Math.floor(keys.length / 2) + 1;
	gamevars.faker = keys[Math.floor(Math.random() * (keys.length - 1))];

	if(gamevars.players[gamevars.faker].topic) gamevars.faker = keys[keys.length - 1];
	gamevars.players[gamevars.faker].faker = true;

	bot.say(gamevars.channel, "The topic has been set, you have 5:00 to figure out who's faking it!");

	for(var nick in gamevars.players) {
		gamevars.players[nick].voted = false;
		gamevars.players[nick].votes = 0;

		if(gamevars.players[nick].faker) {
			bot.notice(nick, "The topic is a secret from you. Don't let the others find you out! Good luck!");
		} else {
			bot.notice(nick, "The topic is: " + gamevars.topic);
		}
	}

	bot.say(gamevars.channel, "Use .vote [nick] to switch your vote before the time is up! GO!");
	gamevars.timeleft = 300;
	gamevars.timer = setInterval(tick, 1000);
}

// Tick for the game timer.
function tick() {
	gamevars.timeleft--;

	if(gamevars.timeleft > 0) {
		if(gamevars.timeleft % 60 == 0) {
			bot.say(gamevars.channel, Math.floor(gamevars.timeleft / 60) + ":00 remaining!");
		}

		switch (gamevars.timeleft) {
			case 30:
				bot.say(gamevars.channel, "0:30 remaining! Make sure to vote with .vote [nick]");
			break;

			case 10:
				bot.say(gamevars.channel, "0:10 remaining! Final chance to .vote [nick]");
			break;
		}
	} else {
		timeout();
	}
}

// Handler for the vote command.
function vote(nick, vote) {
	if(!gamevars.players[vote]) {
		bot.notice(nick, "That player does not exist!");
		return
	}

	if(nick === vote) {
		bot.notice(nick, "You can't vote for yourself!");
		return
	}

	if(!gamevars.players[nick].voted) {
		gamevars.players[nick].voted = vote;
		gamevars.players[vote].votes++;
	} else {
		if (gamevars.players[nick].voted != vote) {
			gamevars.players[gamevars.players[nick].voted].votes--;
			gamevars.players[nick].voted = vote;
			gamevars.players[vote].votes++;
		} else {
			bot.notice(nick, "You already voted for that user...");
		}
	}

	if(gamevars.players[vote].votes < gamevars.votemin) {
		bot.say(gamevars.channel, vote + " now has " + gamevars.players[vote].votes + " votes. " + (gamevars.votemin - gamevars.players[vote].votes) + " more required for a majority.");
	} else {
		bot.say(gamevars.channel, "STOP! A majority of " + gamevars.votemin + " players have made their decision, and they were...");
		conclusion(vote);
	}
}

function timeout() {
	bot.say(gamevars.channel, "TIMES UP!");

	if(gamevars.majority) {
		bot.say(gamevars.channel, "The players failed to reach a majority but it was obvious that " + gamevars.faker + " was faking it the entire time!");
		gameover();
	} else {
		var highest = 0;
		var voted = "";
		var draw = false;

		for(var nick in players) {
			if(gamevars.players[nick].votes == highest) {
				draw = true;

			} else if(gamevars.players[nick].votes > highest) {
				draw = false;
				highest = players[nick].votes;
				voted = nick;
			}
		}

		if(draw) {
			bot.say(channel, "The vote was inconclusive but it was obvious that " + gamevars.faker + " was faking it the entire time!");
			gameover();
		} else {
			bot.say(channel, "The highest number of votes was " + highest + ", for " + voted + ", and they were...");
			conclusion(voted);
		}
	}
}

function conclusion(nick) {
	if(nick === gamevars.faker) {
		bot.say(gamevars.channel, "Correct! " + gamevars.faker + " was faking it the entire time!");
	} else {
		bot.say(gamevars.channel, "Wrong! " + nick + " knew everything! In fact, " + gamevars.faker + " was faking it the entire time!");
	}

	gameover();
}

function gameover() {
	bot.say(gamevars.channel, "The topic, chosen by " + gamevars.setter + ", was: " + gamevars.topic);
	finish();
}

function finish() {
	gamevars.gamestate = "idle";
	gamevars.players = {};
	gamevars.host = "";
	gamevars.topic = "";

	clearInterval(gamevars.timer);

	bot.say(gamevars.channel, "The game has been reset.");
}