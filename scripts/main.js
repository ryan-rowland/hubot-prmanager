// Vendor Includes
var url = require('url');
var querystring = require('querystring');

// Local Includes
var PR_Manager = require('./pr_manager');

module.exports = function(robot) {
  var prManager = new PR_Manager(robot);

  // Check for new repos every minute
  (function checkForNewRepos() {
    prManager.updateHooks();
    setTimeout(checkForNewRepos, 60000);
  })();

  // Define `pr set {repo/pr_num} {key} {value}`
  robot.respond(/pr set ?([^\s]+) ?([^\s]+) ?([^\s]+)/i, function(msg) {
    var prNum = msg.match[1];
    var key   = msg.match[2];
    var value = msg.match[3];

    var response = prManager.setParam(prNum, key, value);
    msg.send(response);
  });

  // Define `pr get {repo/pr_num} {key}`
  robot.respond(/pr get ?([^\s]+) ?([^\s]+)/i, function(msg) {
    var prNum = msg.match[1];
    var key   = msg.match[2];
    var value = prManager.getParam(prNum, key);
    
    var response = prNum + ' ' + key + ' = ' + value;
    msg.send(response);
  });

  // Define `pr list`
  robot.respond(/pr list/i, function(msg) {
    var prList = prManager.getOpenRequests();

    var response = 'Open Pull Requests:\n';
    for(reqName in prList) {
      var request = prList[reqName];
      var assignee = request.assignee | 'Nobody';

      response += request.url + ' | Assigned to: ' + assignee + '\n';
    }

    msg.send(prList.length ? response : 'There are no open pull requests!')
  });

  // Define Pull Request Hook handlers
  var _actionHandlers = {

    opened: function (user, origRequest) {
      var req = prManager.open(origRequest);

      robot.send(user, '\
        New PR: '       + req.url       + ' | \
        From branch: '  + req.branch    + ' | \
        Description: '  + req.title     + ' | \
        Opened by: '    + req.initiator + ' | \
        Assigned to: '  + req.assignee || 'Nobody'
      );
    },

    reopened: function (user, origRequest) {
      var req = prManager.reopen(origRequest);

      robot.send(user, '\
        Re-opened PR: ' + req.url           + ' | \
        From branch: '  + req.branch        + ' | \
        Re-opened by: ' + data.sender.login + ' | \
        Assigned to: '  + req.assignee || 'Nobody'
      );
    },

    synchronize: function(user, origRequest) {
      robot.send(user, 'Updated PR: ' + req.url);
    },

    merged: function(user, origRequest) {
      var req = prManager.close(origRequest);

      robot.send(user, '\
        Merged PR: '  + req.url   + ' | \
        Merged by: '  + data.sender.login
      );
    },

    closed: function(user, origRequest) {
      var req = prManager.close(origRequest);

      prManager.getIssueComment(repo, req.number, function(comment) {
        robot.send(user, '\
          Rejected PR: '  + req.url           + ' | \
          Closed by: '    + data.sender.login + ' | \
          Reason: '       + comment
        );
      });
    }
  };

  // Listen for the pull request hook
  robot.router.post('/hubot/gh-pull-requests', function(req, res) {
    var data = req.body;
    var repo = data.repository.name;
    var query = querystring.parse(url.parse(req.url).query);

    var user = {
      room : query.room,
      type : query.type
    };

    // Create the request object
    var request = {
      id : data.repository.name + '/' + data.number,
      url : data.pull_request.html_url,
      repo : data.repository.name,
      title : data.pull_request.title,
      branch : data.pull_request.head.ref,
      merged : data.pull_request.merged,
      number : data.number,
      assignee : data.pull_request.assignee,
      initiator : data.pull_request.user.login
    };

    res.end();

    // Determine which action we need to take
    var action = data.action;
    if(action == 'closed' && request.merged) {
      action = 'merged';
    }

    // Run the appropriate handler
    _actionHandlers[action](user, request);
  });
}
