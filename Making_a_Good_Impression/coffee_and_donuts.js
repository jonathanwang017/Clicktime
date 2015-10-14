// TODO
// optimize store location?

$(document).ready(function() {
  var clicktime_address = '282 2nd Street 4th floor, San Francisco, CA 94105';

  // create map
  var map = new google.maps.Map(document.getElementById('map'), {
    zoom: 10,
    center: {lat: 37.870, lng: -122.259}
  });

  var geocoder = new google.maps.Geocoder();
  var directions_service = new google.maps.DirectionsService();

  // use two seperate renderers to split route into two parts
  var store_directions_display = new google.maps.DirectionsRenderer({preserveViewport: true});
  var clicktime_directions_display = new google.maps.DirectionsRenderer({preserveViewport: true});
  store_directions_display.setMap(map);
  clicktime_directions_display.setMap(map);
  var service = new google.maps.places.PlacesService(map);

  var current_coordinates;
  var clicktime_coordinates;
  var coffee_and_donut_location;  

  // get current coordinates and clicktime coordinates 
  $.when(getCurrentLocation(map), geocodeAddress(map, geocoder, clicktime_address)).then(function(start, stop) {
    current_coordinates = start;
    clicktime_coordinates = {
      lat: stop.lat(), 
      lng: stop.lng()
    };
    // find location of a store and enable routing button
    $.when(findCoffeeAndDonuts(map, service, current_coordinates, clicktime_coordinates)).then(function(waypoint) {
      coffee_and_donut_location = waypoint;
      activateRouting();
    });
  });

  // calls calculate route twice to support transit method of transportation which does not allow waypoints
  $('#route').click(function() {
    // clear directions table
    $('#directions').empty();

    // get mode of transportation
    var transport_select = $('#transportation').val();
    var transportation;
    if (transport_select == 'WALKING') {
      transportation = google.maps.TravelMode.WALKING;
    } else if (transport_select == 'BIKING') {
      transportation = google.maps.TravelMode.BICYCLING;
    } else if (transport_select == 'TRANSIT') {
      transportation = google.maps.TravelMode.TRANSIT;
    }

    // calculate route to store using selected method of transport
    $.when(calculateRoute(map, directions_service, current_coordinates, coffee_and_donut_location, 
      transportation)).then(function(store_route) {
      // display route on map and print directions
      store_directions_display.setDirections(store_route);
      printDirections(translateDirections(store_route));

      // calculate route to clicktime from store
      $.when(calculateRoute(map, directions_service, coffee_and_donut_location, clicktime_coordinates, 
        transportation)).then(function(clicktime_route) {
        // display route on map and print directions
        clicktime_directions_display.setDirections(clicktime_route);
        printDirections(translateDirections(clicktime_route));
      });
    });   
  });
});

// place marker on current location and return current location
function getCurrentLocation(map) {
  if (navigator.geolocation) {
    return $.Deferred(function(currentLocationDeferred) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        var marker = new google.maps.Marker({
          map: map,
          position: pos
        });
        map.setCenter(pos);
        currentLocationDeferred.resolve(pos);
      }, function() {
        alert('Could not find location. Try refreshing the page.');
      });
    }).promise();
  } else {
    // Browser doesn't support Geolocation
    alert('Browser does not support geolocation');
  }
}

// place marker on address location and return coordinates
function geocodeAddress(map, geocoder, address) {
  return $.Deferred(function(clicktimeLocationDeferred) {
    geocoder.geocode({'address': address}, function(results, status) {
      if (status === google.maps.GeocoderStatus.OK) {
        var marker = new google.maps.Marker({
          map: map,
          position: results[0].geometry.location
        });
        clicktimeLocationDeferred.resolve(results[0].geometry.location);
      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    });
  }).promise();
}

// return a coffee and donut store
function findCoffeeAndDonuts(map, service, current_coordinates, clicktime_coordinates) {
  // calculate bounding box to find store between current location and clicktime
  var sw_lat = Math.min(current_coordinates.lat, clicktime_coordinates.lat);
  var sw_lng = Math.min(current_coordinates.lng, clicktime_coordinates.lng);
  var sw_corner = new google.maps.LatLng(sw_lat, sw_lng);
  var ne_lat = Math.max(current_coordinates.lat, clicktime_coordinates.lat);
  var ne_lng = Math.max(current_coordinates.lng, clicktime_coordinates.lng);
  var ne_corner = new google.maps.LatLng(ne_lat, ne_lng);

  var request = {
    bounds: new google.maps.LatLngBounds(sw_corner, ne_corner),
    // text search for coffee and donuts
    query: 'coffee donuts'
  };

  // get first result of place search
  return $.Deferred(function(waypointsDeferred) {
    service.textSearch(request, function(results, status) {
      if (status == google.maps.places.PlacesServiceStatus.OK) {
        waypoint = results[0].geometry.location;
        waypointsDeferred.resolve(waypoint);
      }
    });
  }).promise();
}

// calculate route from start to stop using routing service
function calculateRoute(map, directions_service, start, stop, transportation) {
  return $.Deferred(function(routeDeferred) {
    directions_service.route({
      origin: start,
      destination: stop,
      travelMode: transportation
    }, function(response, status) {
      if (status === google.maps.DirectionsStatus.OK) {
        routeDeferred.resolve(response);
      } else {
        alert('Directions request failed due to ' + status);
      }
    });
  }).promise();
}

// translate directions response to instructions
function translateDirections(response) {
  var instructions = [];
  for (i = 0; i < response.routes[0].legs.length; i++) {
    directions = response.routes[0].legs[i].steps;
    for (j = 0; j < directions.length; j++) {
      // clean instructions by removing html tags
      var instruction = directions[j].instructions.replace(/<div.*?>/g, '. ').replace(/<.*?>/g, '');
      var duration = directions[j].duration.text + ' (' + directions[j].distance.text + ')';
      instructions.push(instruction + ' - ' + duration);
    }
  }
  return instructions;
}

// display directions in html table
function printDirections(directions) {
  for (i = 0; i < directions.length; i++) {
    $('#directions').append('<tr><td>' + directions[i] +'</td></tr>');
  }
}

// enable routing button after locations found
function activateRouting() {
  $('#route').prop('disabled', false);
}
