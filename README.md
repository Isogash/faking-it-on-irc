# Fake It #

Fake It is a simple multiplayer game written in Node.JS which runs as either a
web application or as an IRC bot. Gameplay wise Fake It is a hidden role social
deception game! Each round, one person is secretly chosen at random to specify a
topic. Once the topic is chosen, all other players except one chosen at random
will receive the topic. The players' jobs are to find out who doesn't know the
topic without letting the faker know what the topic is. Players have a limited
amount of time to vote for who might be faking. If a majority decision is made
before the time is up, the game ends and the faker is revealed. Players can
switch votes as many times as they like, but cannot withdraw. If the timer ends
before a majority is reached, the faker wins! Same goes for a vote passing for a
player who is not the faker.

## Installation ##

**General information**

To get the main application set up simply navigate to this repository's root
directory and run `npm install`. If everything goes smooth you are ready to launch
either the server or the IRC bot from the command line. Before this can be done
though you should have a look at the configuration files stored in the *config*
folder.

**IRC Bot**

Once you have had a look at the IRC configuration file (*config/irc.json*) you
can simply run `node irc.js` to start your bot connections.

**Web application**

The web side of this project is currently in development and will come soon.

## License ##

This repository is released under the MIT license. For more information please
refer to [LICENSE](https://github.com/isogash/faking-it-on-irc/blob/master/LICENSE)

Special thanks to [Adam Mitchell](https://github.com/isogash) for starting the project.
