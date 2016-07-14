## Live demo
Please follow [this link][live-demo].

## Stuff used
Some things worth mentioning are:

* AudioContext is used to make and play sounds.
* A web worker is used to get precise timing - with a regular setInterval as fallback.
* Suspend and resume of AudioContext is done when available. This can potentially save some resources.
* The canvas animation is synced precisely to the sounds by using the AudioContext current time to time the animation.
* Local storage is used to store and retrieve tempo when available.
* The main parts of the java script app are written in typescript.

## Developing

After cloning the repo run 
```
npm install
```
in the terminal to install dependencies.

Then use 
```
npm start
```
to start a dev server. The start script starts a browsersync server with watching, such that any changes in the .ts-files triggers a reloading of the app.

*Note: Node.js must be installed for this to work. The app was developed using node version 6.3.0 on Ubuntu.*

## Motivation
For fun and learning. Amongst other things, to learn some [typescript].

## Styling
The styling is basically a lightweight copy of a few elements from the CSS framework [Twitter Bootstrap][bootstrap].

## Contributions
Please submit issues, requests, pull requests etc. I am grateful for any input you might have. In addition, feel free to fork this repo. As you can see, I've chosen the MIT license - meaning you can basically do whatever you like with this repo with no strings attached.

## Prior art
The implementation is inspired by other metronomes such as

* [This metronome on github][metronome-gh] by Github-user [cwilso](https://github.com/cwilso/)
* The metronome over at [Metronome online][metronome-online] 

[live-demo]: http://www.hatleskog.xyz/metronome
[typescript]: https://www.typescriptlang.org/
[bootstrap]: http://getbootstrap.com/
[metronome-gh]: https://github.com/cwilso/metronome
[metronome-online]: https://www.metronomeonline.com/
