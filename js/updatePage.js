const allPlayers = [, 'b0b', 'RadiantHydra', 'Howdy', 'Goosnav', 'Panik', 'Amph :>'];

const HOME_NAME = "UNIVERSITY OF ARIZONA";
const AWAY_NAME = "UTAH STATE UNIVERSITY";

const HOME_IMG_PATH = "img/overlays/ualogo.png";
const AWAY_IMG_PATH = "img/players/opponent.png";

const HOME_COLOR = "rgba(139, 0, 21, 1)";
const AWAY_COLOR = "rgb(0, 28, 72)";

const SCORE_REQUEST = JSON.stringify({ "msg": "send_update" });

// SOS websocket start
const WsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    init: function (port, debug, debugFilters) {
        port = port || 49322;
        debug = debug || false;
        if (debug) {
            if (debugFilters !== undefined) {
                console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
            } else {
                console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
            }
        }
        WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
        WsSubscribers.webSocket.onmessage = function (event) {
            let jEvent = JSON.parse(event.data);
            if (!jEvent.hasOwnProperty('event')) {
                return;
            }
            let eventSplit = jEvent.event.split(':');
            let channel = eventSplit[0];
            let event_event = eventSplit[1];
            if (debug) {
                if (!debugFilters) {
                    console.log(channel, event_event, jEvent);
                } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                    console.log(channel, event_event, jEvent);
                }
            }
            WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        WsSubscribers.webSocket.onopen = function () {
            WsSubscribers.triggerSubscribers("ws", "open");
            WsSubscribers.webSocketConnected = true;
            WsSubscribers.registerQueue.forEach((r) => {
                WsSubscribers.send("wsRelay", "register", r);
            });
            WsSubscribers.registerQueue = [];
        };
        WsSubscribers.webSocket.onerror = function () {
            WsSubscribers.triggerSubscribers("ws", "error");
            WsSubscribers.webSocketConnected = false;
        };
        WsSubscribers.webSocket.onclose = function () {
            WsSubscribers.triggerSubscribers("ws", "close");
            WsSubscribers.webSocketConnected = false;
        };
    },

    /**
     * Add callbacks for when certain events are thrown
     * Execution is guaranteed to be in First In First Out order
     * @param channels
     * @param events
     * @param callback
     */
    subscribe: function (channels, events, callback) {
        if (typeof channels === "string") {
            let channel = channels;
            channels = [];
            channels.push(channel);
        }
        if (typeof events === "string") {
            let event = events;
            events = [];
            events.push(event);
        }
        channels.forEach(function (c) {
            events.forEach(function (e) {
                if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                    WsSubscribers.__subscribers[c] = {};
                }
                if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                    WsSubscribers.__subscribers[c][e] = [];
                    if (WsSubscribers.webSocketConnected) {
                        WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                    } else {
                        WsSubscribers.registerQueue.push(`${c}:${e}`);
                    }
                }
                WsSubscribers.__subscribers[c][e].push(callback);
            });
        })
    },
    clearEventCallbacks: function (channel, event) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel] = {};
        }
    },
    triggerSubscribers: function (channel, event, data) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel][event].forEach(function (callback) {
                if (callback instanceof Function) {
                    callback(data);
                }
            });
        }
    },
    send: function (channel, event, data) {
        if (typeof channel !== 'string') {
            console.error("Channel must be a string");
            return;
        }
        if (typeof event !== 'string') {
            console.error("Event must be a string");
            return;
        }
        if (channel === 'local') {
            this.triggerSubscribers(channel, event, data);
        } else {
            let cEvent = channel + ":" + event;
            WsSubscribers.webSocket.send(JSON.stringify({
                'event': cEvent,
                'data': data
            }));
        }
    }
};

const mainPlayerPane = document.querySelector(".mainPlayerPane");
const imgPane = document.querySelector(".playerImgWrapper");
const timeElement = document.querySelector(".time");

// Team vars
const leftName = document.querySelector(".blueName");
const rightName = document.querySelector(".blueName");
const leftImg = document.querySelector(".leftImage");
const rightImg = document.querySelector(".rightImage");
const leftBackPlate = document.querySelector(".leftBackPlate");
const rightBackPlate = document.querySelector(".rightBackPlate");
var sideDecided = false;
var homeOnLeft = false;

$(() => {

    WsSubscribers.init(49322, true);
    var oldPlayer = "";

    // Custom websocket start
    const localDataSocket = new WebSocket('ws://localhost:8001');
    var localWebSockData = [];
    localDataSocket.addEventListener('open', function (event) {
        localDataSocket.send('Connection Established');
    });
    localDataSocket.addEventListener('message', function (event) {
        localWebSockData = JSON.parse(event.data);
        console.log(localWebSockData)
    });
    var tickCount = 0;

    // run on each game tics
    WsSubscribers.subscribe("game", "update_state", (d) => {

        // Handles which side our team is on and swaps elements accordingly
        const allInGamePlayerNames = Object.keys(d['players']);
        for (tempPlayer in allInGamePlayerNames) {
            tempPlayerName = allInGamePlayerNames[tempPlayer].substring(0, allInGamePlayerNames[tempPlayer].length - 2);
            tempPlayerNum = parseInt(allInGamePlayerNames[tempPlayer].substring(allInGamePlayerNames[tempPlayer].length - 1, allInGamePlayerNames[tempPlayer].length));
            if (!sideDecided && allPlayers.join().includes(tempPlayerName)) {
                if (tempPlayerNum <= 3) {
                    console.log("OUR TEAM IS ON THE LEFT");
                    // update home side
                    $(".mainScorePane .blueNameDiv .blueName").text(HOME_NAME);
                    leftImg.src = HOME_IMG_PATH;
                    leftBackPlate.style.background = HOME_COLOR;
                    // update away
                    $(".mainScorePane .orangeNameDiv .orangeName").text(AWAY_NAME);
                    rightImg.src = AWAY_IMG_PATH;
                    rightBackPlate.style.background = AWAY_COLOR;
                    homeOnLeft = true;
                    sideDecided = true;
                    break;
                }
                else {
                    console.log("OUR TEAM IS ON THE RIGHT");
                    // update home side
                    $(".mainScorePane .blueNameDiv .blueName").text(AWAY_NAME);
                    leftImg.src = AWAY_IMG_PATH;
                    leftBackPlate.style.background = AWAY_COLOR;
                    // update away
                    $(".mainScorePane .orangeNameDiv .orangeName").text(HOME_NAME);
                    rightImg.src = HOME_IMG_PATH;
                    rightBackPlate.style.background = HOME_COLOR;
                    sideDecided = true;
                }
            }
        }
        if (!sideDecided) {
            console.log("cant find our team..");
            // update home side
            $(".mainScorePane .blueNameDiv .blueName").text(AWAY_NAME);
            leftImg.src = AWAY_IMG_PATH;
            leftBackPlate.style.background = AWAY_COLOR;
            // update away
            $(".mainScorePane .orangeNameDiv .orangeName").text(HOME_NAME);
            rightImg.src = HOME_IMG_PATH;
            rightBackPlate.style.background = HOME_COLOR;
            sideDecided = true;
        }

        var cameraIsOnPlayer = (d['game']['hasTarget']);
        if (cameraIsOnPlayer) {
            mainPlayerPane.style.visibility = "visible";
            var playerName = (d['game']['target']);
            if (oldPlayer !== playerName) {
                var formattedPlayerName = playerName.substring(0, playerName.length - 2);
                if (allPlayers.join().includes(formattedPlayerName)) {
                    var failSafePlayerName = formattedPlayerName.replace(/[^a-z0-9]/gi, '');
                    var newImgPath = "img/players/" + failSafePlayerName + ".png";
                    document.getElementById('pPhoto').src = newImgPath;
                }
                else {
                    document.getElementById('pPhoto').src = "img/players/opponent.png";
                }
            }

            // Directly updating for player card info
            $(".mainPlayerPane .playerNameWrapper .playerName").text(formattedPlayerName);
            $(".mainPlayerPane .mainBlock .playerInfo .playerGoals").text(d['players'][playerName]['goals']);
            $(".mainPlayerPane .mainBlock .playerInfo .playerShots").text(d['players'][playerName]['shots']);
            $(".mainPlayerPane .mainBlock .playerInfo .playerAssists").text(d['players'][playerName]['assists']);
            $(".mainPlayerPane .mainBlock .playerInfo .playerSaves").text(d['players'][playerName]['saves']);
            oldPlayer = (d['game']['target']);
        }
        else {
            mainPlayerPane.style.visibility = "hidden";
        }
        // Updates for game stats
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~
        // time formatting + handles OT
        var time = (d['game']['time_seconds']);
        var formattedTime = new Date(time * 1000).toISOString().substring(15, 19);
        if ((d['game']['isOT'])) {
            timeElement.style.color = "rgba(139, 0, 21, 1)";
            formattedTime = "+" + formattedTime
        }
        else {
            timeElement.style.color = "rgba(0, 28, 72, 1)";
        }
        $(".mainScorePane .time").text(formattedTime);

        // blue score
        $(".mainScorePane .blueScoreDiv .blueScore").text(d['game']['teams'][0]['score']);
        // orange score
        $(".mainScorePane .orangeScoreDiv .orangeScore").text(d['game']['teams'][1]['score']);

        // handles web socket
        if (tickCount % 1 == 0) {
            const leftScoreElement = document.querySelector(".leftScoreIndicator");
            const rightScoreElement = document.querySelector(".rightScoreIndicator");
            // sending request to websocket for updated data
            localDataSocket.send(SCORE_REQUEST);

            // NEED TO DO LOGIC FOR THIS
            var lTotalScore = parseInt(localWebSockData['score']['home']);
            var rTotalScore = parseInt(localWebSockData['score']['away']);
            if (!homeOnLeft) {
                var lTotalScore = parseInt(localWebSockData['score']['away']);
                var rTotalScore = parseInt(localWebSockData['score']['home']);
            }
            var tGameScore = lTotalScore + " - " + rTotalScore;
            // 
            if (lTotalScore > 0) {
                leftScoreElement.style.visibility = "visible";
                lTotalScore = "img/overlays/Left" + lTotalScore + ".png";
                document.getElementById('LI').src = lTotalScore;
            }
            else {
                leftScoreElement.style.visibility = "hidden";
            }
            if (rTotalScore > 0) {
                rightScoreElement.style.visibility = "visible";
                rTotalScore = "img/overlays/Right" + rTotalScore + ".png";
                document.getElementById('RI').src = rTotalScore;
            }
            else {
                rightScoreElement.style.visibility = "hidden";
            }
            $(".mainScorePane .tGameScore").text(tGameScore);
            $(".mainScorePane .gamesPlayed").text(localWebSockData['games']);
            //leftScoreIndicator
            tickCount = 0;
        }
        tickCount = tickCount + 1;

    });
});

