module.exports = function PR_Manager(robot) {
  var _baseUrl = process.env.HUBOT_GITHUB_API || 'https://api.github.com';
  var _org = process.env.HUBOT_GITHUB_ORG || 'sony-magic';
  var _github = require('githubot')(robot);
  var _prs = {};

  // Initialize
  robot.brain.on('loaded', function() {
    _prs = robot.brain.data.prs || _prs;
  });

  this.open = function(request) {
    request.open = true;

    _prs[request.id] = request;
    robot.brain.data.prs = _prs;

    return request
  };

  this.reopen = function(request) {
    if(_prs[request.id]) {
      _prs[request.id].open = true;
      robot.brain.data.prs = _prs;
      return request;
    } else {
      return this.open(request);
    }
  };

  this.close = function(request) {
    if(_prs[request.id]) {
      _prs[request.id].open = false;
      robot.brain.data.prs = _prs;
    }
    return request;
  };

  this.setParam = function(id, key, value) {
    if(_prs[id]) {
      _prs[id][key] = value;
      robot.brain.data.prs = _prs;
      return 'Set ' + key + ' of ' + id + ' to ' + value;
    } else {
      return 'Couldn\'t find' + id;
    }
  };

  this.getParam = function(id, key) {
    if(_prs[id]) {
      return _prs[id][key];
    } else {
      return 'Couldn\'t find' + id;
    }
  }

  this.deleteRequest = function(id) {
    if(_prs[id]) {
      delete _prs[id];
      robot.brain.data.prs = _prs;
    }
  };

  this.getRequest = function(id) {
    if(_prs[id]) {
      var output = [];
      for(key in _prs[id]) {
        output.push(key + '=' + _prs[id][key]);
      }

      return output;
    } else {
      return 'Couldn\'t find' + id;
    }
  };

  function _getRepos(cb) {
    var reposUrl = _baseUrl + '/orgs/' + _org + '/repos?type=private';

    _github.get(reposUrl, function(repos) {
      cb && cb(repos);
    });
  };

  function _getHooks(repoName, cb) {
    var hookUrl = _baseUrl + '/repos/' + _org + '/' + repoName + '/hooks';

    _github.get(hookUrl, function(hooks) {
      cb && cb(hooks, repoName);
    });
  };

  function _setHook(repoName, cb) {
    var hookUrl = _baseUrl + '/repos/' + _org + '/' + repoName + '/hooks';

    var hookData = {
      "name" : "web",
      "active" : true,
      "events" : [ "pull_request" ],
      "config" : {
        "url" : "http://184.169.138.183:8081/hubot/gh-pull-requests?room=%23pullrequests",
        "content_type" : "json"
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
            robot.send( { 'room' : '#pullrequests' }, 'Set hook on ' + repoName );
            robot.send( { 'room' : '#chat' }, 'Set hook on ' + repoName );
            console.log('Set hook on ' + repoName);
          });
        });
      }
    });
  };
    
  this.list = function() {
    var openRequests = [];
    for (req in _prs) {
      _prs[req].open == true && openRequests.push(_prs[req]);
    }

    return openRequests;
  };

  this.getIssueComment = function(repo, issueID, cb) {
    var commentUrl = _baseUrl + '/repos/' + _org + '/' + repo + '/issues/' + issueID + '/comments?sort=created&direction=desc';

    _github.get(commentUrl, function(comments) {
      var reason = (comments && comments[0]) ? comments[0].body : 'Unspecified';
      cb && cb(reason);
    });
  };
}
