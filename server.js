var irc = require('irc')
var config = {
    server: 'irc.esper.net',
    nick: 'FakingItBot',
    userName: 'FakingItBot',
    realName: 'Play Faking It using this bot',
    port: 6667,
    debug: true,
    showErrors: true,
    autoRejoin: true,
    autoConnect: true,
    channels: ['#cobalt-spam'],
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
var bot = new irc.Client(config.server, config.nick, config);

var majority_required = true;

//game variables
var channel = config.channels[0];
var players;
var topic = '';
var setter;
var faker;
var gamestate = 'idle';
var timeleft;
var timer;
var required;

bot.addListener('message' + channel, function(from, text) {
    var args = text.split(" ");
    switch (gamestate) {
      case 'idle':
        switch (args[0]) {
          case '.play':
            newgame(from);
            break;
          // case '.help':
          //   bot.say(channel, "If you want to play Faking It, type .play");
          //   break;
          case '.rules':
            bot.say(channel,  "Faking It is a simple hidden role social deception game!\n" +
                              "Each round, one person is secretly chosen at random to choose a topic.\n" + 
                              "When the topic is chosen, all of the other players will be told the\n" + 
                              "topic except one chosen at random (who wasn't the topic setter.)\n" +
                              "The players' jobs are to find who it is who doesn't know the topic\n" +
                              "without letting them know what the topic is. Players have 5 minutes\n" +
                              "to do their detecting and cast their votes. If a majority decision is\n" +
                              "made before the time is up, the game ends and the faker is revealed.\n" +
                              "You may switch votes as many times as you like, but cannot withdraw.\n" +
                              "If the timer ends before a majority is reached, the faker wins!");
            break;
        }
        break;
      case 'lobby':
        switch (args[0]) {
          case '.play':
            joingame(from);
            break;
          case '.start':
            if(players[from] && players[from].host) {
              delete players[from].host;
              warmup(from);
            }
            break;  
        }
        break;
      case 'playing':
        switch (args[0]) {
          case '.vote':
            if(players[from] && args.length > 1) {
              vote(from, args[1]);
            }
            break;
        }
        break;
    }
});

bot.addListener('pm', function(from, text) {
    if(gamestate === 'warmup' && players[from] && players[from].topic) {
      startgame(text);
    }
})

bot.addListener('error', function(message) {
    console.log(message);
});

function newgame(player) {
  gamestate = 'lobby';
  players = {};
  bot.say(channel, player + ' has started a new game of Faking It! Type .play to join!');
  bot.notice(player, 'When you have at least 3 players, type .start to play.');
  joingame(player);
  players[player].host = true;
}

function joingame(player) {
  players[player] = {};
  bot.notice(player, 'You have joined this game! Waiting for host to start.');
}

function warmup(player) {
  if(Object.keys(players).length < 3) {
    bot.notice(player, 'Make sure you have at least 3 players!');
    return;
  }
  gamestate = 'warmup';
  var keys = Object.keys(players);
  setter = keys[Math.floor(Math.random() * keys.length)];
  players[setter].topic = true;
  bot.say(channel, 'A topic setter has been chosen, please wait for them to choose a topic!');
  bot.notice(setter, 'You are the topic setter, type /msg ' + config.nick + ' [your topic]');
}

function startgame(newtopic) {
  gamestate = 'playing';
  topic = newtopic;
  var keys = Object.keys(players);
  required = Math.floor(keys.length / 2) + 1;
  faker = keys[Math.floor(Math.random() * (keys.length - 1))];
  if(players[faker].topic) faker = keys[keys.length - 1];
  players[faker].faker = true;
  bot.say(channel, "The topic has been set, you have 5:00 to figure out who's faking it!");
  for(var player in players) {
    players[player].voted = false;
    players[player].votes = 0;
    if(players[player].faker) {
      bot.notice(player, "The topic is a secret from you. Don't let the others find you out! Good luck!");
    } else {
      bot.notice(player, "The topic is: " + topic);
    }
  }
  bot.say(channel, 'Use .vote [nick] to switch your vote before the time is up! GO!');
  timeleft = 300;
  timer = setInterval(tick, 1000);
}

function tick() {
  timeleft--;
  if(timeleft > 0) {
    if(timeleft % 60 == 0) {
      bot.say(channel, Math.floor(timeleft / 60) + ':00 remaining!');
    }
    switch (timeleft) {
      case 30:
        bot.say(channel, '0:30 remaining! Make sure to vote with .vote [nick]');
        break;
      case 10:
        bot.say(channel, '0:10 remaining! Final chance to .vote [nick]');
        break;
    }
  } else {
    timeout();
  }
}

function vote(player, vote) {
  if(player === vote) {
    bot.notice(player, "You can't vote for yourself!");
  }
  if(players[player].voted) players[players[player].voted].votes--;
  players[player].voted = vote;
  players[vote].votes++;
  if(players[vote].votes < required) {
    bot.say(channel, vote + ' now has ' + players[vote].votes + ' votes. ' + (required - players[vote].votes) + ' more required for a majority.');
  } else {
    bot.say(channel, 'STOP! A majority of ' + required + ' have made their decision, and they were...');
    conclusion(vote);
  }
}

function timeout() {
  bot.say(channel, 'TIMES UP!');
  if(majority_required) {
    bot.say(channel, 'The players failed to reach a majority but it was obvious that ' + faker + ' was faking it the entire time!');
    gameover();
  } else {
    var highest = 0;
    var voted;
    var draw = false;
    for(var player in players) {
      if(players[player].votes == highest) {
        draw = true;
      } else if(players[player].votes > highest) {
        draw = false;
        highest = players[player].votes;
        voted = player;
      }
    }
    if(draw) {
      bot.say(channel, 'The vote was inconclusive but it was obvious that ' + faker + ' was faking it the entire time!');
      gameover();
    } else {
      bot.say(channel, 'The highest number of votes was ' + highest + ', for ' + voted + ', and they were...');
      conclusion(voted);
    }
  }
}

function conclusion(player) {
  if(player === faker) {
    bot.say(channel, 'Correct! ' + faker + ' was faking it the entire time!');
  } else {
    bot.say(channel, 'Wrong! ' + player + ' knew everything! In fact, ' + faker + ' was faking it the entire time!');
  }
  gameover();
}

function gameover() {
  gamestate = 'idle';
  clearInterval(timer);
  bot.say(channel, 'The topic, chosen by ' + setter + ', was: ' + topic);
}