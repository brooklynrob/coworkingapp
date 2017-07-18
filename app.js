// run 

var util = require('util');
var fs = require("fs");
var Twitter = require('twitter');
var _ = require('underscore');
var Promise = require('promise');
//var When = require('when');

var appId = process.argv[2];
var config;

if ((appId != 'bcl') || (appId !='bfg')) {
  appId == 'default';
}
  
console.log ('appId is '+ appId);
config = require('./config-' + appId);


var logFile = fs.createWriteStream('applog-'+appId, { flags: 'a' });
var localTwitterScreenNameFile = fs.createWriteStream('localTwitterScreenNameFile-'+appId, { flags: 'a' });
var accountFollowersFile = fs.createWriteStream('FollowersFile-'+appId, { flags: 'w' });
var accountFollowersListFile = fs.createWriteStream('FollowersListFile-'+appId, { flags: 'w' });
var accountTargetsFile   = fs.createWriteStream('TargetsFile-'+appId, { flags: 'a' });
var screennamesSentPromoHistoryFile = fs.createWriteStream('screennamesSentPromoHistoryFile- '+appId, { flags: 'a' });
var messagesSentPromoHistoryFile = fs.createWriteStream('messagesSentPromoHistoryFile - '+appId, { flags: 'a' });

//var accountFollowersListFileRead = fs.createReadStream('FollowersListFile-'+appId);
//var screennamesSentPromoHistoryFileRead = fs.createReadStream('screennamesSentPromoHistoryFile- '+appId);

var interval = (1000 * 60 * 15);
var followersInterval = (1000 * 60 * 120);

var accountFollowers = [];
var acctFollowers = [];
var accountTargets = [];

var currTime;

var client = new Twitter({
  consumer_key: config.twitterapi.consumer_key,
  consumer_secret: config.twitterapi.consumer_secret,
  access_token_key: config.twitterapi.access_token_key,
  access_token_secret: config.twitterapi.access_token_secret
});

var accountScreenName = config.app.twitterhandle;


//Main Logic of Program
logFile.write('Script has started for appId of ' + appId + '\n');

//Step 1: Get current list of followers 
accountFollowers = getFollowers(-1);

//Step 2: 60 seconds later 
setTimeout(findAndProcessTargets, 60000, accountFollowers);

//Step 3: Every 15 minutes find and process targets

setInterval(findAndProcessTargets, interval, accountFollowers);

//Step 4: Every 2 hours get new list of followers

accountFollowers = setInterval(getFollowers,followersInterval,-1);



function getTimeStamp() { 
    var datenow = new Date(Date.now());
    var year = datenow.getFullYear();
    var month = datenow.getMonth();
    var date = datenow.getDate();
    var hours = datenow.getHours();
    var minutes = datenow.getMinutes();
    var seconds = datenow.getSeconds();
    // will display time in 21:00:00 format
    var timestamp = (month+1) + "/" + date + "/" + year + " -- " + hours + ':' + minutes + ':' + seconds;
    return timestamp;
}


function getFollowers (cursor) {
    var returncount = 200;
    var lastCursor;
    var nextCursor;
    var accountParams = {};
    
    
    accountParams = {screen_name: accountScreenName, count: returncount, cursor: cursor};
    
    // If the returned cursor list from Twitter is 0 that means we are at end of list of users and end of recursion tree
    // If the cursor is 0 we then go do the rest of the key tasks
    if (cursor == 0) {
      currTime = getTimeStamp();
      logFile.write('Just got follower targets for ' + appId + '. Cursor is now 0. \n');
      logFile.write('About to write out followers to followers file for ' + appId + '. \n');
      logFile.write('Last Cursor is ' + lastCursor + '. \n');
      accountFollowersFile.write(currTime + ": " + util.format.apply(null, acctFollowers) + '\n');
      return accountFollowers;
    }
    
    // Logic should be ...
    // Get any new followers since last time checked
    // (Log any that have unfollowed)
    // New followers get promo code too?
  
    client.get('followers/list', accountParams, function(error, followers, response){
      //console.log("in the loop to get followers");
      if (!error) {
        //console.log("The length of users is " + followers.users.length + " and the number of returncount is " + returncount + ".");
        for (var i = 0; i < followers.users.length; i++)
        {
          //console.log(followers.users[i]['screen_name']);
          acctFollowers.push(followers.users[i]['screen_name']);
          accountFollowersListFile.write(followers.users[i]['screen_name'] +',');
        }

        lastCursor = cursor;
        nextCursor = followers.next_cursor;
        console.log("The followers next cursor is: " + nextCursor);

        // This is the recursion in this loop
        getFollowers (nextCursor);
    
        //The following bracket is the end of if not an error condition
      }
  
      else {
        console.log(error);
      }
    
    });
    
  }


function getLocalTweeters(locationname,geocode) {
  var tweetSearchParams= {};
  var tweeters = [];
  // make query an argument?
  tweetSearchParams = {q: '', geocode: geocode, count: '100'};
  var tweets = client.get('search/tweets', tweetSearchParams, function(error, tweets, response){
    console.log(tweets);
    if (!error) {
      console.log("Count of tweets collected " + tweets.statuses.length);
        for (var i = 0; i < tweets.statuses.length; i++) {
          //console.log(tweets.statuses[i]['user']['screen_name']);
          tweeters.push(tweets.statuses[i]['user']['screen_name']);
        }
        
        //console.log(localTweeters);
        currTime = getTimeStamp();
        localTwitterScreenNameFile.write(currTime  + ": Tweeters at the location - " + locationname + " were: " + util.format.apply(null, tweeters) + '\n');
    }
      
    else {
      console.log(error);
    }
    
  });

}




function getTargetsAndSendMessage(tweeters, followers, location) {
    accountTargets = (_.intersection(tweeters, followers));
    currTime = getTimeStamp();
    accountTargetsFile.write(currTime + ": Targets near " + location + " were: " + util.format.apply(null, accountTargets) + '\n');
    
    //Get previous sent screen names
    //Do difference between previous sent screen names and accountTargets
    //Only send messages to those who have not received a message before

    var newAccountTargetsPromise = removePreviousPromoedScreenNames(accountTargets,location);
    var newAccountTargets = Promise.resolve(newAccountTargetsPromise);
    
    //sendMessages(newAccountTargets,location);

    return newAccountTargets;
  }


//This function cleanses the target list of any screen names that have been previously messaged
function removePreviousPromoedScreenNames(targets,location) {
      // if not if log of people send messages
    var targetsToSendTo = [];
    var screenNamesFileData;

    
    targets.push('brooklynrob');
    targets.push('nyctwitter');
    //targets.push('ttmadvisors');
    //targets.push('innovatenyc');

    var screenNamesFileDataPromise = readFile();
    screenNamesFileData = Promise.resolve(screenNamesFileDataPromise, function () {
      
      console.log('Screen names that have already gotten messages' + screenNamesFileData);
      logFile.write('Screen names that have already gotten messages' + screenNamesFileData + '\n');
    
      //var previousSentTo = screenNamesFileData.split(',');
      console.log('Folks already sent to are ' + screenNamesFileData);
      logFile.write('Folks already sent to are ' + screenNamesFileData + '\n');

      // Get the people on targets list but NOT on the previousSentTo
      targetsToSendTo = _.difference(targets, screenNamesFileData);
      console.log('Folks to send to' + targetsToSendTo);
      logFile.write('Folks to send to' + targetsToSendTo + '\n');
    
      sendMessages(targetsToSendTo,location);
    

    
    });


}


function readFile() {
  return new Promise(function (fulfill, reject){
  var filename = ('screennamesSentPromoHistoryFile- '+appId);
  fs.readFile(filename, function (err, res){

      if (err) reject(err);
      else {
        console.log('res is ' + res);
        fulfill(res);
      }
    });
  });
}
  


function retrieveSentScreenNames() {
    var data = readFile();
    //var data = Promise.resolve(dataPromise);

    console.log('Here comes data pre-split');
    console.log(data);
    var splitDataArray = data;
    //var splitDataArray = data.split(',');
    console.log('Here comes data post-split');
    console.log(splitDataArray);
    return splitDataArray;
}
 
 
function sendMessages(targets,location) {
    var timestamp = getTimeStamp();
    console.log('About to send messages to these fine folks: ' + targets);
    logFile.write(timestamp + ': About to send to messages to targets for ' + appId + ' at location ' + location + '\n');
    logFile.write(timestamp + ': The amount of targets for ' + appId + ' at location ' + location + 'is' + targets.length + '.\n');
    logFile.write(timestamp + 'About to send messages to these fine folks: ' + targets);
    
    for (var i = 0;i < targets.length; i++) {

      var msg_params = {screen_name: targets[i], text:config.app.msg[location]};
        client.post('direct_messages/new', msg_params, function(error, followers, response){
        
          if (!error) {
            console.log("Message sent.\n");
            screennamesSentPromoHistoryFile.write(targets[i] + ',');
            messagesSentPromoHistoryFile.write('Screen name ' + msg_params.screen_name + 'was sent the message \'' + msg_params.text + '\' at ' + timestamp + '\n');
          } 
  
          else {
            console.log(error);
          }  
    
        });
        
      // If the config.app.tweet object has a location property that means we should also send a tweet
      if ((config.app.tweet) && (config.app.tweet[location]))
      {
        console.log("We're going to send a tweet!");
        var tweet = '@' + targets[i] + ', ' + config.app.tweet[location];
        
        //TO DO: Add Param for place -- to show where the tweet was sent from
        var tweet_params = {screen_name: targets[i], status:tweet};
        client.post('statuses/update', tweet_params, function(error, followers, response){

          if (!error) {
            console.log("Tweet sent.\n");
            screennamesSentPromoHistoryFile.write(targets[i] + ',');
            messagesSentPromoHistoryFile.write('Screen name ' + msg_params.screen_name + 'was sent the tweet \'' + tweet_params.text + '\' at ' + timestamp + '\n');
          } 
  
          else {
            console.log(error);
          }  
        });
      }
    }
  }
  





function findAndProcessTargets(accountFollowers) {

  var targets = [];
  var localTweeters = [];

  for (var loc in config.app.geocode) {
    logFile.write('Getting local tweeters for ' + appId + ' at location ' + loc + '\n');
    if (config.app.geocode.hasOwnProperty(loc)) {
      console.log(loc + " -> " + config.app.geocode[loc]);
      
      localTweeters = getLocalTweeters(loc,config.app.geocode[loc]);
      targets = getTargetsAndSendMessage(localTweeters, accountFollowers, loc);
      return targets;
    }
  }
}  



