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
    var prList = prManager.list();

    var response = 'Open Pull Requests:\n';
    for(reqName in prList) {
      var request = prList[reqName];
      response += request.url + ' | Assigned to: ' + request.assignee + '\n';
    }

    msg.send(prList.length ? response : 'There are no open pull requests!')
  });

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

    // Handle the hook depending on whether it was opened, closed, etc...
    switch(data.action) {
      case 'opened':
          request = prManager.open(request);
          robot.send(user, 'New PR: ' + request.url + ' | From branch \'' + request.branch + '\' | Description: \'' + request.title + '\' | Opened by ' + request.initiator + ' | Assigned to ' + request.assignee);
        break;
      case 'reopened':
          request = prManager.reopen(request);
          robot.send(user, 'Re-opened PR: ' + request.url + ' | From branch \'' + request.branch + '\' | Re-opened by ' + data.sender.login + ' | Assigned to ' + request.assignee);
        break;
      case 'synchronize':
          robot.send(user, 'Updated PR: ' + request.url);
        break;
      case 'closed':
        request = prManager.close(request);
        if(request.merged) {
          robot.send(user, 'Merged PR: ' + request.url + ' | Merged by ' + data.sender.login);
        } else {
          prManager.getIssueComment(repo, request.number, function(comment) {
            robot.send(user, 'Rejected PR: ' + request.url + ' | Closed by ' + data.sender.login + ' | Reason: ' + comment);
          });
        }
        break;
    }
  });
}
