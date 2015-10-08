# Fake It #

"Fake it" is a simple multiplayer game written in Node.JS that runs as either a web application or as an IRC bot. To sum it up: "Fake it" is a simple hidden role social deception game! Each round, one person is secretly chosen at random to choose a topic. When the topic is chosen, all of the other players will be told the topic except one player chosen at random. The players' jobs are to find out who doesn't know the topic without letting the so called "Faker" know what the topic is. Players have 5 minutes to do their detecting and cast their votes. If a majority decision is made before the time is up, the game ends and the faker is revealed. Players can switch votes as many times as they like, but cannot withdraw. If the timer ends before a majority is reached, the faker wins!

## Installation ##

**General information**

To get the main application set up simply navigate to this repository's root folder and run `npm install`. If everything goes smooth you are ready to launch either the server or the IRC bot from the command line. Before this can be done though you should have a look at the configuration files stored in the *config* folder.

**IRC Bot**

Once you have had a look at the IRC configuration file (*config/irc.json*) you can simply run `node irc.js` to start your bot connections.

**Web application**

The web side of this project is currently in development and will come soon.

## License ##

This repository is released under the MIT license. For more information please refer to [LICENSE](https://github.com/isogash/faking-it-on-irc/blob/master/LICENSE)

Special thanks to [Adam Mitchell](https://github.com/isogash) for starting the project.