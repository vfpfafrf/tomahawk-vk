/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011, Krzysztof Klinikowski <kkszysiu@gmail.com>
 *   Copyright 2014, Dmitry Ivanov <dmitry@daydev.io>
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

debugMode = false;

function xhrRequest(url, method, data, callback) {
    var xhr = new XMLHttpRequest();

    if (debugMode == true) {
        Tomahawk.log('Sending request:' + url + '?' + data);
    }

    if (method == "POST") {
        xhr.open(method, url, true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(data)
    } else {
        if (url.match(/\?/))
            xhr.open(method, url + '&' + data, true);
        else
            xhr.open(method, url + '?' + data, true);

        xhr.send();
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            callback(xhr);
        }
    }
}


/**
 VK

 Module for working with vk.com
 **/
var VK = {
    authToken: '|',
    includeCovers: false,
    includeRemixes: false,
    includeLive: false,


    /**
     https://oauth.vk.com/authorize?client_id=4655935&scope=audio&redirect_uri=http://api.vk.com/blank.html&display=page&response_type=token
     **/

    getApiData: function () {
        return VK.authToken.split("|");
    },

    /**
     VK#_testmodeSearch(artist, song, callback)

     Searching vkontakte with api in test_mode
     **/
    _testmodeSearch: function (artist, song, duration, callback) {
        var track = artist + " " + song;

        var api = VK.getApiData();
        var url = "https://api.vk.com/method/audio.search";

        var data = "user_id=" + api[0] + "&v=5.27&access_token=" + api[1] + "&sort=2&count=20&q=" + encodeURIComponent(track);

        if (debugMode == true) {
            Tomahawk.log("Search url: " + url + '?' + data);
        }

        xhrRequest("http://chromusapp.appspot.com/sign_data", "POST", "track=" + encodeURIComponent(artist + song), function (xhr) {
            if (debugMode == true) {
                Tomahawk.log("XHR response: " + xhr.responseText);
            }
        });

        xhrRequest(url, "GET", data, function (xhr) {
            /*try {
             // Too many requests and now we banned for some time
             if(xhr.responseText.match(/\:false/)){
             // Checking if user logged into vkontakte
             VK.determineSearchMethod(function(response){
             if(response.search_method == "test_mode"){
             callback({error:'overload'})
             } else {
             VK.search_method = response.search_method
             VK.search(artist, song, duration, callback)
             }
             })

             return
             }
             } catch(err) {
             Tomahawk.log("Error while preparsing response "+err);
             }*/

            var response_text;
            try {
                response_text = xhr.responseText.replace(/\u001D/g, '').replaceEntities();
            } catch (err) {
                response_text = xhr.responseText;
            }

            var results = JSON.parse(response_text);

            try {
                if (results.response) {
                    var vk_tracks = [];

                    if (results.response.items) {
                        vk_tracks.lastIndex = 0;
                        for (var i = 0; i < results.response.items.length; i++) {
                            var audio = results.response.items[i];
                            vk_tracks.push(audio);

                            if (audio.artist.toLowerCase() == artist && audio.title.toLowerCase() == song) {
                                if (!duration || Math.abs((parseInt(audio.duration) - duration) <= 2)) {
                                    vk_tracks.lastIndex = vk_tracks.length - 1;
                                    break;
                                }
                            } else if (!VK.includeRemixes && !audio.title.toLowerCase().match(/(remix|mix)/) && audio.artist.toLowerCase() == artist) {
                                vk_tracks.lastIndex = vk_tracks.length - 1;
                            } else if (!VK.includeLive && !audio.title.toLowerCase().match(/( live )/) && audio.artist.toLowerCase() == artist) {
                                vk_tracks.lastIndex = vk_tracks.length - 1;
                            } else if (!VK.includeCovers && !audio.title.toLowerCase().match(/( cover )/) && audio.artist.toLowerCase() != artist) {
                                vk_tracks.lastIndex = vk_tracks.length - 1;
                            }
                        }
                        if (debugMode == true) {
                            Tomahawk.log("Selected track: " + JSON.stringify(vk_tracks[vk_tracks.lastIndex]));
                        }
                    }

                    if (vk_tracks && vk_tracks.length > 0) {
                        //vk_track.duration = parseInt(vk_track.duration)

                        //Caching for 3 hours
                        //CACHE.set(track, vk_tracks, 1000*60*60*3)

                        callback(vk_tracks);
                    } else {
                        callback({error: 'not_found'});
                    }
                } else {
                    if (results.error)
                        callback({error: results.error});
                    else {
                        if (debugMode == true) {
                            Tomahawk.log("ERROR!: Unknown error while searching track");
                        }
                        callback({error: 'Unknown error while searching track'});
                    }
                }
            } catch (err) {
                Tomahawk.log("Error while parsing response ");
                Tomahawk.log("name: " + err.name + "\nmessage: " + err.message + "\nstack: " + err.stack);
            }
        })
    },


    /**
     VK#search(artist, song, callback)
     - artist (String): Artist
     - song (String): Song
     - callback (Function): Function to be called when search compete, to obtain results.
     **/
    search: function (artist, song, duration, callback) {
        if (debugMode == true) {
            Tomahawk.log("Seaching: " + artist + " - " + song);
        }

        artist = artist.toLowerCase();
        song = song.toLowerCase();

        if (duration != undefined)
            duration = parseInt(duration);

        //var track = artist + " " + song;
        //if(CACHE.get(track))
        //    return callback(CACHE.get(track))

        this._testmodeSearch(artist, song, duration, callback)
    },

    getTrackCount: function (callback) {
        var api = VK.getApiData();
        var url = "https://api.vk.com/method/audio.getCount";
        var data = "user_id=" + api[0] + "&v=5.27&access_token=" + api[1] + "&owner_id=" + api[0];
        xhrRequest(url, "GET", data, function (xhr) {
            var response_text;
            try {
                response_text = xhr.responseText.replace(/\u001D/g, '').replaceEntities();
            } catch (err) {
                response_text = xhr.responseText;
            }
            var response = JSON.parse(response_text);
            callback(response.response);
        });
    },

    getUserData: function(maxCount, callback){

        var api = VK.getApiData();
        var url = "https://api.vk.com/method/audio.get";
        var data = "user_id=" + api[0] + "&v=5.27&access_token=" + api[1] + "&owner_id=" + api[0]+"&count="+maxCount+"&need_user=0";
        xhrRequest(url, "GET", data, function (xhr) {
            var response_text;
            try {
                response_text = xhr.responseText.replace(/\u001D/g, '').replaceEntities();
            } catch (err) {
                response_text = xhr.responseText;
            }

            var results = JSON.parse(response_text);

            try {
                if (results.response) {
                    var vk_tracks = [];

                    if (results.response.items) {
                        vk_tracks.lastIndex = 0;
                        for (var i = 0; i < results.response.items.length; i++) {
                            var audio = results.response.items[i];
                            vk_tracks.push({
                                artist: audio.artist,
                                title: audio.title,
                                duration: audio.duration,
                                url: audio.url
                            });
                        }
                    }

                    if (vk_tracks && vk_tracks.length > 0) {
                        callback(vk_tracks);
                    } else {
                        callback({error: 'not_found'});
                    }
                }
            } catch(err){
                Tomahawk.log("Error while parsing response ");
                Tomahawk.log("name: " + err.name + "\nmessage: " + err.message + "\nstack: " + err.stack);
            }

        });
    }
};


var VKResolver = Tomahawk.extend(TomahawkResolver, {
    settings: {
        name: 'vk',
        weight: 75,
        timeout: 5,
        icon: 'icon.png'
    },
    enabled: false,
    trackCount: 0,
    vkTracks: [],

    init: function () {
        var userConfig = this.getUserConfig();

        if (Object.getOwnPropertyNames(userConfig).length > 0) {
            if (userConfig.authToken != '' && userConfig.authToken.indexOf('|') > 0) {
                this.enabled = true;
                /*VK.includeCovers = userConfig.includeCovers;
                 VK.includeRemixes = userConfig.includeRemixes;
                 VK.includeLive = userConfig.includeLive;*/
                VK.authToken = userConfig.authToken;

                var that = this;
                VK.getTrackCount(function (resp) {
                    that.trackCount = resp;
                    Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);

                    VK.getUserData (that.trackCount, function (tracks){
                        that.vkTracks = tracks;
                    });
                });
            }
        } else {
            Tomahawk.reportCapabilities(TomahawkResolverCapability.NullCapability);
            this.enabled = false;
        }
    },


    newConfigSaved: function () {
        var userConfig = this.getUserConfig();

        Tomahawk.log("vk.com new config saved " + userConfig.authToken);

        if (userConfig.authToken != '' && userConfig.authToken.indexOf('|') > 0) {
            /*VK.includeCovers = userConfig.includeCovers;
             VK.includeRemixes = userConfig.includeRemixes;
             VK.includeLive = userConfig.includeLive;*/

            if (VK.authToken != userConfig.authToken) {
                VK.authToken = userConfig.authToken;

                var that = this;
                VK.getTrackCount(function (resp) {
                    that.trackCount = resp;
                    Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);

                    VK.getUserData (that.trackCount, function (tracks){
                        that.vkTracks = tracks;
                    });
                });
            }

            this.enabled = VK.authToken != '' &&  VK.authToken.indexOf("|") > 0;
        }

        if (!this.enabled){
            Tomahawk.reportCapabilities(TomahawkResolverCapability.NullCapability);
        }
    },


    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [{
                name: "authToken",
                widget: "authToken",
                property: "text"
            }/*, {
             name: "includeCovers",
             widget: "covers",
             property: "checked"
             }, {
             name: "includeRemixes",
             widget: "remixes",
             property: "checked"
             }, {
             name: "includeLive",
             widget: "live",
             property: "checked"
             }*/],
            images: [{
                "icon.png": Tomahawk.readBase64("icon.png")
            }]
        };
    },

    resolve: function (qid, artist, album, title) {
        if (!this.enabled) {
            return {
                qid: qid
            };
        }

        var data = {
            qid: qid,
            results: []
        };

        VK.search(artist, title, null, function (response) {
            if (response.length != 0) {
                var elem = response[0];
                var songinfo = {
                    artist: elem['artist'],
                    track: elem['title'],
                    duration: elem['duration'],
                    source: "vk",
                    extension: "mp3",
                    mimetype: "audio/mp3",
                    url: elem['url']
                };
                data.results.push(songinfo);
            }
            Tomahawk.addTrackResults(data);
        });
    },

    search: function (qid, searchString) {
        if (!this.enabled) {
            return {
                qid: qid
            };
        }

        var data = {
            qid: qid,
            results: []
        };

        VK.search(searchString, "", null, function (response) {
            for (var i = 0; i < response.length; i++) {
                var elem = response[i];

                /*Tomahawk.log(elem.artist+" - "+elem.title);*/
                var songinfo = {
                    artist: elem['artist'],
                    track: elem['title'],
                    duration: elem['duration'],
                    source: "vk",
                    extension: "mp3",
                    mimetype: "audio/mp3",
                    url: elem['url']
                };

                data.results.push(songinfo);
            }
            Tomahawk.addTrackResults(data);
        });
    },

    include: function(arr,obj) {
        return (arr.indexOf(obj) != -1);
    },

    artists: function (qid) {
        var artist = [];

        for(var i =0;i<this.vkTracks.length;i++){
            var track = this.vkTracks[i];
            if (!this.include(track.artist)) {
                artist.push(track.artist);
            }
        }
        Tomahawk.addArtistResults({
            qid: qid,
            artists: artist
        });
    },
    albums: function (qid, artist) {
        Tomahawk.addAlbumResults({
            qid: qid,
            artist: artist,
            albums: ["vk"]
        });
    },
    tracks: function (qid, artist, album) {

        var results = [];
        for(var i =0;i<this.vkTracks.length;i++){
            var track = this.vkTracks[i];
            if (track.artist == artist){
                results.push({
                    artist: track['artist'],
                    track: track['title'],
                    duration: track['duration'],
                    source: "vk",
                    extension: "mp3",
                    mimetype: "audio/mp3",
                    url: track['url']
                });
            }
        }

        Tomahawk.addAlbumTrackResults({
            qid: qid,
            artist: artist,
            album: album,
            results: results
        });
    },

    collection: function (qid) {
        return {
            qid: qid,
            description: "vkontakte",
            prettyname: "VK",
            iconfile: '../images/icon.png',
            trackcount: this.trackCount
        };
    }
});

Tomahawk.resolver.instance = VKResolver;
