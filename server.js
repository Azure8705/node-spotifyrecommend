var unirest = require('unirest');
var express = require('express');
var events = require('events');

var app = express();
app.use(express.static('public'));

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint )
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                }
                else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};

var getRelatedArtists = function(res, artist){
    var relatedUrl = 'artists/' + artist.id + '/related-artists';
    var relatedReq = getFromApi(relatedUrl, {});

    relatedReq.on('end', function(relatedArtists){
        artist.related = relatedArtists.artists;
        var trackLookupCount = 0;
        var totalRelatedArtists = artist.related.length;
        var lookupComplete = function() {
            if (trackLookupCount === totalRelatedArtists) {
                res.json(artist);
            }
        };

        artist.related.forEach(function(relatedArtist) {
            var topTracksReq = getFromApi(
                'artists/' + relatedArtist.id + '/top-tracks', 
                { country: 'US' }
            );

            topTracksReq.on('end', function(list) {
                relatedArtist.tracks = list.tracks;
                trackLookupCount += 1;
                lookupComplete();
            });

            topTracksReq.on('error', function() {
                res.sendStatus(404);
            });
        });
        
    });

    relatedReq.on('error', function() {
        res.statusCode = 404;
        res.end();
    });
};


app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];
        getRelatedArtists(res, artist);
                
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(8080);