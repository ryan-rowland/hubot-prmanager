module.exports = function PR_Manager(robot) {
  // Config Constants
  var BASE_URL = process.env.HUBOT_GITHUB_API || 'https://api.github.com';
  var ROOMS = process.env.HUBOT_PR_ROOMS;
  var ORG = process.env.HUBOT_GITHUB_ORG;
  var HOST = process.env.HUBOT_HOST;

  // Private Variables
  var _github = require('githubot')(robot);
  var _prs = {};

  // Initialize
  robot.brain.on('loaded', function() {
    _prs = robot.brain.data.prs || _prs;
  });

  // Update robot brain with new request
  this.open = function(request) {
    request.open = true;

    _prs[request.id] = request;
    robot.brain.data.prs = _prs;

    return request
  };

  // Update robot brain with re-opened request
  this.reopen = function(request) {
    var output = request;

    if(_prs[request.id]) {
      _prs[request.id].open = true;
      robot.brain.data.prs = _prs;
    } else {
      output = this.open(request);
    }

    return output;
  };

  // Update robot brain with closed request
  this.close = function(request) {
    if(_prs[request.id]) {
      _prs[request.id].open = false;
      robot.brain.data.prs = _prs;
    }

    return request;
  };

  // Set the value of a PR's key in robot brain
  this.setParam = function(id, key, value) {
    var output = 'Could not find ' + id;
    var pr = _prs[id];

    if(pr) {
      pr[key] = value;
      robot.brain.data.prs = _prs;
      output = 'Set ' + key + ' of ' + id + ' to ' + value;
    }

    return output;
  };

  // Get the value of a PR's key in robot brain
  this.getParam = function(id, key) {
    var pr = _prs[id];
    return pr[key] || 'Could not find ' + id;
  }

  // Completely delete a PR record from robot brain
  this.deleteRequest = function(id) {
    var pr = _prs[id];

    if(pr) {
      delete pr;
      robot.brain.data.prs = _prs;
    }
  };

  // Get all open PRs
  this.getOpenRequests = function() {
    var openRequests = [];
    for (req in _prs) {
      _prs[req].open == true && openRequests.push(_prs[req]);
    }

    return openRequests;
  };

  // Get a PR's entire record from robot brain
  this.getRequest = function(id) {
    var output = 'Could not find ' + id;
    var pr = _prs[id];

    if(pr) {
      output = [];

      for(key in pr) {
        output.push(key + '=' + pr[key]);
      }
    }

    return output;
  };

  // Get the most recent comment on a repo
  this.getIssueComment = function(repo, issueID, cb) {
    var commentUrl = BASE_URL + '/repos/' + ORG + '/' + repo + '/issues/' + issueID + '/comments?sort=created&direction=desc';

    _github.get(commentUrl, function(comments) {
      var reason = (comments && comments[0]) ? comments[0].body : 'Unspecified';
      cb && cb(reason);
    });
  };

  function _getRepos(cb) {
    var reposUrl = BASE_URL + '/orgs/' + ORG + '/repos?type=private';

    _github.get(reposUrl, function(repos) {
      cb && cb(repos);
    });
  };

  function _getHooks(repoName, cb) {
    var hookUrl = BASE_URL + '/repos/' + ORG + '/' + repoName + '/hooks';

    _github.get(hookUrl, function(hooks) {
      cb && cb(hooks, repoName);
    });
  };

  function _setHook(repoName, cb) {
    var hookUrl = BASE_URL + '/repos/' + ORG + '/' + repoName + '/hooks';

    var hookData = {
      'name' : 'web',
      'active' : true,
      'events' : [ 'pull_request' ],
      'config' : {
        'url' : HOST + ':' + PORT + '/hubot/gh-pull-requests?room=' + ROOMS,
        'content_type' : 'json'
      }
    };

    _github.post(hookUrl, hookData, function(hook) {
      cb && cb(hook);
    });
  }

  this.updateHooks = function() {
    _getRepos(function (repos) {
      for (repoKey in repos) {
        var repo = repos[repoKey];
        _getHooks(repo.name, function(hooks, repoName) {
          var isHooked = false;
          for (hookKey in hooks) {
            var hook = hooks[hookKey];
            if(hook.config.url && hook.config.url.indexOf('gh-pull-requests') != -1) {
              isHooked = true;
            }
          }

          !isHooked && _setHook(repoName, function(response) {
            console.log('Set hook on ' + repoName);
            
            for(roomName in ROOMS.split(',')) {
              robot.send( { 'room' : roomName }, 'Set hook on ' + repoName );
            }
          });
        });
      }
    });
  };
}
